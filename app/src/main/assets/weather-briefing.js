/* One actionable office briefing: live observation, optional precipitation and map-box alert.
   Forecast cannot stand in for observed conditions; missing hours cannot mean "dry". */
(function(){
 'use strict';
 const HOUR=3600000,DAY=24*HOUR,OFFSET=9*HOUR;
 const ENDPOINT='https://firsthyundai-shared-settings.jwj2477.workers.dev/weather-briefing';
 const $=id=>document.getElementById(id),localDay=ms=>new Date(ms+OFFSET).toISOString().slice(0,10);
 const kinds={rain:'비',snow:'눈',mixed:'비·눈'};
 let data=null,lastAttempt=0,pending=false,sequence=0;
 let hourlyExpanded=false;
 const requests=new Map();
 function atKst(day,hour){
  const [y,m,d]=day.split('-').map(Number);
  return Date.UTC(y,m-1,d,hour-9);
 }
 function nextDay(date,amount=1){
  return new Date(atKst(date,9)+amount*DAY+OFFSET).toISOString().slice(0,10);
 }
 function isClosed(date,extra=[]){
  if(extra.includes(date))return true;
  const [y,m,d]=date.split('-').map(Number);
  const dow=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  return dow===0||(dow===6&&[2,4].includes(Math.floor((d-1)/7)+1));
 }
 function nextOpen(now=Date.now(),extra=[]){
  const today=localDay(now);
  for(let i=1;i<=60;i++){
   const candidate=nextDay(today,i);
   if(!isClosed(candidate,extra))return {date:candidate,time:atKst(candidate,9)};
  }
  return null;
 }
 function valid(doc,now=Date.now()){
  const issued=Date.parse(doc?.issued_at);
  if(doc?.schema!==1||doc.status!=='ok'||doc.date!==localDay(now)||
    !Number.isFinite(issued)||now-issued<0||now-issued>7*HOUR||
    !Array.isArray(doc.hours)||!doc.hours.length||doc.hours.length>144)return false;
  return doc.hours.every(h=>{
   const stamp=Date.parse(h?.at);
   return Number.isFinite(stamp)&&localDay(stamp)>=doc.date&&localDay(stamp)<=localDay(now+5*DAY)&&
    ['none','rain','snow','mixed'].includes(h.type)&&
    (h.pop===null||(Number.isFinite(h.pop)&&h.pop>=0&&h.pop<=100))&&
    (h.temp===null||(Number.isFinite(h.temp)&&h.temp>=-70&&h.temp<=70));
  });
 }
 function timeLabel(iso,reference=Date.now()){
  const stamp=Date.parse(iso),h=new Date(stamp+OFFSET).getUTCHours();
  const date=localDay(stamp),prefix=date===localDay(reference)?'오늘 ':date===nextDay(localDay(reference))?'내일 ':date.slice(5).replace('-','/')+' ';
  return prefix+(h===0?'자정':h===12?'낮 12시':(h<12?'오전 ':'오후 ')+(h%12||12)+'시');
 }
 function summarize(doc,now=Date.now(),extra=[]){
  const result={precip:'',mapAlert:'',coverage:false};
  // An unavailable/partial forecast is simply omitted from the customer-facing
  // office briefing. Only confirmed forecast precipitation produces a map-box action.
  if(!valid(doc,now))return result;
  const hours=[...doc.hours].filter(h=>Date.parse(h.at)+HOUR>now).sort((a,b)=>a.at.localeCompare(b.at));
  const wet=hours.filter(h=>h.type!=='none'),today=localDay(now);
  const todayWet=wet.find(h=>localDay(Date.parse(h.at))===today);
  if(todayWet)result.precip=''+timeLabel(todayWet.at,now)+'경 '+kinds[todayWet.type]+' 예보가 있습니다.';
  if(isClosed(today,extra))return result;
  const opening=nextOpen(now,extra);if(!opening)return result;
  const start=Math.max(now,atKst(today,19));
  const inside=wet.find(h=>Date.parse(h.at)<opening.time&&Date.parse(h.at)+HOUR>start);
  const covered=new Set(hours.filter(h=>Date.parse(h.at)+HOUR>start&&Date.parse(h.at)<opening.time)
   .map(h=>Math.floor(Date.parse(h.at)/HOUR)*HOUR));
  let complete=true;
  for(let stamp=Math.floor(start/HOUR)*HOUR;stamp<opening.time;stamp+=HOUR){
   if(!covered.has(stamp)){complete=false;break}
  }
  result.coverage=complete;
  if(inside){
   const deadline=opening.date===nextDay(today)?'내일 오전 9시':'다음 영업일('+opening.date.slice(5).replace('-','/')+') 오전 9시';
   result.mapAlert=timeLabel(inside.at,now)+'경 '+kinds[inside.type]+' 예보 · '+deadline+'까지 강수 가능성이 있습니다. 지도함을 실내에 들여놓고 퇴근하세요.';
  }
  return result;
 }
 function forecastTemperature(now){
  if(!valid(data,now))return null;
  const current=data.hours.find(h=>{
   const at=Date.parse(h.at);
   return at<=now&&now<at+HOUR&&Number.isFinite(h.temp);
  });
  return current?Math.round(current.temp*10)/10:null;
 }
 function weatherDisplay(obs,forecastTemp,now=Date.now(),loading=false){
  const measured=Number.isFinite(obs?.temp),projected=Number.isFinite(forecastTemp);
  const temperature=measured?Math.round(obs.temp*10)/10+'°':
   projected?'예보기온 '+forecastTemp+'°':obs?'기온 정보 없음':loading?'현재 날씨 확인 중':'현재 날씨 확인 불가';
  const precipitation=obs?.effect==='rain'?' · 현재 비':obs?.effect==='snow'?' · 현재 눈':'';
  let source;
  if(obs&&Number.isFinite(Date.parse(obs.observed_at))){
   source='기상청 실황 · '+timeLabel(obs.observed_at,now)+' 관측';
   if(projected&&!measured)source+=' · 기온은 시간별 예보';
  }else if(projected){
   source='기상청 시간별 기온 예보 · 강수 실황 확인 중';
  }else{
   source=loading?'기상청 관측자료 확인 중':'기상청 관측자료를 불러오지 못했습니다.';
  }
  return {text:temperature+precipitation,source,
   kind:obs?.effect==='rain'?'rain':obs?.effect==='snow'?'snow':'temperature',
   hasTemperature:measured||projected};
 }
 // Hourly detail deliberately reuses the same verified forecast used for map-box warnings.
 // SKY describes a *forecast*; it is never used to infer the current observed sky.
 function hourlyRows(doc,now=Date.now(),limit=12){
  if(!valid(doc,now))return [];
  const start=Math.ceil(now/HOUR)*HOUR;
  return doc.hours.filter(h=>Date.parse(h.at)>=start)
   .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
   .slice(0,Math.max(0,Math.min(24,limit)));
 }
 function hourlyCondition(hour){
  if(hour.type==='rain')return {kind:'rain',label:'비'};
  if(hour.type==='snow')return {kind:'snow',label:'눈'};
  if(hour.type==='mixed')return {kind:'mixed',label:'비·눈'};
  if(hour.sky===1)return {kind:'sun',label:'맑음 예보'};
  if(hour.sky===3)return {kind:'partly-cloudy',label:'구름 많음 예보'};
  if(hour.sky===4)return {kind:'cloud',label:'흐림 예보'};
  return {kind:'unknown',label:'하늘 상태 미확인'};
 }
 const hourlyGlyphs={
  sun:'<circle cx="16" cy="16" r="5.2"/><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.45 6.45l2.8 2.8m13.5 13.5 2.8 2.8m0-19.1-2.8 2.8m-13.5 13.5-2.8 2.8"/>',
  cloud:'<path d="M8 23h16a6.5 6.5 0 0 0 .3-13 9 9 0 0 0-17.4 2A5.5 5.5 0 0 0 8 23Z"/>',
  'partly-cloudy':'<path d="M11 3V1.5M3 11H1.5M5.3 5.3 4 4m14 1.3L20 4"/><path d="M8 11a6.7 6.7 0 0 1 10-5.8M8 24h16a6 6 0 0 0-.1-12 8 8 0 0 0-15.5 1.7A5.3 5.3 0 0 0 8 24Z"/>',
  rain:'<path d="M8 19h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 19Z"/><path d="m10 24-1.5 4m8-4-1.5 4m8-4-1.5 4"/>',
  snow:'<path d="M8 19h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 19Z"/><path d="M13 24v6m-3-3h6m10-3v6m-3-3h6"/>',
  mixed:'<path d="M8 18h16a6 6 0 0 0 .2-12 9 9 0 0 0-17.3 2A5.3 5.3 0 0 0 8 18Z"/><path d="m11 23-1.5 4M23 23v6m-3-3h6"/>',
  unknown:'<circle cx="16" cy="16" r="11"/><path d="M13 12a3 3 0 0 1 6 0c0 2.5-3 3-3 5m0 4v1"/>'
 };
 function hourlyGlyph(kind){
  return '<svg viewBox="0 0 32 32" class="overviewHourGlyph" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
   (hourlyGlyphs[kind]||hourlyGlyphs.unknown)+'</svg>';
 }
 function hourlyDayHour(iso,now=Date.now()){
  const at=Date.parse(iso),date=localDay(at),today=localDay(now);
  const hour=new Date(at+OFFSET).getUTCHours();
  return {day:date===today?'오늘':date===nextDay(today)?'내일':date.slice(5).replace('-','/'),
   hour:String(hour).padStart(2,'0')+'시'};
 }
 function hourlyCards(doc,now=Date.now(),limit=12){
  return hourlyRows(doc,now,limit).map(hour=>{
   const cond=hourlyCondition(hour);
   const dayHour=hourlyDayHour(hour.at,now);
   const temp=Number.isFinite(hour.temp)?Math.round(hour.temp)+'°':'—';
   const chance=Number.isFinite(hour.pop)?Math.round(hour.pop)+'%':'—';
   return {day:dayHour.day,hour:dayHour.hour,condition:cond.label,kind:cond.kind,temp,chance};
  });
 }
 function renderHourly(){
  const toggle=$('overviewHourlyToggle'),panel=$('overviewHourlyDetail');
  if(!toggle||!panel)return;
  toggle.setAttribute?.('aria-expanded',String(hourlyExpanded));
  panel.hidden=!hourlyExpanded;
  if(!hourlyExpanded)return;
  const rows=hourlyCards(data);
  const list=$('overviewHourlyList'),notice=$('overviewHourlyNotice'),meta=$('overviewHourlyMeta');
  if(meta)meta.textContent='기상청 단기예보 · 기온 / 강수확률';
  if(!list||!notice)return;
  list.hidden=!rows.length;
  notice.hidden=!!rows.length;
  if(!rows.length){
   list.innerHTML='';
   notice.textContent=pending?'시간별 예보 확인 중입니다.':'현재 시간별 예보를 확인할 수 없습니다.';
   return;
  }
  notice.textContent='';
  list.innerHTML=rows.map(row=>'<div class="overviewHourItem" role="listitem" data-kind="'+row.kind+
   '" aria-label="'+row.day+' '+row.hour+', '+row.condition+', 기온 '+(row.temp==='—'?'미제공':row.temp)+
   ', 강수확률 '+(row.chance==='—'?'미제공':row.chance)+'">'+
   '<span class="overviewHourDate">'+row.day+'</span><strong class="overviewHourClock">'+row.hour+
   '</strong>'+hourlyGlyph(row.kind)+'<strong class="overviewHourTemp">'+row.temp+
   '</strong><small class="overviewHourPop">'+row.chance+'</small></div>').join('');
 }
 function toggleHourly(){
  hourlyExpanded=!hourlyExpanded;
  renderHourly();
  return hourlyExpanded;
 }
  function render(){
  if(!$('overviewWeatherMessage'))return;
  const now=Date.now(),obs=window.FirstHyundaiThemes?.currentWeather?.();
  const curr=$('overviewWeatherMessage'),icon=$('overviewWeatherIcon'),source=$('overviewWeatherSource');
  const detail=weatherDisplay(obs,forecastTemperature(now),now,
   !obs&&!data&&(pending||lastAttempt===0));
  icon?.setAttribute?.('data-kind',detail.kind);
  curr.textContent=detail.text;
  curr.classList?.toggle?.('is-reading',detail.hasTemperature);
  source.textContent=detail.source;
  const calendarDay=new Date(now);
  const titleDate=$('overviewWeatherDate');
  if(titleDate){
   titleDate.textContent=calendarDay.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'});
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(calendarDay);
   const part=type=>parts.find(value=>value.type===type)?.value||'';
   titleDate.setAttribute?.('datetime',[part('year'),part('month'),part('day')].join('-'));
  }
  const extra=window.FirstHyundaiOfficeBoard?.closureDates?.()||[];
  const view=summarize(data,now,extra);
  renderHourly();
  for(const [id,message] of [['overviewPrecipitation',view.mapAlert?'':view.precip],['overviewMapAlert',view.mapAlert]]){
   const node=$(id);if(!node)continue;node.textContent=message;node.hidden=!message;
  }
 }
 window.onFirstHyundaiWeatherBriefingFetched=result=>{
  const task=requests.get(result?.requestId);if(!task)return;requests.delete(result.requestId);
  result.ok?task.resolve(result.payload):task.reject(Error('forecast unavailable'));
 };
 function nativeRequest(){return new Promise((resolve,reject)=>{
  const id='forecast'+(++sequence),timer=setTimeout(()=>{requests.delete(id);reject(Error('timeout'))},18000);
  requests.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
  try{window.FirstHyundaiNative.fetchWeatherBriefing(id)}catch(e){clearTimeout(timer);requests.delete(id);reject(e)}
 })}
 async function refresh(force=false){
  render();
  window.FirstHyundaiThemes?.refreshObserved?.();
  if(document.hidden||pending||Date.now()-lastAttempt<(force?30000:15*60000))return;
  lastAttempt=Date.now();pending=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   let value;
   if(window.FirstHyundaiNative?.fetchWeatherBriefing)value=await nativeRequest();
   else{const r=await fetch(ENDPOINT,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('unavailable');value=await r.json()}
   data=valid(value)?value:null;
  }catch(e){if(!valid(data))data=null}
  finally{clearTimeout(timer);pending=false;render()}
 }
 window.FirstHyundaiWeatherBriefing={refresh,toggleHourly,_test:{valid,summarize,isClosed,nextOpen,timeLabel,atKst,nextDay,weatherDisplay,forecastTemperature,hourlyRows,hourlyCondition,hourlyDayHour,hourlyCards}};
 document.addEventListener('firsthyundai-observed-weather',render);
 document.addEventListener('firsthyundai-office-schedule-updated',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.setInterval(()=>{render();if(typeof currentPage!=='undefined'&&currentPage==='overview')refresh()},60000);
 refresh();
})();