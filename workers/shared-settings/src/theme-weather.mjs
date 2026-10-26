export {weatherBriefing} from './weather-forecast.mjs';
import {normalizeKmaKey} from './kma-key.mjs';
import {weatherSnapshot} from './weather-snapshot.mjs';
/* Fixed Songdo grid. Official observed precipitation only; no user location,
   forecasts, customer data or credentials are returned. */
const HEAD={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:HEAD});
let cached=null,inflight=null,retryAfter=0;
export function fromKma(doc,now=Date.now()){
 const reply=doc?.response;
 if(String(reply?.header?.resultCode)!=='00')throw Error('provider_unavailable');
 const rows=reply?.body?.items?.item;
 if(!Array.isArray(rows))throw Error('invalid_weather');
 const item=rows.find(x=>x.category==='PTY'&&Number(x.nx)===55&&Number(x.ny)===123);
 const code=Number(item?.obsrValue);
 if(!item||item.obsrValue===''||!['0','1','2','3','5','6','7'].includes(String(item.obsrValue))||
  !/^\d{8}$/.test(item.baseDate)||!/^\d{4}$/.test(item.baseTime))throw Error('invalid_weather');
 const d=item.baseDate,t=item.baseTime;
 const iso=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+'T'+t.slice(0,2)+':'+t.slice(2)+':00+09:00';
 const stamp=Date.parse(iso);
 if(!Number.isFinite(stamp)||now-stamp>7200000||stamp-now>300000)throw Error('stale_weather');
 // KMA delivers measured temperature as T1H in the SAME observation batch
 // as precipitation PTY. Previously T1H was dropped, leaving "checking temp"
 // on screen despite successful observations.
 const measured=rows.find(x=>x.category==='T1H'&&Number(x.nx)===55&&Number(x.ny)===123&&
  x.baseDate===d&&x.baseTime===t);
 const raw=String(measured?.obsrValue??'').trim();
 const temp=raw!==''&&Number.isFinite(Number(raw))&&Number(raw)>=-70&&Number(raw)<=70?
  Number(raw):null;
 return {schema:1,status:'ok',effect:[2,3,6,7].includes(code)?'snow':[1,5].includes(code)?'rain':'none',
  temp,observed_at:iso,provider:'기상청 초단기실황',area:'송도',grid:{nx:55,ny:123},
  source_url:'https://www.data.go.kr/data/15084084/openapi.do'};
}
async function collect(secret){
 const now=Date.now(),base=new Date(now+9*3600000-40*60000);
 for(let back=0;back<2;back++){
  const dt=new Date(base.getTime()-back*3600000),date=dt.toISOString().slice(0,10).replace(/-/g,''),time=String(dt.getUTCHours()).padStart(2,'0')+'00';
  const url=new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst');
  url.search=new URLSearchParams({serviceKey:normalizeKmaKey(secret),pageNo:'1',numOfRows:'20',dataType:'JSON',base_date:date,base_time:time,nx:'55',ny:'123'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{
   const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; FirstHyundaiWeather/1.0)'},signal:controller.signal});
   if(!r.ok)throw Error('provider_unavailable');
   const doc=await r.json();
   if(String(doc?.response?.header?.resultCode)==='03'&&back===0)continue;
   return fromKma(doc,now);
  }finally{clearTimeout(timer)}
 }
 throw Error('provider_unavailable');
}
export async function themeWeather(env){
 if(!env.DATA_GO_KR_SERVICE_KEY){const fallback=await weatherSnapshot('observed');return fallback?response(fallback):response({status:'unavailable',reason:'weather_service_not_connected'},503);}
 const now=Date.now();
 if(cached&&now-cached.at<600000)return response(cached.value);
 if(now<retryAfter){const fallback=await weatherSnapshot('observed');return fallback?response(fallback):response({status:'unavailable',reason:'weather_service_unavailable'},503);}
 try{
  if(!inflight)inflight=collect(env.DATA_GO_KR_SERVICE_KEY).then(value=>{cached={at:Date.now(),value};return value}).finally(()=>{inflight=null});
  return response(await inflight);
 }catch(e){
  retryAfter=Date.now()+60000;
  const fallback=await weatherSnapshot('observed');
  if(fallback){cached={at:Date.now(),value:fallback};return response(fallback)}
  // Never return an old rain/snow flag as if it were current, nor log provider URLs.
  return response({status:'unavailable',reason:'weather_service_unavailable'},503);
 }
}

