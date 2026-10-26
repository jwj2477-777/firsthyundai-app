'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const source=fs.readFileSync(path.join(dir,'annual-calendar.js'),'utf8');
const officeSource=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
new vm.Script(source);new vm.Script(officeSource);
const ctx=vm.createContext({window:{}});vm.runInContext(source,ctx);
const api=ctx.window.FirstHyundaiAnnualCalendar;
assert(api);
const lunar=api._test.lunarDate;
assert.equal(lunar(2026,1,3),'2026-02-19');
assert.equal(lunar(2027,1,3),'2027-02-09');
assert.equal(lunar(2026,11,11),'2026-12-19');
assert.equal(lunar(2027,11,11),'2027-12-08');
assert.equal(lunar(2028,11,11),'2028-12-26');
assert.equal(lunar(2040,1,3),'2040-02-14');
assert.equal(lunar(2026,13,1),null);
assert.equal(lunar(2024,1,3),null);
const b=api.parseLine('가족가 음력 1월 3일');
assert(b&&b.kind==='음력');
assert.equal(api.occursOn(b,'2027-02-09'),true);
assert.equal(api.occursOn(b,'2027-02-10'),false);
assert.equal(api.nextDate(b,'2026-10-26'),'2027-02-09');
const solar=api.parseLine('가족나 양력 8월 30일');
assert.equal(api.nextDate(solar,'2026-10-26'),'2027-08-30');
assert.equal(api.occursOn(solar,'2027-08-30'),true);
const leap=api.parseLine('가족다 양력 2월 29일');
assert.equal(api.nextDate(leap,'2029-01-01'),'2032-02-29');
assert.equal(api.nextDate(api.parseLine('가족바 양력 1월 31일'),'2026-10-26'),'2027-01-31');
assert.equal(api.parseLine('가족라 음력 13월 5일'),null);
assert.equal(api.parseLine('가족마 음력 1월 31일'),null);
assert.equal(api.parseLine(''),null);
assert.deepEqual([...api.occurrencesInMonth(b,2027,2)],['2027-02-09']);
const note=api.parseNote(api.textFor(b));
assert.deepEqual({...note},{...b},'Stored private birthday note is safely recoverable without a public name list');
assert.equal(api.isoAllDay('2027-02-09'),'2027-02-08T15:00:00.000Z');
for(const id of ['officeBoardBirthdayAdd','officeBoardBirthdayForm','officeBoardBirthdayInput','officeBoardBirthdaySave'])
 assert(html.includes('id="'+id+'"'),id);
assert(html.includes('<script src="annual-calendar.js"></script><script src="office-board.js"></script>'));
assert(officeSource.includes('annual.occursOn(birthday,day)'));
assert(officeSource.includes("call('post',{text:event.text,scheduled_at:annual.isoAllDay(event.day),all_day:true})"));
assert(!source.includes('fetch(')&&!source.includes('localStorage'),'Private birthdates must remain in existing authenticated storage');
// Verify the actual board agenda and today briefing produce yearly virtual events.
const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',value:'',disabled:false,
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null}});
 return elements.get(id);
}
const boardCtx=vm.createContext({window:{FirstHyundaiAnnualCalendar:api,FirstHyundaiNative:{getMode:()=> 'admin'}},
 document:{getElementById:el,querySelector(){return null},dispatchEvent(){}},
 currentPage:'officeBoard',Date,Intl,Event:class Event{},Promise,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},confirm:()=>true});
vm.runInContext(officeSource,boardCtx);
const board=boardCtx.window.FirstHyundaiOfficeBoard;
const fake={id:'postit00-00000000-0000-0000-0000-000000000001',text:api.textFor(b),done:false,
 all_day:true,scheduled_at:api.isoAllDay('2026-02-19'),created_at:'2026-01-01T00:00:00Z'};
board._test.merge([fake]);
assert.equal(board._test.briefingRows('2027-02-09',99).length,1,'Birthday repeats after base year');
assert.equal(board._test.briefingRows('2027-02-10',99).length,0);
assert.equal(board._test.calendarEntries(2028,1).filter(x=>x.recurring).length,1,'Calendar switches lunar date each year');
assert.equal(board._test.calendarEntries(2027,1).length,0);
assert.equal(board._test.briefingRows('2028-01-29',99)[0].all_day,true);
console.log('Verified annual private birthday recurrence, 2026–2050 Korean lunar calendar, leap-day handling, and office board integration.');
