/* Annual family birthdays are stored only as authenticated private office notes.
 * Korean lunar month starts/lengths: deterministic calendar table, 2025–2050.
 * Format per row: lunar year, solar lunar-new-year, leap month (0=none), bitset
 * (bit n = 1 when lunar month n is 30 days; leap month follows its regular month).
 */
(function(global){
 'use strict';
 const table=Object.create(null);
 const rows=[
 '2025 2025-01-29 6 2w5','2026 2026-02-17 0 2w5',
 '2027 2027-02-07 0 2tm','2028 2028-01-27 5 2hi',
 '2029 2029-02-13 0 2hn','2030 2030-02-03 0 122',
 '2031 2031-01-23 3 251','2032 2032-02-11 0 295',
 '2033 2033-01-31 11 4lu','2034 2034-02-19 0 1g2',
 '2035 2035-02-08 0 279','2036 2036-01-28 6 4ej',
 '2037 2037-02-15 0 217','2038 2038-02-04 0 x7',
 '2039 2039-01-24 5 123','2040 2040-02-12 0 12l',
 '2041 2041-02-01 0 295','2042 2042-01-22 2 5ea',
 '2043 2043-02-10 0 2oi','2044 2044-01-30 7 5r9',
 '2045 2045-02-17 0 2lh','2046 2046-02-06 0 219',
 '2047 2047-01-26 5 431','2048 2048-02-14 0 ja',
 '2049 2049-02-02 0 14l','2050 2050-01-23 3 149'];
 for(const row of rows){
  const [year,first,leap,bits]=row.split(' ');
  table[year]={first,leap:Number(leap),bits:parseInt(bits,36)};
 }
 const dateParts=s=>String(s||'').match(/^(20\d\d)-(\d\d)-(\d\d)$/);
 function solarDate(year,month,day){
  if(!Number.isInteger(year)||month<1||month>12||day<1||day>31)return null;
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day
   ?date.toISOString().slice(0,10):null;
 }
 function lunarDate(year,month,day,isLeap=false){
  const info=table[year];
  if(!info||!Number.isInteger(month)||month<1||month>12||
   !Number.isInteger(day)||day<1||day>30||isLeap&&info.leap!==month)return null;
  const index=month-1+(info.leap&&month>info.leap?1:0)+(isLeap?1:0);
  const size=n=>29+((info.bits>>n)&1);
  if(day>size(index))return null;
  let offset=day-1;
  for(let i=0;i<index;i++)offset+=size(i);
  return new Date(Date.parse(info.first+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
 }
 function validBirthday(b){
  if(!b||!['양력','음력'].includes(b.kind)||typeof b.name!=='string'||
   !b.name.trim()||b.name.length>24||/[<>\r\n]/.test(b.name)||
   !Number.isInteger(b.month)||b.month<1||b.month>12||
   !Number.isInteger(b.day)||b.day<1||b.day>(b.kind==='양력'?31:30))return false;
  return b.kind==='양력'?!!solarDate(2028,b.month,b.day):true;
 }
 function parseLine(line){
  const found=String(line||'').trim().match(/^(.{1,24}?)\s+(양력|음력)\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*생일)?$/u);
  if(!found)return null;
  const b={name:found[1].trim(),kind:found[2],month:Number(found[3]),day:Number(found[4])};
  return validBirthday(b)?b:null;
 }
 function textFor(b){return '🎂 '+b.name+' 생일 · 매년 '+b.kind+' '+b.month+'월 '+b.day+'일';}
 function parseNote(text){
  const found=String(text||'').trim().match(/^🎂\s*(.{1,24}?)\s+생일\s*·\s*매년\s*(양력|음력)\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/u);
  if(!found)return null;
  const b={name:found[1].trim(),kind:found[2],month:Number(found[3]),day:Number(found[4])};
  return validBirthday(b)?b:null;
 }
 function occurrencesInMonth(b,year,month){
  if(!validBirthday(b)||!Number.isInteger(year)||!Number.isInteger(month))return [];
  const found=new Set();
  if(b.kind==='양력'){
   const date=solarDate(year,b.month,b.day);
   if(date&&Number(date.slice(5,7))===month)found.add(date);
  }else{
   for(const lunarYear of [year-1,year]){
    const date=lunarDate(lunarYear,b.month,b.day);
    if(date&&Number(date.slice(0,4))===year&&Number(date.slice(5,7))===month)found.add(date);
   }
  }
  return [...found].sort();
 }
 function occursOn(b,date){
  const parts=dateParts(date);if(!parts)return false;
  return occurrencesInMonth(b,Number(parts[1]),Number(parts[2])).includes(date);
 }
 function nextDate(b,today){
  const parts=dateParts(today);if(!parts||!validBirthday(b))return null;
  const y=Number(parts[1]);
  const dates=[];
  if(b.kind==='양력'){
   for(let year=y;year<=y+8;year++)dates.push(solarDate(year,b.month,b.day));
  }else{
   for(let year=y-1;year<=y+2;year++)dates.push(lunarDate(year,b.month,b.day));
  }
  return dates.filter(date=>date&&date>=today).sort()[0]||null;
 }
 function isoAllDay(day){return day?new Date(day+'T00:00:00+09:00').toISOString():null;}
 global.FirstHyundaiAnnualCalendar={
  parseLine,parseNote,textFor,occurrencesInMonth,occursOn,nextDate,isoAllDay,
  _test:{lunarDate,solarDate,validBirthday}};
})(window);
