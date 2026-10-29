import assert from 'node:assert/strict';
import {fromKma,themeWeather} from '../workers/shared-settings/src/theme-weather.mjs';
import {normalizeKmaKey} from '../workers/shared-settings/src/kma-key.mjs';
assert.equal(normalizeKmaKey(' synthetic%2Bkey%2F%3D '),'synthetic+key/=');
assert.equal(normalizeKmaKey('synthetic+key/='),'synthetic+key/=');
const now=Date.parse('2026-10-26T15:00:00+09:00');
const doc=(code='0')=>({response:{header:{resultCode:'00'},body:{items:{item:[{category:'PTY',nx:55,ny:123,baseDate:'20261026',baseTime:'1500',obsrValue:code}]}}}});
for(const [code,effect] of [['0','none'],['1','rain'],['2','snow'],['3','snow'],['5','rain'],['6','snow'],['7','snow']])assert.equal(fromKma(doc(code),now).effect,effect);
assert.equal(fromKma(doc('0'),now).temp,null,'PTY-only data must not invent a measured temperature');
const weatherWithTemp=(value,when='1500')=>{
 const d=doc('0');
 d.response.body.items.item.push({
  category:'T1H',nx:55,ny:123,baseDate:'20261026',baseTime:when,obsrValue:value
 });
 return d;
};
assert.equal(fromKma(weatherWithTemp('17.2'),now).temp,17.2,'Actual T1H is retained');
assert.equal(fromKma(weatherWithTemp('0'),now).temp,0,'Zero °C remains a valid measured value');
assert.equal(fromKma(weatherWithTemp('-2.7'),now).temp,-2.7,'Below-freezing observations remain valid');
assert.equal(fromKma(weatherWithTemp(''),now).temp,null,'Blank temperature cannot become false 0 °C');
assert.equal(fromKma(weatherWithTemp('NaN'),now).temp,null,'Invalid T1H cannot contaminate the UI');
assert.equal(fromKma(weatherWithTemp('12','1400'),now).temp,null,'Do not mix temperatures from other observation hours');
const withRain=(amount,when='1500')=>{
 const d=doc('1');
 d.response.body.items.item.push({category:'RN1',nx:55,ny:123,
  baseDate:'20261026',baseTime:when,obsrValue:amount});
 return d;
};
for(const [amount,mm] of [['0',0],['0.1',.1],['2.5',2.5],['12',12]])
 assert.equal(fromKma(withRain(amount),now).precip_mm,mm);
for(const wrong of ['강수없음','NaN','-1','301','','1mm 미만'])
 assert.equal(fromKma(withRain(wrong),now).precip_mm,null,
  'Cannot invent rain intensity from an unverified RN1 value');
assert.equal(fromKma(withRain('5','1400'),now).precip_mm,null,
 'Reject precipitation from another observation time');
assert.equal(fromKma(doc('1'),now).precip_mm,null,
 'Missing measured precipitation must remain unknown');
for(const value of ['','4','9','NaN'])assert.throws(()=>fromKma(doc(value),now));
assert.throws(()=>fromKma(doc(),now+7200001));
assert.throws(()=>fromKma(doc(),now-300001));
const elsewhere=doc();elsewhere.response.body.items.item[0].nx=60;assert.throws(()=>fromKma(elsewhere,now));
const offlineFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Offline test fixture')};
try{assert.equal((await themeWeather({})).status,503);}finally{globalThis.fetch=offlineFetch}
const original=globalThis.fetch;let calls=0;
globalThis.fetch=async url=>{
 calls++;assert.equal(url.hostname,'apis.data.go.kr');assert.equal(url.searchParams.get('nx'),'55');assert.equal(url.searchParams.get('ny'),'123');
 const local=doc('3'),item=local.response.body.items.item[0];item.baseDate=url.searchParams.get('base_date');item.baseTime=url.searchParams.get('base_time');
 return new Response(JSON.stringify(local));
};
try{
 const answer=await themeWeather({DATA_GO_KR_SERVICE_KEY:'synthetic-test-key'});
 assert.equal(answer.status,200);const content=await answer.json();assert.equal(content.effect,'snow');
 assert(!JSON.stringify(content).includes('synthetic-test-key'));
 assert.equal((await themeWeather({DATA_GO_KR_SERVICE_KEY:'synthetic-test-key'})).status,200);assert.equal(calls,1,'Coalesced 10-minute weather cache');
}finally{globalThis.fetch=original}
console.log('Official theme weather: fixed Songdo grid, PTY validation, mixed snow, freshness, missing approval fallback and secret-free cache passed.');

