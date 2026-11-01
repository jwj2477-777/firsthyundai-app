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
// Calendar date tap must carry the selected day into a simple freeform memo.
assert(html.includes('id="officeBoardAddSelectedDay"')&&html.includes('id="officeBoardScheduleClear"'),
 'Add selected date and cancel actions must be reachable in family UI');
api.chooseDay('2028-01-30');
api.addAtSelectedDay();
assert.equal(api._test.scheduleSuggestion('3시 30분 방문'),'2028-01-30T15:30');
assert.equal(api._test.draftSchedule('2028년 2월 1일 오전 10시').local,'2028-02-01T10:00',
 'Explicit date in text wins over the calendar selection');
assert.equal(api._test.draftSchedule('2028년 2월 30일 방문'),null,
 'Invalid user date must never be silently replaced with the calendar date');
assert.equal(el('officeBoardScheduleClear').hidden,false,'Selected date can be removed');
el('officeBoardDraft').value='3시 30분 방문';
api.post();api.post();
assert.equal(calls.length,1,'Repeated tap before server acknowledgement must not post a second memo');
assert.equal(calls[0].action,'post');
const scheduledPayload=JSON.parse(calls[0].data);
assert.equal(scheduledPayload.scheduled_at,'2028-01-30T06:30:00.000Z');
assert.equal(scheduledPayload.all_day,false);
assert.equal(scheduledPayload.text,'3시 30분 방문','Existing authenticated JSON-only memo channel retained');
const note={id:'mhad4vwu-00000000-0000-0000-0000-000000000001',text:'3시 30분 방문',
 created_at:'2026-10-25T01:00:00Z',updated_at:'2026-10-25T01:00:00Z',done:false};
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:calls[0].id,ok:true,data:{ok:true,note}});
(async()=>{
await new Promise(done=>setTimeout(done,10));
assert(el('officeBoardList').innerHTML.includes('3시 30분 방문'));
assert.equal(el('officeBoardDraft').value,'');
assert.equal(el('officeBoardScheduleClear').hidden,true,'Successful post clears calendar selection');
assert.equal(api._test.scheduleSuggestion('3시 30분 방문'),'','After post, memo no longer inherits prior calendar date');
api.chooseDay('2028-01-30');api.addAtSelectedDay();
el('officeBoardDraft').value='2028년 2월 30일 오후 3시 방문';
const callCount=calls.length;
api.post();
assert.equal(calls.length,callCount,'Invalid explicitly typed date must not be saved as an undated memo');
assert(el('officeBoardFeedback').textContent.includes('날짜가 올바르지 않습니다'));
api.clearScheduledDay();
// Photo-only upload does not call the post endpoint, but must still reject
// overlapping taps until the asynchronous image upload has completed.
let finishPhotoUpload;
ctx.window.FirstHyundaiBoardImages={
 pendingCount:()=>1,pendingTarget:()=>note.id,
 uploadPending:()=>new Promise(done=>{finishPhotoUpload=done})
};
el('officeBoardDraft').value='';
const beforePhoto=calls.length;
api.post();api.post();
assert.equal(calls.length,beforePhoto,'Photo-only repeated taps may not create two note requests');
assert.equal(typeof finishPhotoUpload,'function','First photo-only upload started');
finishPhotoUpload(true);
await new Promise(done=>setTimeout(done,5));
ctx.window.FirstHyundaiBoardImages=undefined;
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
api.setQuery('1502동3004호');
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
const closure={id:'mhad4vwu-00000000-0000-0000-0000-00000000beef',
 text:'2028년 1월 30일~2월 2일 휴무',done:false,all_day:true,
 scheduled_at:'2028-01-29T15:00:00.000Z',created_at:'2026-10-01T00:00:00Z'};
api._test.merge([...samples,closure]);
for(const day of ['2028-01-30','2028-01-31','2028-02-01','2028-02-02'])
 assert(api.closureDates().includes(day),'Rain/snow map-box window honors shared holiday '+day);
api.chooseDay('2028-02-30');
assert(!el('officeBoardCalendarMonth').textContent.includes('02-30'),'Invalid calendar day rejected');
// Old push entries are not restricted to the currently loaded 25 or 32 notes.
// Fetch additional pages only for the clicked target, without pulling every
// customer memo into a notification history or a public endpoint.
const oldNote={...samples[2],id:'mhad4vwu-00000000-0000-0000-0000-00000000fade',
 text:'오래된 알림에서 찾아온 메모',done:true};
assert(api.focusNote(oldNote.id));
let pageReq=calls.at(-1);
assert.equal(pageReq.action,'list');
assert.equal(JSON.parse(pageReq.data).offset,0);
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:pageReq.id,ok:true,
 data:{notes:samples.slice(-25),has_more:true,next_offset:25}});
