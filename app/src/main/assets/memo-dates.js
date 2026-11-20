/* Private-office Korean date interpreter. Never transmits memo text.
 * v2.2.5: prices/areas/ranges are no longer read as dates ("8.5억", "84.9㎡", "3-4층",
 * "2/3 지분", "101-1502"), only real dates count as a "date cue" (so "다음주에 연락",
 * "준공 25년", "내년 3월" can be posted), and everyday phrasings are understood:
 * "27일 오후 2시", "금요일 3시", "다음주 화 2시", "다다음주 월요일", "글피", "3일 후", "2주 뒤".
 */
(function(root){
'use strict';
// A yearless number pair followed by one of these is a price/size/range, not a date.
const UNIT=/^\s*(?:억|만|천|원|층|룸|평|㎡|m2|m²|%|퍼|명|개|배|호|동|세대|세|년|차|번|건|위|대|가구|지분|분의|형|타입|시간|km|kg|cm|mm|인|채|필지|칸|장|권|살)/i;
// After a "-" range the second number is often a count of days/weeks ("2-3일 소요").
const RANGE_UNIT=/^\s*(?:일|주|개월|달)/;
// "N일" that is a duration or a rule, not a calendar day.
const DAY_NOT_DATE=/^\s*(?:이내|안|동안|간|째|후|뒤|전|마다|부터|까지|씩|이상|이하|정도|치|차|분|제|짜리|시간|자|넘|만에|\d+\s*회)/;
const DAY_BEFORE_NOT_DATE=/(?:매월|매달|매주|격주|주|하루|월|개월|며칠|일주일)\s*$/;
const DAYS={'월':0,'화':1,'수':2,'목':3,'금':4,'토':5,'일':6};
function plain(after,separator){
 if(UNIT.test(after))return false;
 if(separator==='-'&&RANGE_UNIT.test(after))return false;
 return true;
}
// First match of a global pattern whose following text passes `keep`.
function first(s,re,keep){
 for(const m of s.matchAll(re)){
  const after=s.slice(m.index+m[0].length);
  if(keep(m,after,s.slice(0,m.index)))return m;
 }
 return null;
}
function patterns(s){
 const koreanYear=s.match(/(?:^|[^\d])((?:20\d{2})|(?:2\d|3\d))\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 const relativeYear=s.match(/(올해|내년|내후년)\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 const relativeMonth=s.match(/(이번|다음|다다음)\s*달\s*(\d{1,2})\s*일/);
 const full=first(s,/(?:^|[^\d])(20\d{2})\s*([.\/-])\s*(\d{1,2})\s*\2\s*(\d{1,2})(?![\d.])/g,
  (m,after)=>plain(after,m[2]));
 // A short leading year (27.1.30) must not become a yearless January.
 const shortYear=first(s,/(?:^|[^\d.])(2\d|3\d)\s*([.\/-])\s*(\d{1,2})\s*\2\s*(\d{1,2})(?![\d.])/g,
  (m,after)=>plain(after,m[2]));
 const korean=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 // Yearless 11.27 / 11/27 / 11-27; "8.5억", "3-4층", "2/3 지분", "101-1502" are not dates.
 const short=first(s,/(?:^|[^\d.\/-])(\d{1,2})\s*([.\/-])\s*(\d{1,2})(?![\d.\/-])/g,
  (m,after,before)=>plain(after,m[2])&&!/지분\s*$/.test(before)&&+m[1]>=1&&+m[1]<=12&&+m[3]>=1&&+m[3]<=31);
 const week=s.match(/(이번|다음|다다음)\s*주\s*(월|화|수|목|금|토|일)(?:요일|(?![가-힣]))/);
 const weekday=s.match(/(?:^|[^가-힣])(월|화|수|목|금|토|일)요일/);
 const after=s.match(/(?:^|[^\d])(\d{1,2})\s*(일|주)\s*(?:후|뒤)(?![가-힣])/);
 const rel=s.match(/오늘|내일|모레|글피/);
 const dayOnly=first(s,/(?:^|[^\d.\/-])(\d{1,2})\s*일/g,
  (m,rest,before)=>!DAY_NOT_DATE.test(rest)&&!DAY_BEFORE_NOT_DATE.test(before)&&+m[1]>=1&&+m[1]<=31);
 return {koreanYear,relativeYear,relativeMonth,full,shortYear,korean,short,week,weekday,after,rel,dayOnly};
}
// True when the text names a specific day (even an impossible one like "2월 30일").
// Used to decide that the memo's own date wins over a calendar-selected day, and to
// stop posting a memo whose stated date does not exist.
function cue(text){
 const p=patterns(String(text||''));
 return Object.values(p).some(Boolean);
}
function parse(text,now=new Date()){
 const s=String(text||'');
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const val=n=>+parts.find(p=>p.type===n).value;
 let y=val('year'),m=val('month'),d=val('day'),matched=false;
 const baseDow=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;
 const shift=days=>{
  const date=new Date(Date.UTC(y,m-1,d+days));
  y=date.getUTCFullYear();m=date.getUTCMonth()+1;d=date.getUTCDate();matched=true;
 };
 const {koreanYear,relativeYear,relativeMonth,full,shortYear,korean,short,week,weekday,after,rel,dayOnly}=patterns(s);
 // Recognize spoken/written Korean years before matching the yearless month.
 // 2028년 1월 is not the nearest January; a yearless fallback would misfile it.
 if(koreanYear){y=+koreanYear[1];if(y<100)y+=2000;
  m=+koreanYear[2];d=+koreanYear[3];matched=true}
 else if(relativeYear){y+=relativeYear[1]==='내년'?1:relativeYear[1]==='내후년'?2:0;
  m=+relativeYear[2];d=+relativeYear[3];matched=true}
 else if(full){y=+full[1];m=+full[3];d=+full[4];matched=true}
 else if(shortYear){y=2000+Number(shortYear[1]);m=+shortYear[3];d=+shortYear[4];matched=true}
 else if(relativeMonth){
  const increment=relativeMonth[1]==='다다음'?2:relativeMonth[1]==='다음'?1:0;
  const firstDay=new Date(Date.UTC(y,m-1+increment,1));
  y=firstDay.getUTCFullYear();m=firstDay.getUTCMonth()+1;d=+relativeMonth[2];matched=true;
 }
 else if(korean||short){const x=korean||short;m=+x[1];d=+(korean?x[2]:x[3]);matched=true;
  if(m<val('month')||(m===val('month')&&d<val('day')))y++;
 }else if(week){
  const weeks=week[1]==='다다음'?2:week[1]==='다음'?1:0;
  shift(weeks*7+DAYS[week[2]]-baseDow);
 }else if(after){
  const n=+after[1];if(n<1||n>(after[2]==='주'?12:90))return null;
  shift(after[2]==='주'?n*7:n);
 }else if(rel){
  shift(rel[0]==='내일'?1:rel[0]==='모레'?2:rel[0]==='글피'?3:0);
 }else if(dayOnly){
  // "27일": this month if not yet past, otherwise next month.
  d=+dayOnly[1];matched=true;
  if(d<val('day')){const next=new Date(Date.UTC(y,m,1));y=next.getUTCFullYear();m=next.getUTCMonth()+1;}
 }else if(weekday){
  // A bare "금요일" means the next one (written on a Friday, next week's Friday).
  const ahead=((DAYS[weekday[1]]-baseDow)+7)%7||7;
  shift(ahead);
 }
 if(!matched||y<2020||y>2100||m<1||m>12||d<1||d>31)return null;
 const date=new Date(Date.UTC(y,m-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d)return null;
 // Unqualified times favor normal office hours (09-20), extended 08-21.
 const clock=s.match(/(새벽|아침|오전|정오|점심|낮|오후|저녁|밤)?\s*(\d{1,2})\s*시\s*(반|\d{1,2}\s*분?)?/);
 // Digital time must honor Korean AM/PM words, just like "3시 반".
 const digital=clock?null:s.match(/(?:^|[^\d])(새벽|아침|오전|정오|점심|낮|오후|저녁|밤)?\s*([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
 const digital24=clock||digital?null:s.match(/(?:^|[^\d])24:00(?!\d)/);
 // Never turn an invalid clock such as 24:30 or 15:90 into a noon all-day event.
 if(!clock&&!digital&&!digital24&&/(?:^|[^\d])\d{1,2}:\d+(?!\d)/.test(s))return null;
 let h=12,min=0,allDay=!clock&&!digital&&!digital24,dayRollover=!!digital24;
 if(!allDay){
  h=clock?+clock[2]:digital?+digital[2]:0;
  min=clock?(clock[3]?.includes('반')?30:parseInt(clock[3]||'0',10)):digital?+digital[3]:0;
  const part=clock?.[1]||digital?.[1]||'';
  if(part==='오후'||part==='저녁'||part==='밤'){
   if(h>=1&&h<=11)h+=12;
  }else if(part==='새벽'||part==='아침'||part==='오전'){
   if(h===12)h=0;
  }else if(part==='정오'||part==='점심'||part==='낮'){
   if(h>=1&&h<=11)h+=12;
  }else if((clock||(digital&&digital[2].length===1))&&h>=1&&h<=12){
   // "3:30" follows office-hour speech, but "03:30" stays a literal 24h clock.
   // Core business hours are unambiguous for everyday appointment times.
   const options=[h===12?12:h,h===12?0:h+12];
   const core=options.filter(x=>x>=9&&x<=20);
   const extended=options.filter(x=>x>=8&&x<=21);
   h=(core.length===1?core:extended.length===1?extended:options)[0];
  }
  // 밤 12시 means the end of the stated day; 오전/새벽 12시 stays that morning.
  if(part==='밤'&&h===12){h=0;dayRollover=true;}
  if(h>23||min>59||!Number.isFinite(min))return null;
 }
 if(dayRollover){
  const next=new Date(Date.UTC(y,m-1,d+1));
  y=next.getUTCFullYear();m=next.getUTCMonth()+1;d=next.getUTCDate();
 }
 const local=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-')+
  'T'+String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
 const iso=new Date(local+':00+09:00').toISOString();
 return {local,scheduled_at:iso,all_day:allDay};
}
root.FirstHyundaiMemoDates={parse,cue};
})(window);
