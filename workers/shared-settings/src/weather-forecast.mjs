/* Official hourly forecast for Songdo. Forecasts never activate the observed-weather overlay. */
import {normalizeKmaKey} from './kma-key.mjs';
import {weatherSnapshot} from './weather-snapshot.mjs';
const HOUR=3600000;
const day=ms=>new Date(ms+9*HOUR).toISOString().slice(0,10);
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});
let cached=null,inflight=null,retryAfter=0;
export function forecastBase(now){
 const local=new Date(now+9*HOUR-40*60000);
 const floor=Math.floor((local.getUTCHours()-2)/3)*3+2;
 if(floor<0){local.setUTCDate(local.getUTCDate()-1);local.setUTCHours(23)}else local.setUTCHours(floor);
 return {date:local.toISOString().slice(0,10).replace(/-/g,''),time:String(local.getUTCHours()).padStart(2,'0')+'00'};
}
export function parseForecast(doc,base,now=Date.now()){
 if(String(doc?.response?.header?.resultCode)!=='00')throw Error('forecast_unavailable');
 const items=doc?.response?.body?.items?.item;
 if(!Array.isArray(items))throw Error('invalid_forecast');
 const iso=(d,t)=>d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+'T'+t.slice(0,2)+':'+t.slice(2)+':00+09:00';
 const issued=iso(base.date,base.time),issuedTime=Date.parse(issued);
 if(!Number.isFinite(issuedTime)||now-issuedTime>7*HOUR||issuedTime>now)throw Error('stale_forecast');
 const today=day(now),lastDay=day(now+5*24*HOUR),grouped=new Map();
 for(const row of items){
  if(Number(row.nx)!==55||Number(row.ny)!==123||row.baseDate!==base.date||row.baseTime!==base.time)continue;
  if(!/^\d{8}$/.test(row.fcstDate)||!/^([01]\d|2[0-3])00$/.test(row.fcstTime))continue;
  const at=iso(row.fcstDate,row.fcstTime),time=Date.parse(at);
  if(day(time)<today||day(time)>lastDay||time+HOUR<=now)continue;
  const value=grouped.get(at)||{at};
  if(['PTY','POP','TMP','SKY'].includes(row.category)){
   if(value[row.category]!==undefined&&value[row.category]!==String(row.fcstValue))throw Error('conflicting_forecast');
   value[row.category]=String(row.fcstValue);grouped.set(at,value);
  }
 }
 const numeric=(s,min,max)=>s!==undefined&&s!==''&&Number.isFinite(Number(s))&&Number(s)>=min&&Number(s)<=max?Number(s):null;
 const hours=[...grouped.values()].sort((a,b)=>a.at.localeCompare(b.at)).filter(h=>/^[0-4]$/.test(h.PTY||'')).map(h=>({
  at:h.at,type:{0:'none',1:'rain',2:'mixed',3:'snow',4:'rain'}[h.PTY],
  pop:numeric(h.POP,0,100),temp:numeric(h.TMP,-70,70),sky:numeric(h.SKY,1,4)
 }));
 if(!hours.length)throw Error('no_forecast');
 const expected=24-new Date(now+9*HOUR).getUTCHours();
 const todayHours=hours.filter(h=>day(Date.parse(h.at))===today).length;
 return {schema:1,status:'ok',area:'송도',date:today,issued_at:issued,hours,
  complete:todayHours===expected,coverage_until:hours.at(-1).at,provider:'기상청 단기예보',
  source_url:'https://www.data.go.kr/data/15084084/openapi.do'};
}
export async function weatherBriefing(env){
 if(!env.DATA_GO_KR_SERVICE_KEY){const fallback=await weatherSnapshot('forecast');return fallback?reply(fallback):reply({status:'unavailable',reason:'weather_service_not_connected'},503);}
 const now=Date.now();
 if(cached&&cached.day===day(now)&&now-cached.at<1200000)return reply(cached.value);
 if(now<retryAfter){const fallback=await weatherSnapshot('forecast');return fallback?reply(fallback):reply({status:'unavailable',reason:'forecast_unavailable'},503);}
 try{
  if(!inflight)inflight=(async()=>{
   const base=forecastBase(now),url=new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
   url.search=new URLSearchParams({serviceKey:normalizeKmaKey(env.DATA_GO_KR_SERVICE_KEY),pageNo:'1',numOfRows:'1000',dataType:'JSON',base_date:base.date,base_time:base.time,nx:'55',ny:'123'});
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4500);
   try{
    const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; FirstHyundaiWeather/1.0)'},signal:controller.signal});if(!r.ok)throw Error('forecast_unavailable');
    const value=parseForecast(await r.json(),base,now);cached={at:Date.now(),day:day(now),value};return value;
   }finally{clearTimeout(timeout)}
  })().finally(()=>{inflight=null});
  return reply(await inflight);
 }catch(e){
  retryAfter=Date.now()+60000;const fallback=await weatherSnapshot('forecast');
  if(fallback){cached={at:Date.now(),day:day(Date.now()),value:fallback};return reply(fallback)}
  return reply({status:'unavailable',reason:'forecast_unavailable'},503);
 }
}
