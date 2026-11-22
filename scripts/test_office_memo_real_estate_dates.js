'use strict';
/* v2.2.5 regression: everyday real-estate memos post normally.
   Before: "84.9㎡", "13.5억", "24.5평", "101-1502", "다음주에", "준공 25년", "내년 3월" were
   blocked ("메모의 날짜가 올바르지 않습니다") and "8.5억"/"2/3 지분" became calendar dates.
   Fictional memo text only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const dates=fs.readFileSync(path.join(dir,'memo-dates.js'),'utf8');

// 1) Parser: fixed "now" = Friday 2026-11-20 10:30 KST.
const scope=vm.createContext({window:{},Date,Intl});
vm.runInContext(dates,scope);
const {parse,cue}=scope.window.FirstHyundaiMemoDates;
const at=new Date('2026-11-20T01:30:00.000Z');
const none=[
 '퍼스트파크 84A 매매 8.5억 손님','전세 3.2억 → 3.5억 조정','12.5억 급매','13.5억 급매','15.3억 호가',
 '3-4층 선호','84.9㎡ 매물','전용 114.5㎡','59.9㎡ 전세','24.5평','1.5룸','관리비 2.5만원','1.2층 매물',
 '2/3 지분','지분 1/2','101-1502 손님 방문','2-3일 소요','계약금 10% 7일 이내','매월 25일 관리비',
 '주 1일 근무','1일 1회 환기','다음주에 다시 연락','다음 달에 이사 예정','준공 25년 된 아파트',
 '30년 거주','2027년 입주 예정','내년 3월 이사','이번 주 안에 답변','다음주 일정 공유','다음주 월세 입금',
 '퍼스트파크 1502동 3004호 연락처'
];
for(const text of none){
 assert.equal(parse(text,at),null,text+' must not become a schedule');
 assert.equal(cue(text),false,text+' must not count as a stated date (would block posting)');
}
const expect=(text,local)=>{const r=parse(text,at);assert(r,text);assert.equal(r.local,local,text);assert.equal(cue(text),true,text+' cue');};
expect('27일 오후 2시 잔금','2026-11-27T14:00');
expect('5일 잔금','2026-12-05T12:00');            // the 5th has passed this month
expect('20일 오후 5시','2026-11-20T17:00');
expect('다음 주 화 2시','2026-11-24T14:00');
expect('다음주 금요일 오후 3시','2026-11-27T15:00');
expect('다다음주 월요일 오전 10시','2026-11-30T10:00');
expect('금요일 오후 3시 손님','2026-11-27T15:00'); // bare weekday on a Friday = next Friday
expect('토요일 11시 방문','2026-11-21T11:00');
expect('글피 오전 10시','2026-11-23T10:00');
expect('3일 후 연락','2026-11-23T12:00');
expect('2주 뒤 연락','2026-12-04T12:00');
expect('8.5억 11/27 잔금','2026-11-27T12:00');   // the price is skipped, the date is kept
expect('11.27 잔금 은행 동행','2026-11-27T12:00');
expect('2026.12.3 잔금','2026-12-03T12:00');
expect('12/3(목) 오전 10시','2026-12-03T10:00');
// A stated date that does not exist still stops posting (it is a cue, but not a date).
for(const text of ['2월 30일 방문','31일 잔금','11/31 잔금']){
 assert.equal(parse(text,at),null,text);assert.equal(cue(text),true,text+' must still be caught');
}

// 2) Composer: posting, and leaving an auto-read date out with "일정 빼기".
assert(html.includes('id="officeBoardScheduleSkip"')&&html.includes('FirstHyundaiOfficeBoard.toggleScheduleSkip()'),
 'Skip button for an auto-read date');
let userId='11111111-1111-1111-1111-111111111111';
const elements=new Map(),calls=[];
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,hidden:true,
 attrs:{},setAttribute(k,v){this.attrs[k]=v},
 classList:{set:new Set(),add(c){this.set.add(c)},remove(c){this.set.delete(c)},
  toggle(c,on){on?this.set.add(c):this.set.delete(c)},contains(c){return this.set.has(c)}},
 addEventListener(){},querySelector(){return null},focus(){}});return elements.get(id)}
const RealDate=Date;
class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:[at.getTime()]))}static now(){return at.getTime()}}
const ctx=vm.createContext({
 window:{FirstHyundaiNative:{officeBoardAction:(action,data,id)=>calls.push({action,data:JSON.parse(data),id}),
 requestOfficeBoardAccess(){},getMode:()=>'family',getOfficeMemberId:()=>userId}},document:{getElementById:el},
 currentPage:'officeBoard',Date:FixedDate,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,confirm:()=>true
});
vm.runInContext(dates,ctx);vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiOfficeBoard;
const answer=()=>{const c=calls.at(-1);ctx.window.onFirstHyundaiOfficeBoardResult({requestId:c.id,ok:true,
 data:{ok:true,note:{id:'mhad4vwu-'+String(calls.length).padStart(36,'0'),text:c.data.text,done:false,
  all_day:c.data.all_day,scheduled_at:c.data.scheduled_at,created_at:'2026-11-20T01:30:00Z',updated_at:'2026-11-20T01:30:00Z',
  author:{id:userId,name:'작성자'}}}});};
const type=text=>{el('officeBoardDraft').value=text;api._test.hasDateCue(text);};

(async()=>{
 for(const text of ['퍼스트파크 84.9㎡ 매물 13.5억','101-1502 손님 방문','준공 25년 된 아파트 다음주에 다시 연락']){
  type(text);const before=calls.length;
  api.post();
  assert.equal(calls.length,before+1,text+' must post');
  assert.equal(calls.at(-1).data.scheduled_at,null,text+' has no schedule');
  assert(!String(el('officeBoardFeedback').textContent).includes('날짜가 올바르지 않습니다'),text+' must not be blocked');
  answer();await new Promise(r=>setTimeout(r,5));
 }
 // Auto date shown with a skip button; skipping posts without a schedule.
 const text='27일 오후 2시 퍼스트파크 손님 8.5억';
 type(text);
 // v2.2.11: the suggestion reads like speech, with the weekday.
 const refresh=()=>{api.toggleScheduleSkip();api.toggleScheduleSkip();};
 refresh();
 const said=el('officeBoardScheduleSuggestion').textContent;
 assert(said.includes('11월 27일 (금) 오후 2시')&&said.startsWith('▦ 자동 일정'),'Suggestion with weekday: '+said);
 type('11월 19일 계약 완료 가상단지');refresh();
 const past=el('officeBoardScheduleSuggestion').textContent;
 assert(past.includes('지난 날짜')&&past.includes('11월 19일 (목)')&&past.includes('일정 빼기'),'Past date is flagged: '+past);
 assert.equal(api._test.localDayLabel('2027-01-05T12:00'),'2027년 1월 5일 (화)','Another year is spelled out');
 assert.equal(api._test.localClock('2026-11-27T09:30'),'오전 9:30');
 type(text);
 const skip=el('officeBoardScheduleSkip');
 assert.equal(api._test.postSchedule(text).local,'2026-11-27T14:00');
 api.toggleScheduleSkip();
 assert.equal(api._test.postSchedule(text),null,'Skipped date is not saved');
 assert.equal(skip.hidden,false);assert.equal(skip.textContent,'일정 다시 넣기');
 assert(el('officeBoardScheduleSuggestion').textContent.includes('일정 없이 등록'),'Skip is clearly stated');
 api.toggleScheduleSkip();
 assert.equal(api._test.postSchedule(text).local,'2026-11-27T14:00','Skip can be undone');
 assert.equal(skip.textContent,'일정 빼기');
 api.toggleScheduleSkip();
 // Typing a different date brings the schedule back (skip applies to that one date only).
 assert.equal(api._test.postSchedule('11/28 오후 2시 손님').local,'2026-11-28T14:00');
 type(text);
 const before=calls.length;api.post();
 assert.equal(calls.length,before+1);
 assert.equal(calls.at(-1).data.scheduled_at,null,'Skipped auto date is not sent');
 answer();await new Promise(r=>setTimeout(r,5));
 assert.equal(api._test.postSchedule('27일 오후 2시 손님').local,'2026-11-27T14:00','Skip resets after posting');
 // A non-existent stated date is still stopped.
 type('11/31 잔금');const blocked=calls.length;api.post();
 assert.equal(calls.length,blocked,'Impossible date must not be saved as an undated memo');
 assert(el('officeBoardFeedback').textContent.includes('날짜가 올바르지 않습니다'));
 console.log('Real-estate memo dates: prices/areas/ranges never become dates or block posting; new phrasings and 일정 빼기 work.');
})().catch(e=>{console.error(e);process.exitCode=1});
