'use strict';
/* v2.2.7 shared-memo regressions (fictional memos only):
   - editing a typo a day later keeps "내일 오후 3시" on its original day
   - cards: 완료 + 수정 visible, the rest in 더보기; no "진행 중" label clutter
   - 종일 items from earlier days count as 일정 지남
   - 완료 can be undone from the message; messages say what happened
   - 오늘 요약 shows "어제 16:00" for yesterday's leftovers, not a bare "16:00" */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const dates=fs.readFileSync(path.join(dir,'memo-dates.js'),'utf8');
assert(html.includes('<h2>공유 메모</h2>')&&html.includes('openBriefingCalendar()">달력 ›</button>'),'One name per place: 공유 메모 / 달력');

const now=new Date('2026-11-22T01:00:00.000Z'); // Sunday 10:00 KST
class FixedDate extends Date{constructor(...a){super(...(a.length?a:[now.getTime()]))}static now(){return now.getTime()}}
let mode='family';const me='11111111-1111-1111-1111-111111111111';
const elements=new Map(),calls=[];
function node(id){
 const kids=[];
 return {id,innerHTML:'',value:'',hidden:false,disabled:false,children:kids,attrs:{},listeners:{},
  get textContent(){return this._text+kids.map(k=>typeof k==='string'?k:k.textContent).join('')},
  set textContent(v){this._text=String(v);kids.length=0},_text:'',
  append(...xs){kids.push(...xs)},setAttribute(k,v){this.attrs[k]=v},
  addEventListener(type,fn){this.listeners[type]=fn},
  classList:{set:new Set(),add(c){this.set.add(c)},remove(c){this.set.delete(c)},toggle(c,on){on?this.set.add(c):this.set.delete(c)},contains(c){return this.set.has(c)}},
  querySelector(){return null},focus(){}};
}
function el(id){if(!elements.has(id))elements.set(id,node(id));return elements.get(id)}
const doc={getElementById:el,createElement:tag=>{const n=node(tag);n.remove=function(){};n.closest=sel=>sel==='.officeBoardUndo'?n:null;return n}};
const ctx=vm.createContext({
 window:{FirstHyundaiNative:{officeBoardAction:(action,data,id)=>calls.push({action,data:JSON.parse(data),id}),
  requestOfficeBoardAccess(){},getMode:()=>mode,getOfficeMemberId:()=>me}},
 document:doc,currentPage:'officeBoard',Date:FixedDate,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,confirm:()=>true
});
vm.runInContext(dates,ctx);vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiOfficeBoard,t=api._test;
const iso=s=>new Date(s).toISOString();
const note=(n,text,extra={})=>({id:'mhad4vwu-'+String(n).padStart(8,'0')+'-0000-0000-0000-000000000000',text,
 author:{id:me,name:'엄마'},done:false,pinned:false,scheduled_at:null,all_day:false,
 created_at:iso('2026-11-20T09:00:00+09:00'),updated_at:iso('2026-11-20T09:00:00+09:00'),...extra});
const reply=()=>{const c=calls.at(-1);ctx.window.onFirstHyundaiOfficeBoardResult({requestId:c.id,ok:true,
 data:{ok:true,note:{...(t.memoItems().find(n=>n.id===c.data.id)||{}),...c.data,updated_at:iso('2026-11-22T01:00:01Z')}}});};
const tick=()=>new Promise(r=>setTimeout(r,5));

