/* Same official data, collected by the existing GitHub public-data pipeline.
   Some provider gateways reject edge-network IPs even for approved keys. */
const HOUR=3600000;
let cached=null,checked=0;
const today=now=>new Date(now+9*HOUR).toISOString().slice(0,10);
export function validWeatherSnapshot(value,kind,now=Date.now()){
 if(!value||value.schema!==1||value.status!=='ok')return false;
 if(kind==='observed'){
  const t=Date.parse(value.observed_at);
  return ['none','rain','snow'].includes(value.effect)&&Number.isFinite(t)&&now-t<=2*HOUR&&t-now<=300000&&
   value.grid?.nx===55&&value.grid?.ny===123&&
   (value.temp===undefined||value.temp===null||(Number.isFinite(value.temp)&&value.temp>=-70&&value.temp<=70))&&
   (value.precip_mm===undefined||value.precip_mm===null||
    (Number.isFinite(value.precip_mm)&&value.precip_mm>=0&&value.precip_mm<=300));
 }
 const t=Date.parse(value.issued_at);
 return value.date===today(now)&&Number.isFinite(t)&&t<=now&&now-t<=7*HOUR&&
  Array.isArray(value.hours)&&value.hours.length>0&&value.hours.length<=144&&
  value.hours.every(h=>Number.isFinite(Date.parse(h.at))&&today(Date.parse(h.at))>=value.date&&today(Date.parse(h.at))<=today(now+5*24*HOUR)&&
   ['none','rain','snow','mixed'].includes(h.type)&&
   (h.pop===null||Number.isFinite(h.pop)&&h.pop>=0&&h.pop<=100)&&
   (h.temp===null||Number.isFinite(h.temp)&&h.temp>=-70&&h.temp<=70));
}
export async function weatherSnapshot(kind){
 const now=Date.now();
 if(now-checked>60000){
  checked=now;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{
   const response=await fetch('https://raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/songdo_weather.json?check='+Math.floor(now/60000),
    {headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:controller.signal});
   if(response.ok){
    const text=await response.text();
    if(text.length<=16384){const doc=JSON.parse(text);if(doc?.schema===1)cached=doc}
   }
  }catch(e){}finally{clearTimeout(timer)}
 }
 const value=cached?.[kind];
 return validWeatherSnapshot(value,kind,now)?{...value,transport:'published_snapshot'}:null;
}
