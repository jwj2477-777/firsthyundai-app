/* Private-office Korean date interpreter. Never transmits memo text. */
(function(root){
'use strict';
function parse(text,now=new Date()){
 const s=String(text||'');
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const val=n=>+parts.find(p=>p.type===n).value;
 let y=val('year'),m=val('month'),d=val('day'),matched=false;
 const baseDow=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;
 const full=s.match(/(?:^|[^\d])(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?!\d)/);
 const korean=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 const short=s.match(/(?:^|[^\d])(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?!\d)/);
 const week=s.match(/(이번\s*주|다음\s*주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/);
 const rel=s.match(/오늘|내일|모레/);
 const dayIndex={'월요일':0,'화요일':1,'수요일':2,'목요일':3,'금요일':4,'토요일':5,'일요일':6};
 if(full){y=+full[1];m=+full[2];d=+full[3];matched=true}
 else if(korean||short){let x=korean||short;m=+x[1];d=+x[2];matched=true;
  if(m<val('month')||(m===val('month')&&d<val('day')))y++;
 }else if(week){
  const offset=(week[1].replace(/\s/g,'').startsWith('다음')?7:0)+dayIndex[week[2]]-baseDow;
  const date=new Date(Date.UTC(y,m-1,d+offset));
  y=date.getUTCFullYear();m=date.getUTCMonth()+1;d=date.getUTCDate();matched=true;
 }else if(rel){
  const offset=rel[0]==='내일'?1:rel[0]==='모레'?2:0;
  const date=new Date(Date.UTC(y,m-1,d+offset));
  y=date.getUTCFullYear();m=date.getUTCMonth()+1;d=date.getUTCDate();matched=true;
 }
 if(!matched||y<2020||y>2100||m<1||m>12||d<1||d>31)return null;
 const date=new Date(Date.UTC(y,m-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d)return null;
 // Unqualified times favor normal office hours (09-20), extended 08-21.
 const clock=s.match(/(새벽|아침|오전|정오|점심|낮|오후|저녁|밤)?\s*(\d{1,2})\s*시\s*(반|\d{1,2}\s*분?)?/);
 const digital=clock?null:s.match(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
 let h=12,min=0,allDay=!clock&&!digital;
 if(!allDay){
  h=clock?+clock[2]:+digital[1];
  min=clock?(clock[3]?.includes('반')?30:parseInt(clock[3]||'0',10)):+digital[2];
  const part=clock?.[1]||'';
  if(part==='오후'||part==='저녁'||part==='밤'){
   if(h>=1&&h<=11)h+=12;
  }else if(part==='새벽'||part==='아침'||part==='오전'){
   if(h===12)h=0;
  }else if(part==='정오'||part==='점심'||part==='낮'){
   if(h>=1&&h<=11)h+=12;
  }else if(clock&&h>=1&&h<=12){
   // Core business hours are unambiguous for everyday appointment times.
   const options=[h===12?12:h,h===12?0:h+12];
   const core=options.filter(x=>x>=9&&x<=20);
   const extended=options.filter(x=>x>=8&&x<=21);
   h=(core.length===1?core:extended.length===1?extended:options)[0];
  }
  if(h>23||min>59||!Number.isFinite(min))return null;
 }
 const local=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-')+
  'T'+String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
 const iso=new Date(local+':00+09:00').toISOString();
 return {local,scheduled_at:iso,all_day:allDay};
}
root.FirstHyundaiMemoDates={parse};
})(window);
