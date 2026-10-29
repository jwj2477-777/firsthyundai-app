'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'office-board.css'),'utf8');
new vm.Script(js);
const dates=fs.readFileSync(path.join(dir,'memo-dates.js'),'utf8');new vm.Script(dates);
assert(js.includes('memoRefresh')&&js.includes('memoOrder')&&js.includes('memoCompleted'));
assert(js.includes('memoClock')&&js.includes('memoPhones'));
assert(js.includes('settingsChanged')&&js.includes('clearInterval(timer)'));
assert(html.includes('id="overviewMemoBriefing"')&&
 html.includes('id="overviewMemoEntries"')&&
 html.includes('FirstHyundaiOfficeBoard.openBriefingCalendar()'),
 'Today briefing must have a compact list and a direct calendar route');
assert(js.includes('function openBriefing(')&&
 js.includes("readAllBoard().then(notes=>")&&
 js.includes('function briefingRows(')&&
 js.includes('openBriefingNote(button.dataset.briefNote)'),
 'Today briefing must reuse private shared notes and support one-tap memo navigation');
assert(html.includes("if(id==='overview')window.FirstHyundaiOfficeBoard?.openBriefing?.()"),
 'Opening the today tab refreshes the linked memo agenda');
assert(html.includes('id="officeFooterMember"'),
 'Footer quietly shows the native currently selected account');
for(const field of ['officeBoard','officeBoardDraft','officeBoardPost','officeBoardList','officeBoardAuth'])
 assert(html.includes('id="'+field+'"'),field+' missing');
assert(html.includes("['officeBoard','사무실 메모']"));
assert(css.includes('.officeBoardNote'));
assert(!/localStorage|sessionStorage|\bfetch\(/.test(js),'Sensitive note content must not go to public storage/fetch');
let userMode='family',userId='11111111-1111-1111-1111-111111111111';
const elements=new Map(),calls=[];
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,
 classList:{add(){},remove(){}},addEventListener(){},querySelector(){return null},focus(){}});return elements.get(id)}
const ctx=vm.createContext({
 window:{FirstHyundaiNative:{officeBoardAction:(action,data,id)=>calls.push({action,data,id}),
 requestOfficeBoardAccess(){},getMode:()=>userMode,getOfficeMemberId:()=>userId}},document:{getElementById:el},
 currentPage:'officeBoard',Date,Promise,setTimeout,clearTimeout,setInterval:()=>0,confirm:()=>true
});
vm.runInContext(dates,ctx);vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiOfficeBoard;
assert(api._test.phones('010-1234-5678').includes('tel:01012345678'));
assert(!api._test.phones('<img src=x>').includes('<img'));
assert(api._test.scheduleSuggestion('10월 26일 오후 3시 반 방문').endsWith('10-26T15:30'));
assert(api._test.scheduleSuggestion('내일 오전 9시 출발').endsWith('T09:00'));
assert.equal(api._test.scheduleSuggestion('그냥 전달하는 일반 메모'),'');
assert.equal(api._test.toIso('2026-10-26T15:30'),'2026-10-26T06:30:00.000Z');
assert.equal(api._test.dateKey('2026-10-26T06:30:00.000Z'),'2026-10-26');
el('officeBoardDraft').value='3시 30분 방문';
api.post();
assert.equal(calls[0].action,'post');
const note={id:'mhad4vwu-00000000-0000-0000-0000-000000000001',text:'3시 30분 방문',
 created_at:'2026-10-25T01:00:00Z',updated_at:'2026-10-25T01:00:00Z',done:false};
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:calls[0].id,ok:true,data:{ok:true,note}});
(async()=>{
await new Promise(done=>setTimeout(done,10));
assert(el('officeBoardList').innerHTML.includes('3시 30분 방문'));
assert.equal(el('officeBoardDraft').value,'');
const own={...note,author:{id:userId,name:'작성자'}};
const other={...note,id:'mhad4vwu-00000000-0000-0000-0000-000000000002',
 author:{id:'22222222-2222-2222-2222-222222222222',name:'다른 가족'}};
assert(api._test.canEditNote(own));
assert(!api._test.canEditNote(other));
api._test.merge([other]);
let readOnly=el('officeBoardList').innerHTML;
assert(readOnly.includes('작성자·관리자만 수정 가능'));
assert(!readOnly.includes('data-action="edit"')&&!readOnly.includes('data-action="done"')&&
 !readOnly.includes('data-action="photoAdd"'),
 'Non-owner sees read-only memo without modification controls');
userMode='admin';
assert(api._test.canEditNote(other),'Admin mode unlocks non-author controls');
api._test.merge([other]);
const adminMarkup=el('officeBoardList').innerHTML;
assert(adminMarkup.includes('data-action="edit"')&&adminMarkup.includes('data-action="done"')&&
 adminMarkup.includes('data-action="photoAdd"'),'Admin may edit any shared memo');
userMode='family';
api._test.merge([own]);
assert(el('officeBoardList').innerHTML.includes('data-action="edit"'),
 'Original author retains edit controls');
// A searchable library, not an indefinitely tall pile of full post-its.
const samples=Array.from({length:32},(_,i)=>({
 id:'mhad4vwu-'+i.toString(16).padStart(36,'0'),
 text:i===3?'퍼스트파크 1502동 3004호 · 방문예정':'상담 메모 '+i,
 author:i%2===0?{id:userId,name:'내 계정'}:
  {id:'22222222-2222-2222-2222-222222222222',name:'아빠'},
 created_at:new Date(Date.parse('2026-10-25T00:00:00Z')+i*60000).toISOString(),
 updated_at:new Date(Date.parse('2026-10-25T00:00:00Z')+i*60000).toISOString(),
 done:i%3===0,pinned:i===5
}));
api._test.merge(samples);
api.setStatus('all');
assert.equal(api._test.filteredMemos().length,32,'All must include open and completed notes');
assert.equal((el('officeBoardList').innerHTML.match(/data-note=/g)||[]).length,10,
 'Only ten memo cards should render at once');
api.showMore();
assert.equal((el('officeBoardList').innerHTML.match(/data-note=/g)||[]).length,20,
 'Show more appends ten more memo cards without infinite scroll');
api.setStatus('active');
assert.equal(api._test.filteredMemos().length,samples.filter(n=>!n.done).length);
api.setStatus('done');
assert.equal(api._test.filteredMemos().length,samples.filter(n=>n.done).length);
api.setStatus('all');api.setAuthor(userId);
assert(api._test.filteredMemos().every(n=>n.author.id===userId));
api.setAuthor('');
api.setQuery('1502동 3004호');
assert.equal(api._test.filteredMemos().length,1,'Search reaches exact apartment unit text');
assert.equal(api._test.filteredMemos()[0].text,samples[3].text);
api.setQuery('');api.setStatus('all');
assert.equal(api._test.filteredMemos()[0].id,samples[5].id,'Pinned memo is sorted first');
api.setSort('oldest');
assert.equal(api._test.filteredMemos()[0].id,samples[5].id,
 'Pinned memo stays visible even with chronological sort');
api.clearFilters();
assert.equal(api._test.filteredMemos().length,samples.filter(n=>!n.done).length);
assert.equal((el('officeBoardList').innerHTML.match(/data-note=/g)||[]).length,10);
assert(!/localStorage|sessionStorage|\\bfetch\\(/.test(js),
 'Sensitive notes must remain in the authenticated native channel');
console.log('Office board UX, native bridge, freeform post and escaping passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