await new Promise(done=>setTimeout(done,5));
pageReq=calls.at(-1);
assert.equal(JSON.parse(pageReq.data).offset,25,'Deep link must paginate beyond recent posts');
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:pageReq.id,ok:true,
 data:{notes:[oldNote],has_more:false}});
await new Promise(done=>setTimeout(done,5));
assert(api._test.memoItems().some(n=>n.id===oldNote.id),
 'Old completed memo must become visible after notification deep link');
assert(el('officeBoardFeedback').textContent.includes('알림의 메모를 열었습니다.'));

// An alert can refer to a deleted post. State that explicitly rather than
// continuing to scroll toward a note that will never be found.
const gone='mhad4vwu-00000000-0000-0000-0000-00000000abcd';
assert(api.focusNote(gone));
pageReq=calls.at(-1);
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:pageReq.id,ok:true,
 data:{notes:[],has_more:false}});
await new Promise(done=>setTimeout(done,5));
assert(el('officeBoardFeedback').textContent.includes('삭제되었거나'));

// Test the actual ambiguous network response case: server stored the note
// but client's POST response was lost. Retry must query the authenticated
// recent board and must NOT send the same post twice.
api.clearFilters();el('officeBoardDraft').value='서버 응답 유실 확인 메모';
const postedBefore=calls.filter(x=>x.action==='post').length;
api.post();
const submitted=calls.at(-1);
assert.equal(submitted.action,'post');
assert.equal(calls.filter(x=>x.action==='post').length,postedBefore+1);
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:submitted.id,ok:false,
 error:'서버 응답 시간 초과'});
await new Promise(done=>setTimeout(done,5));
assert.equal(el('officeBoardDraft').value,'서버 응답 유실 확인 메모',
 'Uncertain post must preserve draft until server state is confirmed');
api.post();
pageReq=calls.at(-1);
assert.equal(pageReq.action,'list','Retry after timeout must query before creating another post');
assert.equal(calls.filter(x=>x.action==='post').length,postedBefore+1);
const recovered={...oldNote,
 id:'mhad4vwu-00000000-0000-0000-0000-00000000dcba',
 text:'서버 응답 유실 확인 메모',done:false,all_day:false,scheduled_at:null,
 author:{id:userId,name:'내 계정'},created_at:new Date().toISOString(),
 updated_at:new Date().toISOString()};
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:pageReq.id,ok:true,
 data:{notes:[recovered],has_more:false}});
await new Promise(done=>setTimeout(done,5));
assert.equal(el('officeBoardDraft').value,'','Recovered submission clears draft');
assert.equal(calls.filter(x=>x.action==='post').length,postedBefore+1,
 'Already saved memo is not sent a second time');
assert(api._test.memoItems().some(n=>n.id===recovered.id));
assert(el('officeBoardFeedback').textContent.includes('중복으로 등록하지 않았습니다'));

// If a successful recent-list check cannot prove the earlier server result,
// ask for explicit consent instead of silently duplicating a possible post.
el('officeBoardDraft').value='저장 여부 불명확한 새 메모';
api.post();
const uncertain=calls.at(-1);
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:uncertain.id,ok:false,
 error:'서버 응답 시간 초과'});
await new Promise(done=>setTimeout(done,5));
api.post();
pageReq=calls.at(-1);
ctx.confirm=()=>false;
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:pageReq.id,ok:true,
 data:{notes:[],has_more:false}});
await new Promise(done=>setTimeout(done,5));
assert.equal(calls.filter(x=>x.action==='post').length,postedBefore+2,
 'No repost when duplicate-risk confirmation is declined');
assert.equal(el('officeBoardDraft').value,'저장 여부 불명확한 새 메모');
assert(!/localStorage|sessionStorage|\bfetch\(/.test(js),
 'Sensitive notes must remain in the authenticated native channel');
console.log('Office board UX, native bridge, freeform post and escaping passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
