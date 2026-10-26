/* One short, source-backed daily forecast. No forecasts are used as observations. */
(function(){
 'use strict';
 const HOUR=3600000,ENDPOINT='https://firsthyundai-shared-settings.jwj2477.workers.dev/weather-briefing';
 const byId=id=>document.getElementById(id),day=ms=>new Date(ms+9*HOUR).toISOString().slice(0,10);
 const typeNames={rain:'비',snow:'눈',mixed:'비 또는 눈'};
 let data=null,lastAttempt=0,pending=false,sequence=0;
 const requests=new Map();
 function clock(iso){
  const h=new Date(Date.parse(iso)+9*HOUR).getUTCHours();
  return h===0?'자정':h===12?'낮 12시':(h<12?'오전 ':'오후 ')+(h%12||12)+'시';
 }
 function valid(doc,now=Date.now()){
  const issued=Date.parse(doc?.issued_at);
  return doc?.schema===1&&doc.status==='ok'&&doc.date===day(now)&&Number.isFinite(issued)&&
   now-issued>=0&&now-issued<=7*HOUR&&Array.isArray(doc.hours)&&doc.hours.length>0&&doc.hours.length<=24&&
   doc.hours.every(h=>Number.isFinite(Date.parse(h.at))&&day(Date.parse(h.at))===doc.date&&
    ['none','rain','snow','mixed'].includes(h.type)&&(h.pop===null||Number.isFinite(h.pop)&&h.pop>=0&&h.pop<=100)&&
    (h.temp===null||Number.isFinite(h.temp)&&h.temp>=-70&&h.temp<=70));
 }
 function summarize(doc,now=Date.now()){
  if(!valid(doc,now))return {main:'오늘 날씨 예보를 확인할 수 없습니다.',extra:'',icon:'☂',source:'날씨 연결 확인 중'};
  const hours=doc.hours.filter(h=>Date.parse(h.at)+HOUR>now).sort((a,b)=>a.at.localeCompare(b.at));
  if(!hours.length)return {main:'오늘 남은 시간의 예보를 확인하는 중입니다.',extra:'',icon:'◌',source:'기상청 예보 갱신 대기'};
  const events=[];
  for(const h of hours){
   if(h.type==='none')continue;
   const prev=events.at(-1);
   if(prev&&prev.type===h.type&&Date.parse(h.at)-Date.parse(prev.last)===HOUR)prev.last=h.at;
   else events.push({...h,last:h.at});
  }
  const describe=e=>{
   const active=Date.parse(e.at)<=now;
   const when=active?'지금 시간대에':clock(e.at)+'경부터';
   return '오늘 '+when+' '+typeNames[e.type]+' 예보가 있습니다.';
  };
  let main,extra='',icon='◌';
  if(events.length){main=describe(events[0]);icon=events[0].type==='snow'?'❄':'☂';if(events[1])extra=describe(events[1]);}
  else{
   const uncertain=hours.find(h=>h.pop!==null&&h.pop>=50);
   // A gap or expired last slot can never be summarized as an all-clear.
   const remaining=24-new Date(now+9*HOUR).getUTCHours();
   const actual=new Set(hours.map(h=>h.at));
   if(uncertain)main='오늘 '+clock(uncertain.at)+'경 강수확률이 '+uncertain.pop+'%입니다.';
   else main=doc.complete===true&&actual.size===remaining?'오늘 남은 시간에는 비·눈 예보가 없습니다.':'확인된 시간대에는 비·눈 예보가 없습니다.';
  }
  const first=hours[0];
  if(first?.temp!==null&&first?.temp!==undefined)extra=(extra?extra+' · ':'')+clock(first.at)+' 예보기온 '+first.temp+'°';
  return {main,extra,icon,source:'기상청 · '+clock(doc.issued_at)+' 발표 · 예보는 바뀔 수 있습니다.'};
 }
 function render(){
  if(!byId('overviewWeatherMessage'))return;
  const view=summarize(data);
  byId('overviewWeatherMessage').textContent=view.main;
  const extra=byId('overviewWeatherExtra');extra.textContent=view.extra;extra.hidden=!view.extra;
  byId('overviewWeatherIcon').textContent=view.icon;byId('overviewWeatherSource').textContent=view.source;
  byId('overviewWeatherDate').textContent=new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'});
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
 window.FirstHyundaiWeatherBriefing={refresh,_test:{valid,summarize,clock}};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.setInterval(()=>{render();if(typeof currentPage!=='undefined'&&currentPage==='overview')refresh()},60000);
 refresh();
})();
