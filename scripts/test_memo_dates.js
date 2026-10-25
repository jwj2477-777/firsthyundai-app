'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/memo-dates.js'),'utf8');
const scope=vm.createContext({window:{},Date,Intl});
vm.runInContext(source,scope);
const parse=scope.window.FirstHyundaiMemoDates.parse;
const at=new Date('2026-10-26T01:00:00.000Z'); // Monday, 10 AM KST
const expect=(text,date,time='12:00',allDay=true)=>{
 const result=parse(text,at);
 assert(result,text);
 assert.equal(result.local,date+'T'+time,text);
 assert.equal(result.all_day,allDay,text);
 assert.equal(new Date(result.scheduled_at).toISOString(),
  new Date(result.local+':00+09:00').toISOString(),text);
};
expect('오늘 예약','2026-10-26');
expect('내일 오후 3시 반 1502동 방문','2026-10-27','15:30',false);
expect('모레 계약서 작성','2026-10-28');
expect('이번주 토요일 손님 예약','2026-10-31');
expect('이번 주 일요일 오후 2시','2026-11-01','14:00',false);
expect('다음주 월요일 오전 10시','2026-11-02','10:00',false);
expect('다음 주 화요일 16:45','2026-11-03','16:45',false);
expect('10월 30일 14:20','2026-10-30','14:20',false);
expect('2026-11-05 오전 9시','2026-11-05','09:00',false);
expect('11월 3일 계약','2026-11-03');
assert.equal(parse('퍼스트파크 1502동 3004호 연락처',at),null);
assert.equal(parse('일반 공지 메모',at),null);
assert.equal(parse('2월 30일',at),null);
console.log('Natural Korean relative dates, weekdays, explicit dates, all-day and KST conversion passed.');
