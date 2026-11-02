'use strict';
// Synthetic text only. Drive the public board API and real input handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=path.resolve(__dirname,'../app/src/main/assets');
function fixture(saved={text:'이전 작성 중 메모',day:'2028-01-30'}){
 const elements=new Map(),calls=[],writes=[],timers=new Map(),drafts=new Map();
 const first='11111111-1111-1111-1111-111111111111';
 let member=first,timerId=0,readFails=false;
 drafts.set(first,saved);
 function el(id){
  if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',handlers:{},
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},
   querySelector(){return null},querySelectorAll(){return []},
   addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}});
  return elements.get(id);
 }
 const bridge={getMode:()=> 'family',getOfficeMemberId:()=>member,
  getOfficeMemoDraft:()=>{if(readFails)throw Error('unavailable');return JSON.stringify(drafts.get(member)||{});},
  saveOfficeMemoDraft:(text,day)=>{writes.push({member,text,day});drafts.set(member,{text,day});return true;},
  clearOfficeMemoDraft:()=>{writes.push({member,clear:true});drafts.delete(member);},
  officeBoardAction:(action,data,id)=>calls.push({action,data:JSON.parse(data),id})};
 const ctx=vm.createContext({window:{FirstHyundaiNative:bridge},document:{getElementById:el},
  currentPage:'officeBoard',Date,Promise,confirm:()=>true,
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
  setInterval:()=>0,clearInterval(){}});
 for(const name of ['memo-dates.js','office-board.js'])vm.runInContext(fs.readFileSync(path.join(assets,name),'utf8'),ctx);
 const api=ctx.window.FirstHyundaiOfficeBoard;
 function reply(req,data,error){ctx.window.onFirstHyundaiOfficeBoardResult({requestId:req.id,ok:!error,data,error});}
 function open(){api.open();const req=calls.at(-1);if(req?.action==='list')reply(req,{notes:[],has_more:false});}
 function type(text){el('officeBoardDraft').value=text;for(const fn of el('officeBoardDraft').handlers.input)fn();}
 function note(req){return {id:'mhad4vwu-00000000-0000-0000-0000-000000000001',
  ...req.data,done:false,author:{id:member},created_at:new Date().toISOString(),updated_at:new Date().toISOString()};}
 return {api,el,calls,writes,drafts,first,open,type,reply,note,
  switchMember:id=>{member=id},failRead:value=>{readFails=value}};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
(async()=>{
 const f=fixture();
 f.api.saveDraftNow();
 assert.equal(f.writes.length,0,'Backgrounding the home screen must not overwrite an unopened draft');
 f.open();await tick();
 assert.equal(f.el('officeBoardDraft').value,'이전 작성 중 메모');
 assert.equal(f.api._test.scheduleSuggestion('방문'),'2028-01-30T12:00');
 f.type('전송할 가상 메모');
 const posting=f.api.post(),sent=f.calls.at(-1);
 f.type('응답을 기다리며 추가한 가상 메모');
 f.reply(sent,{note:f.note(sent)});await posting;
 assert.equal(f.el('officeBoardDraft').value,'응답을 기다리며 추가한 가상 메모');
 assert.equal(f.drafts.get(f.first).text,'응답을 기다리며 추가한 가상 메모');
 assert(f.el('officeBoardFeedback').textContent.includes('작성란에 남겨'));
 // A normal acknowledged submission still clears its own draft and calendar.
 const normal=f.api.post(),normalReq=f.calls.at(-1);
 f.reply(normalReq,{note:f.note(normalReq)});await normal;
 assert.equal(f.el('officeBoardDraft').value,'');assert(!f.drafts.has(f.first));
 // Date-only edits while sending must be retained too.
 f.type('가상 방문 메모');f.api.chooseDay('2028-02-01');f.api.addAtSelectedDay();
 const datePost=f.api.post(),dateReq=f.calls.at(-1);
 f.api.chooseDay('2028-02-02');f.api.addAtSelectedDay();
 f.reply(dateReq,{note:f.note(dateReq)});await datePost;
 assert.equal(dateReq.data.scheduled_at,'2028-02-01T03:00:00.000Z');
 assert.equal(f.drafts.get(f.first).day,'2028-02-02');
 assert.equal(f.el('officeBoardDraft').value,'가상 방문 메모');
 // Returning to identical text is still a new input operation.
 const aba=f.api.post(),abaReq=f.calls.at(-1);
 f.type('다시 작성');f.type('가상 방문 메모');
 f.reply(abaReq,{note:f.note(abaReq)});await aba;
 assert.equal(f.el('officeBoardDraft').value,'가상 방문 메모');
 // Reconciliation of a lost response has the same snapshot protection.
 const failed=f.api.post(),failedReq=f.calls.at(-1);
 f.reply(failedReq,null,'서버 응답 시간 초과');await failed;
 const retry=f.api.post(),lookup=f.calls.at(-1);
 assert.equal(lookup.action,'list');
 f.type('조회 중 새로 작성한 가상 메모');
 f.reply(lookup,{notes:[f.note(failedReq)],has_more:false});await retry;
 assert.equal(f.el('officeBoardDraft').value,'조회 중 새로 작성한 가상 메모');
 assert.equal(f.calls.at(-1).action,'list','Reconciliation must not repost');
 // A failed native read must not authorize saving a blank over existing data.
 const g=fixture();g.failRead(true);g.open();await tick();g.api.saveDraftNow();
 assert.equal(g.writes.length,0);g.failRead(false);g.open();await tick();
 assert.equal(g.el('officeBoardDraft').value,'이전 작성 중 메모');
 // Never write the old account's visible text into the newly selected account.
 const other='22222222-2222-2222-2222-222222222222';
 g.drafts.set(other,{text:'다른 계정의 가상 초안',day:''});g.switchMember(other);
 g.api.saveDraftNow();assert.equal(g.writes.length,0);
 g.open();await tick();assert.equal(g.el('officeBoardDraft').value,'다른 계정의 가상 초안');
 assert.equal(g.drafts.get(g.first).text,'이전 작성 중 메모');
 console.log('Office draft lifecycle passed: unopened, delayed post, calendar, retyping, reconciliation, read failure and account isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
