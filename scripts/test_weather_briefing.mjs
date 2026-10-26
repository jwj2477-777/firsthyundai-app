import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {forecastBase,parseForecast,weatherBriefing} from '../workers/shared-settings/src/weather-forecast.mjs';
const now=Date.parse('2026-10-26T15:35:00+09:00'),base={date:'20261026',time:'1400'};
const rows=[];
function row(hour,category,fcstValue,date='20261026'){return {nx:55,ny:123,baseDate:base.date,baseTime:base.time,fcstDate:date,fcstTime:String(hour).padStart(2,'0')+'00',category,fcstValue}}
for(let hour=15;hour<24;hour++){
 rows.push(row(hour,'PTY',hour===16||hour===17?'1':hour===20?'3':'0'));
 rows.push(row(hour,'POP',hour===16?'70':'10'));rows.push(row(hour,'TMP',hour===15?'0':'10'));
}
rows.push(row(1,'PTY','1','20261027'));
const doc={response:{header:{resultCode:'00'},body:{items:{item:rows}}}};
const parsed=parseForecast(doc,base,now);
assert.equal(parsed.hours.length,9);assert.equal(parsed.complete,true);assert.equal(parsed.hours[0].temp,0);
assert(parsed.hours.every(h=>h.at.startsWith('2026-10-26')));
assert.deepEqual(forecastBase(Date.parse('2026-10-26T00:05:00+09:00')),{date:'20261025',time:'2300'});
assert.deepEqual(forecastBase(now),base);
assert.throws(()=>parseForecast(doc,base,now+8*3600000));
assert.throws(()=>parseForecast({response:{header:{resultCode:'30'}}},base,now));
const partial=structuredClone(doc);partial.response.body.items.item=rows.filter(r=>r.fcstTime!=='1900');
assert.equal(parseForecast(partial,base,now).complete,false);
const offlineFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Offline test fixture')};
try{assert.equal((await weatherBriefing({})).status,503);}finally{globalThis.fetch=offlineFetch}
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false});return nodes.get(id)};
const ctx={Date,AbortController,setTimeout,clearTimeout,window:{setInterval(){}},document:{hidden:true,getElementById:get,addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/weather-briefing.js','utf8'),ctx);
const api=ctx.window.FirstHyundaiWeatherBriefing._test;
assert(api.valid(parsed,now));const view=api.summarize(parsed,now);
assert.equal(view.main,'오늘 오후 4시경부터 비 예보가 있습니다.');
assert(view.extra.includes('오후 8시경부터 눈'));assert(view.extra.includes('0°'),'Zero is a valid forecast temperature');
const current=api.summarize(parsed,Date.parse('2026-10-26T16:10:00+09:00'));
assert(current.main.includes('지금 시간대에')&&current.main.includes('예보'),'Does not call a forecast an observation');
const none={...parsed,hours:parsed.hours.map(h=>({...h,type:'none',pop:10}))};
assert(api.summarize(none,now).main.includes('남은 시간'));
const gaps={...none,complete:false,hours:none.hours.filter(h=>!h.at.includes('19:00'))};
assert(!api.summarize(gaps,now).main.includes('남은 시간'));
assert(api.summarize({...none,hours:none.hours.map(h=>({...h,pop:60}))},now).main.includes('60%'));
assert(!api.valid(parsed,Date.parse('2026-10-27T00:01:00+09:00')),'No yesterday-as-today');
assert(api.summarize(null,now).main.includes('확인할 수 없습니다'));
console.log('Weather briefing passed: official hourly rain/snow, KST/day rollover, gaps, stale sources, 0°C, probability and observation separation.');