(async()=>{
 // 1) Edit: typo fix keeps the original day; a new date phrase re-reads from today.
 const visit=note(1,'내일 오후 3시 퍼스트파크 방문',{scheduled_at:iso('2026-11-21T15:00:00+09:00')});
 t.merge([visit]);
 assert.equal(t.sameDateWording(visit,'내일 오후 3시 퍼스트파크 방문 (주차 가능)'),true);
 assert.equal(t.sameDateWording(visit,'모레 오후 3시 퍼스트파크 방문'),false);
 api.edit(visit.id);
 el('officeBoardList').querySelector=()=>({value:'내일 오후 3시 퍼스트파크 방문 (주차 가능)'});
 api.saveEdit(visit.id);
 let c=calls.at(-1);
 assert.equal(c.action,'edit');
 assert.equal('scheduled_at' in c.data,false,'Typo fix must not move "내일" to the day after the edit');
 reply();await tick();
 assert(el('officeBoardFeedback').textContent.includes('수정했어요'));
 api.edit(visit.id);
 el('officeBoardList').querySelector=()=>({value:'모레 오후 3시 퍼스트파크 방문'});
 api.saveEdit(visit.id);
 c=calls.at(-1);
 assert.equal(c.data.scheduled_at,iso('2026-11-24T15:00:00+09:00'),'A changed date phrase is read from today');
 reply();await tick();

 // 2) Cards: two everyday buttons; the rest behind 더보기; no "진행 중" label.
 const plain=note(2,'관리비 고지서 확인 부탁');
 const allDayPast=note(3,'11/20 잔금 은행 동행',{scheduled_at:iso('2026-11-20T12:00:00+09:00'),all_day:true});
 const pinned=note(4,'11/27 잔금',{scheduled_at:iso('2026-11-27T12:00:00+09:00'),all_day:true,pinned:true});
 t.merge([plain,allDayPast,pinned]);
 let markup=el('officeBoardList').innerHTML;
 assert(!markup.includes('진행 중</span>'),'Ordinary memos carry no "진행 중" label');
 assert(markup.includes('data-action="done"')&&markup.includes('data-action="edit"'));
 const more=markup.match(/<details class="officeBoardMoreActions">[\s\S]*?<\/details>/g)||[];
 assert(more.length>=3&&more.every(m=>m.includes('data-action="pin"')&&m.includes('data-action="photoAdd"')),'Pin/photo live in 더보기');
 assert(more.some(m=>m.includes('data-action="scheduleClear"')),'일정 해제 lives in 더보기');
 assert(!markup.includes('data-action="delete"'),'Family mode never offers delete');
 assert(markup.includes('📌 중요'),'Pinned memo shows a badge');
 assert.equal(t.pastDue(allDayPast),true,'A 종일 item from an earlier day is past due');
 assert.equal(t.pastDue(pinned),false);
 assert(markup.includes('⚠ 일정 지남'));
 mode='admin';t.merge([plain]);
 assert((el('officeBoardList').innerHTML.match(/<details class="officeBoardMoreActions">[\s\S]*?<\/details>/)||[''])[0].includes('data-action="delete"'),'Admin delete sits in 더보기');
 mode='family';

 // 3) 완료 → message with 되돌리기; tapping it sends done:false.
 t.merge([plain]);
 api.setDone(plain.id,true);
 c=calls.at(-1);assert.equal(c.action,'done');assert.equal(c.data.done,true);
 reply();await tick();
 const box=el('officeBoardFeedback');
 assert(box.textContent.includes('완료로 표시했어요'),box.textContent);
 const undo=box.children.find(k=>typeof k!=='string');
 assert(undo&&undo.textContent==='되돌리기','Undo button offered');
 box.listeners.click({target:undo});
 c=calls.at(-1);assert.equal(c.action,'done');assert.equal(c.data.done,false,'Undo reopens the memo');
 reply();await tick();
 assert(box.textContent.includes('다시 진행 중으로 바꿨어요'));

 // 4) Post messages say whether a calendar entry was made.
 el('officeBoardDraft').value='관리비 확인';api.post();reply();await tick();
 assert(el('officeBoardFeedback').textContent.includes('메모함에서 볼 수 있어요'));
 el('officeBoardDraft').value='27일 오후 2시 퍼스트파크 손님';api.post();reply();await tick();
 assert(el('officeBoardFeedback').textContent.includes('11월 27일 오후 2시 일정으로 달력에 표시돼요'),el('officeBoardFeedback').textContent);

 // 5) 오늘 요약: yesterday's leftover shows its day.
 for(const id of ['overviewMemoBriefing','overviewMemoCount','overviewMemoEntries'])el(id);
 const late=note(9,'어제 오후 4시 집주인 통화',{scheduled_at:iso('2026-11-21T16:00:00+09:00')});
 const todayVisit=note(10,'오늘 오후 2시 손님',{scheduled_at:iso('2026-11-22T14:00:00+09:00')});
 t.merge([late,todayVisit]);
 const brief=el('overviewMemoEntries').innerHTML;
 assert(brief.includes('어제 16:00'),'Yesterday is labelled');
 assert(/overviewMemoTime">14:00</.test(brief),'Today keeps a bare time');
 console.log('Memo v2.2.7: edit keeps original day, 2-button cards with 더보기, 종일 지남, 되돌리기, clear messages, briefing day labels.');
})().catch(e=>{console.error(e);process.exitCode=1});
