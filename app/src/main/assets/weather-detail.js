/* 퍼스트현대 송도 상세 날씨. Verified KMA forecast + private appointment times only. */
(function(){
'use strict';
const $=id=>document.getElementById(id),HOUR=3600000,OFFSET=9*HOUR;
let opened=false,returnFocus=null;
function kst(iso){
 const date=new Date(iso);
 if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=n=>parts.find(p=>p.type===n)?.value||'';
 return {day:get('year')+'-'+get('month')+'-'+get('day'),hour:Number(get('hour')),minute:get('minute')};
}
function labelTime(iso,now=Date.now()){
 const t=kst(iso),reference=kst(now);
 if(!t||!reference)return '';
 const day=t.day===reference.day?'오늘':t.day>reference.day?'내일':t.day.slice(5).replace('-','/');
 return day+' '+String(t.hour).padStart(2,'0')+':'+t.minute;
}
function icon(kind){
 const paths={
  temperature:'<path d="M13 20V7.5a4 4 0 0 1 8 0V20a7 7 0 1 1-8 0Z"/><path d="M17 12v12"/>',
  rain:'<path d="M8 19h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 19Z"/><path d="m10 24-1.5 4m8-4-1.5 4m8-4-1.5 4"/>',
  snow:'<path d="M8 19h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 19Z"/><path d="M13 24v6m-3-3h6m16-6v6m-3-3h6"/>',
  mixed:'<path d="M8 19h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 19Z"/><path d="m11 24-2 4M23 23v6m-3-3h6"/>',
  sun:'<circle cx="16" cy="16" r="5"/><path d="M16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3m0-20-3 3M9 23l-3 3"/>',
  cloud:'<path d="M8 23h16a6.5 6.5 0 0 0 .3-13 9.5 9.5 0 0 0-17.4 2A5.5 5.5 0 0 0 8 23Z"/>',
  'partly-cloudy':'<path d="M11 3v3M3 11h3M5.5 5.5l2.5 2.5"/><path d="M8 10a6 6 0 0 1 11-3M8 24h16a6 6 0 0 0 0-12 9 9 0 0 0-16 2A5 5 0 0 0 8 24Z"/>'
 };
 return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
  (paths[kind]||paths.temperature)+'</svg>';
}
function currentSnapshot(obs,doc,now=Date.now()){
 const validTemp=Number.isFinite(obs?.temp);
 const forecast=window.FirstHyundaiWeatherBriefing;
 const detail=forecast?._test?.weatherDisplay?.(obs,null,now,false);
 let temp=validTemp?Math.round(obs.temp*10)/10+'°':'—';
 let description=validTemp?'현재 기온': '현재 기온 미확인';
 if(obs?.effect==='rain')description='현재 비 관측';
 else if(obs?.effect==='snow')description='현재 눈 관측';
 let kind=obs?.effect==='rain'?'rain':obs?.effect==='snow'?'snow':'temperature';
 let source=detail?.source||'기상청 현재 실황 확인 중';
 if(!validTemp&&doc?.hours){
  const hour=doc.hours.find(h=>{const time=Date.parse(h.at);return time<=now&&now<time+HOUR&&Number.isFinite(h.temp)});
  if(hour){temp=Math.round(hour.temp)+'°';description='현재 시간대 예보기온';source='기상청 시간별 예보 (현재 실황 기온 미확인)'}
 }
 return {temp,description,kind,source};
}
function nextHours(doc,now=Date.now(),limit=12){
 const getter=window.FirstHyundaiWeatherBriefing?._test?.hourlyRows;
 return getter?getter(doc,now,limit):[];
}
function rangeStats(doc,now=Date.now()){
 if(!doc?.hours)return null;
 const hours=doc.hours.filter(h=>{const at=Date.parse(h.at);return at>=now&&at<now+24*HOUR&&Number.isFinite(h.temp)});
 if(!hours.length)return null;
 const temperatures=hours.map(h=>h.temp),min=Math.min(...temperatures),max=Math.max(...temperatures);
 const coverage=new Set(hours.map(h=>Math.floor(Date.parse(h.at)/HOUR))).size;
 return {min:Math.round(min),max:Math.round(max),count:coverage,complete:coverage===24};
}
function nextSummary(doc,now=Date.now()){
 const hours=nextHours(doc,now,12);
 if(!hours.length)return '기상청 단기예보를 확인할 수 없습니다.';
 const names={rain:'비',snow:'눈',mixed:'비·눈'};
 const wet=hours.find(h=>h.type!=='none');
 if(wet)return labelTime(wet.at,now)+'경 '+names[wet.type]+'가 예보되어 있습니다. 시간별 강수확률을 확인하세요.';
 const first=Math.ceil(now/HOUR)*HOUR;
 const complete=hours.length===12&&hours.every((h,i)=>Date.parse(h.at)===first+i*HOUR);
 if(complete)return '앞으로 12시간은 비·눈이 없는 것으로 예보되었습니다.';
 return '제공된 시간별 예보만 표시합니다. 누락된 시간대는 예측하지 않습니다.';
}
function chartMarkup(doc,now=Date.now()){
 const rows=nextHours(doc,now,12);
 if(!rows.length)return {markup:'',status:'현재 시간별 예보를 불러오지 못했습니다.'};
 const condition=window.FirstHyundaiWeatherBriefing?._test?.hourlyCondition;
 const cards=window.FirstHyundaiWeatherBriefing?._test?.hourlyCards?.(doc,now,12)||[];
 const count=rows.length,w=count*68;
 const numeric=rows.map(h=>Number.isFinite(h.temp)?h.temp:null);
 const vals=numeric.filter(n=>n!==null),minimum=vals.length?Math.min(...vals):0,maximum=vals.length?Math.max(...vals):0;
 const y=t=>92-(t-minimum)/(maximum-minimum||1)*47;
 const cols=rows.map((h,i)=>{
  const c=cards[i],t=kst(h.at),kind=condition?.(h)?.kind||'temperature';
  const label=t?String(t.hour).padStart(2,'0')+'시':'—';
  const pop=Number.isFinite(h.pop)?Math.round(h.pop)+'%':'—';
  return '<div class="fhdWeatherHour" data-kind="'+kind+'"><strong>'+label+'</strong>'+
   icon(kind)+'<small>'+pop+'</small></div>';
 }).join('');
 let lines='',dots='';
 for(let i=0;i<count;i++){
  const n=numeric[i],x=34+i*68;
  if(n===null)continue;
  const py=y(n);
  if(i&&numeric[i-1]!==null&&Date.parse(rows[i].at)-Date.parse(rows[i-1].at)===HOUR)
   lines+='<path d="M '+(x-68)+' '+y(numeric[i-1])+' L '+x+' '+py+'" fill="none" stroke="#5A968D" stroke-width="2.8" stroke-linecap="round"/>';
  dots+='<circle cx="'+x+'" cy="'+py+'" r="4.5" fill="#4B9186" stroke="#FFF" stroke-width="2"/>'+
   '<text x="'+x+'" y="'+(py-14)+'" fill="#365B61" font-weight="800" font-size="13" text-anchor="middle">'+Math.round(n)+'°</text>';
 }
 const graph='<svg class="fhdWeatherPlot" xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="112" viewBox="0 0 '+w+' 112" role="img" aria-label="시간대별 예보 기온 그래프">'+lines+dots+'</svg>';
 const start=labelTime(rows[0].at,now),end=labelTime(rows.at(-1).at,now);
 return {markup:'<div style="width:'+w+'px"><div class="fhdWeatherChartRow">'+cols+'</div>'+graph+'</div>',
  status:'기상청 단기예보 · '+start+' ~ '+end+' · 시간별 강수확률(%) · 예보 기온(°C)'};
}
function matchAppointmentWeather(at,doc){
 if(!doc?.hours)return null;
 const hour=doc.hours.find(h=>{const stamp=Date.parse(h.at);return stamp<=at&&at<stamp+HOUR});
 if(!hour)return null;
 const fields=[];
 if(Number.isFinite(hour.temp))fields.push(Math.round(hour.temp)+'°');
 if(hour.type==='rain')fields.push('비 예보');
 else if(hour.type==='snow')fields.push('눈 예보');
 else if(hour.type==='mixed')fields.push('비·눈 예보');
 if(Number.isFinite(hour.pop))fields.push('강수 '+Math.round(hour.pop)+'%');
 return fields.length?fields.join(' · '):null;
}
function appointments(doc,now=Date.now(),records){
 const rows=Array.isArray(records)?records:
  window.FirstHyundaiOfficeBoard?.weatherAppointments?.(now,48)||[];
 return rows.slice(0,4).map(entry=>{
  const at=Date.parse(entry?.at);
  if(!Number.isFinite(at)||at<now||at>now+48*HOUR)return null;
  return {time:labelTime(at,now),forecast:matchAppointmentWeather(at,doc)};
 }).filter(Boolean);
}
function render(){
 if(!opened)return;
 const now=Date.now(),api=window.FirstHyundaiWeatherBriefing;
 const doc=api?.forecast?.()||null,obs=window.FirstHyundaiThemes?.currentWeather?.()||null;
 const measured=currentSnapshot(obs,doc,now),stats=rangeStats(doc,now);
 const date=new Date(now).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'});
 $('fhdWeatherDate').textContent=date+' · 송도동';
 $('fhdWeatherHeroIcon').innerHTML=icon(measured.kind);
 $('fhdWeatherTemp').textContent=measured.temp;
 $('fhdWeatherCondition').textContent=measured.description;
 $('fhdWeatherObserved').textContent=measured.source;
 $('fhdWeatherHighLow').textContent=stats?
  (stats.complete?'향후 24시간 예보':'제공된 예보 구간')+' · 최고 '+stats.max+'° / 최저 '+stats.min+'°':
  '예보 최고·최저 기온 확인 중';
 $('fhdWeatherSummary').textContent=nextSummary(doc,now);
 const chart=chartMarkup(doc,now);
 $('fhdWeatherChart').innerHTML=chart.markup;
 $('fhdWeatherChartStatus').textContent=chart.status;
 const advisory=api?.forecastStatus?.()?.mapAlert||'';
 $('fhdWeatherOfficeAlert').textContent=advisory;
 $('fhdWeatherOfficeAlert').hidden=!advisory;
 const list=appointments(doc,now);
 $('fhdWeatherSchedule').innerHTML=list.length?list.map(x=>
  '<div class="fhdWeatherScheduleItem"><strong>'+x.time+' 일정</strong><span>'+
  (x.forecast||'해당 시간 예보 미제공')+'</span></div>').join(''):
  '<p class="fhdWeatherScheduleEmpty">가까운 시간에 등록된 일정이 없거나 공유 일정이 아직 연결되지 않았습니다.</p>';
 $('fhdWeatherAttribution').textContent='기상청 실황 및 단기예보 · 실제 관측과 예보 구분 · 자료가 없는 시간은 표시하지 않습니다.';
}
function open(){
 const panel=$('fhdWeatherDialog');if(!panel)return false;
 if(!opened)returnFocus=document.activeElement;
 opened=true;panel.hidden=false;panel.setAttribute('aria-hidden','false');
 document.body.classList.add('fhdWeatherDetailOpen');
 render();$('fhdWeatherClose')?.focus?.();
 window.FirstHyundaiWeatherBriefing?.refresh?.(true);
 window.FirstHyundaiOfficeBoard?.openBriefing?.();
 return true;
}
function close(){
 const panel=$('fhdWeatherDialog');if(!panel)return;
 opened=false;panel.hidden=true;panel.setAttribute('aria-hidden','true');
 document.body.classList.remove('fhdWeatherDetailOpen');
 if(returnFocus?.isConnected)returnFocus.focus?.();
 returnFocus=null;
}
function openCalendar(){
 close();window.FirstHyundaiOfficeBoard?.openBriefingCalendar?.();
}
document.addEventListener('keydown',event=>{
 if(!opened)return;
 if(event.key==='Escape'){event.preventDefault();close()}
 if(event.key==='Tab'){
  const panel=$('fhdWeatherDialog');
  const focusables=[...panel.querySelectorAll('button,[tabindex="0"]')].filter(el=>!el.hidden);
  if(!focusables.length)return;
  const i=focusables.indexOf(document.activeElement);
  if(event.shiftKey&&i<=0){event.preventDefault();focusables.at(-1).focus()}
  else if(!event.shiftKey&&i===focusables.length-1){event.preventDefault();focusables[0].focus()}
 }
});
for(const e of ['firsthyundai-weather-forecast-updated','firsthyundai-observed-weather','firsthyundai-office-schedule-updated'])
 document.addEventListener(e,render);
window.FirstHyundaiWeatherDetail={open,close,openCalendar,render,
 _test:{kst,labelTime,currentSnapshot,nextHours,rangeStats,nextSummary,chartMarkup,matchAppointmentWeather,appointments}};
})();
