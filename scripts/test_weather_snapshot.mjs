import assert from 'node:assert/strict';
import {weatherSnapshot,validWeatherSnapshot} from '../workers/shared-settings/src/weather-snapshot.mjs';
import {themeWeather} from '../workers/shared-settings/src/theme-weather.mjs';
import {weatherBriefing} from '../workers/shared-settings/src/weather-forecast.mjs';
const now=Date.now(),kst=new Date(now+9*3600000),date=kst.toISOString().slice(0,10);
const hour=new Date(now);hour.setUTCMinutes(0,0,0);
const observed={schema:1,status:'ok',effect:'rain',observed_at:new Date(now-3600000).toISOString(),grid:{nx:55,ny:123},provider:'기상청 초단기실황'};
const forecast={schema:1,status:'ok',date,issued_at:new Date(now-3600000).toISOString(),complete:false,
 hours:[{at:hour.toISOString(),type:'snow',pop:70,temp:0,sky:3}],provider:'기상청 단기예보'};
assert(validWeatherSnapshot(observed,'observed',now));
assert(!validWeatherSnapshot({...observed,grid:{nx:60,ny:127}},'observed',now));
assert(!validWeatherSnapshot(observed,'observed',now+2*3600000));
assert(validWeatherSnapshot(forecast,'forecast',now));
assert(!validWeatherSnapshot({...forecast,date:'2000-01-01'},'forecast',now));
assert(!validWeatherSnapshot({...forecast,issued_at:new Date(now-8*3600000).toISOString()},'forecast',now));
const original=globalThis.fetch;
globalThis.fetch=async url=>{
 const u=new URL(url);
 if(u.hostname==='apis.data.go.kr')throw Error('Synthetic blocked edge route');
 assert.equal(u.hostname,'raw.githubusercontent.com');assert(u.pathname.endsWith('/data/songdo_weather.json'));
 return new Response(JSON.stringify({schema:1,observed,forecast}));
};
try{
 assert.equal((await weatherSnapshot('observed')).effect,'rain');
 const obs=await themeWeather({DATA_GO_KR_SERVICE_KEY:'synthetic-test-only'});
 const fc=await weatherBriefing({DATA_GO_KR_SERVICE_KEY:'synthetic-test-only'});
 assert.equal(obs.status,200);assert.equal(fc.status,200);
 assert.equal((await obs.json()).transport,'published_snapshot');
 assert.equal((await fc.json()).hours[0].temp,0);
}finally{globalThis.fetch=original}
console.log('Official weather fallback passed: edge access failure, same verified source, zero temperature, stale rejection and fixed Songdo grid.');
