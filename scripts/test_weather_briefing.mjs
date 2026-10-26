import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {forecastBase,parseForecast,weatherBriefing} from '../workers/shared-settings/src/weather-forecast.mjs';
const now=Date.parse('2026-10-26T15:35:00+09:00'),base={date:'20261026',time:'1400'};
const rows=[];
const row=(hour,category,fcstValue,date='20261026')=>({
 nx:55,ny:123,baseDate:base.date,baseTime:base.time,
 fcstDate:date,fcstTime:String(hour).padStart(2,'0')+'00',category,fcstValue
});
for(let hour=15;hour<24;hour++){
 rows.push(row(hour,'PTY',hour===16||hour===17?'1':hour===20?'3':'0'));
 rows.push(row(hour,'POP',hour===16?'70':'10'));
 rows.push(row(hour,'TMP',hour===15?'0':'10'));
}
rows.push(row(18,'SKY','4'));
rows.push(row(19,'SKY','1'));
rows.push(row(21,'SKY','3'));
rows.push(row(1,'PTY','1','20261027'));
const doc={response:{header:{resultCode:'00'},body:{items:{item:rows}}}};
const parsed=parseForecast(doc,base,now);
assert.equal(parsed.hours.length,10,'Next-day hourly forecast is retained');
assert.equal(parsed.complete,true);
assert.equal(parsed.hours[0].temp,0,'Zero degrees is a real value');
assert.equal(parsed.hours.filter(h=>h.at.startsWith('2026-10-26')).length,9);
assert.equal(parsed.hours.filter(h=>h.at.startsWith('2026-10-27')).length,1);
assert.deepEqual(forecastBase(Date.parse('2026-10-26T00:05:00+09:00')),{date:'20261025',time:'2300'});
assert.deepEqual(forecastBase(now),base);
assert.throws(()=>parseForecast(doc,base,now+8*3600000));
assert.throws(()=>parseForecast({response:{header:{resultCode:'30'}}},base,now));
const partial=structuredClone(doc);
partial.response.body.items.item=rows.filter(r=>r.fcstTime!=='1900');
assert.equal(parseForecast(partial,base,now).complete,false);
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('Offline test fixture')};
try{assert.equal((await weatherBriefing({})).status,503);}
finally{globalThis.fetch=originalFetch}
const nodes=new Map();
const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false});return nodes.get(id)};
const ctx={Date,AbortController,setTimeout,clearTimeout,
 window:{setInterval(){}},document:{hidden:true,getElementById:get,addEventListener(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/weather-briefing.js','utf8'),ctx);
const api=ctx.window.FirstHyundaiWeatherBriefing._test;
assert(api.valid(parsed,now));
assert.equal(parsed.hours.find(h=>h.at.startsWith('2026-10-26T18')).sky,4,'Official KMA SKY codes are preserved');
const hourly=api.hourlyRows(parsed,now);
assert.equal(hourly.length,9,'Current partial hour is skipped; do not manufacture missing hours');
assert(hourly[0].at.includes('T16:00'),'Start at next full forecast hour');
assert.equal(api.hourlyRows(parsed,now,3).length,3,'Limited weather cards stay compact');
assert.equal(api.hourlyRows(null,now).length,0,'Unavailable forecast must not show mock values');
assert.equal(api.hourlyCondition({type:'none',sky:1}).kind,'sun','Sunny icon only with official forecast SKY');
assert.equal(api.hourlyCondition({type:'none',sky:3}).kind,'partly-cloudy');
assert.equal(api.hourlyCondition({type:'none',sky:4}).kind,'cloud');
assert.equal(api.hourlyCondition({type:'none'}).kind,'unknown','Unknown SKY must not be called sunny');
assert.equal(api.hourlyCondition({type:'rain',sky:1}).kind,'rain','Forecast precipitation overrides SKY');
assert.equal(api.hourlyCondition({type:'mixed'}).kind,'mixed');
const cards=api.hourlyCards(parsed,now,12);
assert.equal(cards[0].hour,'16시');
assert.equal(cards[0].day,'오늘');
assert.equal(cards[0].kind,'rain');
assert.equal(cards[0].chance,'70%');
assert.equal(cards[0].temp,'10°');
assert(cards.some(h=>h.hour==='18시'&&h.kind==='cloud'));
assert(cards.some(h=>h.hour==='19시'&&h.kind==='sun'));
assert(cards.some(h=>h.hour==='21시'&&h.kind==='partly-cloudy'));
assert(cards.some(h=>h.day==='내일'&&h.hour==='01시'&&h.kind==='rain'));
assert.equal(api.hourlyCards(parsed,now,12).length,new Set(cards.map(x=>x.day+x.hour)).size,
 'No duplicated time slots');
const partialTemps={...parsed,hours:parsed.hours.map(h=>({...h,temp:null,pop:null}))};
assert.equal(api.hourlyCards(partialTemps,now)[0].temp,'—');
assert.equal(api.hourlyCards(partialTemps,now)[0].chance,'—','Unknown POP is not 0%');
const hourlyMarkup=fs.readFileSync('app/src/main/assets/index.html','utf8');
const hourlyCss=fs.readFileSync('app/src/main/assets/weather-briefing.css','utf8');
for(const id of ['overviewHourlyToggle','overviewHourlyDetail','overviewHourlyList','overviewHourlyMeta','overviewHourlyNotice'])
 assert(hourlyMarkup.includes('id="'+id+'"'),id+' is missing from the actual dashboard');
assert(hourlyMarkup.includes('aria-controls="overviewHourlyDetail"')&&hourlyMarkup.includes('aria-expanded="false"'),
 'Hourly detail must be optional and accessible');
assert(hourlyMarkup.includes('class="overviewHourlyDetail" hidden'),'Hourly forecast must default closed');
assert(hourlyCss.includes('.overviewHourlyList')&&hourlyCss.includes('overflow-x:auto'),
 'Full next 12 hours are scrollable without turning the home screen into a long list');
assert.equal(ctx.window.FirstHyundaiWeatherBriefing.toggleHourly(),true,'User tap expands on-demand weather');
assert.equal(get('overviewHourlyDetail').hidden,false);
assert(get('overviewHourlyNotice').textContent.includes('확인할 수 없습니다'),
 'Missing forecast should explain unavailability, not invent values');
assert.equal(ctx.window.FirstHyundaiWeatherBriefing.toggleHourly(),false,'Second tap closes detail');
assert.equal(get('overviewHourlyDetail').hidden,true);

const result=api.summarize(parsed,now);
assert(result.precip.includes('오늘 오후 4시')&&result.precip.includes('비 예보'),result.precip);
assert(result.mapAlert.includes('눈 예보')&&result.mapAlert.includes('지도함'),result.mapAlert);
assert(result.mapAlert.includes('내일 오전 9시'),result.mapAlert);
assert.equal(result.coverage,false,'Incomplete overnight forecast must be acknowledged');
assert(!('mapCaution' in result),'Do not render missing-forecast explanations');
const at=Date.parse('2026-10-26T16:10:00+09:00');
assert(api.summarize(parsed,at).mapAlert.includes('지도함'),
 'Verified precipitation must produce the map-box action');
const none={...parsed,hours:parsed.hours.map(h=>({...h,type:'none',pop:10}))};
assert.equal(api.summarize(none,now).precip,'','No irrelevant dry-weather line');
assert.equal(api.summarize(none,now).mapAlert,'');
assert.equal(api.summarize(none,at).mapAlert,'',
 'Incomplete dry forecast should not produce an unverified map-box action');
const wetProbability={...none,hours:none.hours.map(h=>({...h,pop:90}))};
assert.equal(api.summarize(wetProbability,now).precip,'',
 'Probability alone must not be misreported as confirmed rain');
assert(!api.valid(parsed,Date.parse('2026-10-27T00:01:00+09:00')),'Stale dates invalid');
assert.equal(api.summarize(null,now).precip,'','No invented precipitation');
assert.equal(api.summarize(null,now).mapAlert,'','No invented map-box warning');
const evening=Date.parse('2026-10-26T20:35:00+09:00');
const observedAt='2026-10-26T20:00:00+09:00';
const obs={status:'ok',temp:16.4,effect:'none',observed_at:observedAt};
assert.equal(api.weatherDisplay(obs,null,evening).text,'16.4°',
 'Show measured current temperature, do not repeat redundant dry status');
assert.equal(api.weatherDisplay(obs,null,evening).kind,'temperature',
 'Do not invent clear/sunny weather from temperature-only observation');
assert.equal(api.weatherDisplay({...obs,effect:'rain'},null,evening).kind,'rain');
assert.equal(api.weatherDisplay({...obs,effect:'snow'},null,evening).kind,'snow');
assert.equal(api.weatherDisplay(null,null,evening,false).kind,'temperature',
 'Unknown weather should use a neutral thermometer icon');
const briefingHtml=fs.readFileSync('app/src/main/assets/index.html','utf8');
const briefingCss=fs.readFileSync('app/src/main/assets/weather-briefing.css','utf8');
const overview=briefingHtml.slice(briefingHtml.indexOf('<div id="overview" class="page">'),briefingHtml.indexOf('<div id="officeBoard" class="page hidden">'));
const title=overview.indexOf('<h2>오늘의 업무 브리핑</h2>');
const date=overview.indexOf('id="overviewWeatherDate"');
const card=overview.indexOf('id="overviewUnified"');
assert(title>=0&&date>title&&card>date,'Daily date goes directly below briefing heading, outside the weather card');
assert.equal((overview.match(/id="overviewWeatherDate"/g)||[]).length,1,'Exactly one briefing calendar date');
assert(overview.includes('overviewWeatherThermometer')&&overview.includes('overviewWeatherRain')&&overview.includes('overviewWeatherSnow'),
 'Weather icons are condition-specific vector artwork, not the previous large emoji');
assert(briefingCss.includes('.overviewBriefDate')&&briefingCss.includes('.overviewWeatherGlyph'),
 'Modern heading date and glyph typography styles are present');

assert(api.weatherDisplay(obs,null,evening).source.includes('기상청 실황'),
 'Measured weather needs a clear observation label');
assert.equal(api.weatherDisplay({...obs,temp:null},16,evening).text,'예보기온 16°',
 'Use hourly forecast only with explicit forecast labeling');
assert(api.weatherDisplay({...obs,temp:null},16,evening).source.includes('기온은 시간별 예보'));
assert(api.weatherDisplay({...obs,effect:'rain'},null,evening).text.includes('현재 비'));
assert(api.weatherDisplay({...obs,effect:'snow'},null,evening).text.includes('현재 눈'));
assert(!api.weatherDisplay(obs,null,evening).text.includes('비·눈 없음'),
 'No unnecessary dry-weather disclaimer');
assert.equal(api.weatherDisplay({...obs,temp:null},null,evening).text,'기온 정보 없음',
 'Missing measured temperature cannot remain an endless spinner');
assert.equal(api.weatherDisplay(null,null,evening,false).text,'현재 날씨 확인 불가');
assert(api.weatherDisplay(null,16,evening).source.includes('강수 실황 확인 중'),
 'Hourly temperature forecast must never masquerade as a precipitation observation');
assert.equal(api.summarize(null,evening).mapAlert,'',
 'Unknown forecast must stay silent, never invent a map-box action');
assert(!api.summarize(null,evening).mapAlert,'Unknown weather must never fabricate rain');
assert.equal(api.summarize(null,Date.parse('2026-11-14T18:30:00+09:00')).mapAlert,'',
 'Closed Saturday should not raise an unconfirmed map-box notice');
assert.equal(api.summarize(null,now).mapAlert,'',
 'Unconfirmed forecasts never trigger action');
assert(api.isClosed('2026-11-01'),'All Sundays closed');
assert(api.isClosed('2026-11-14'),'Second Saturday closed');
assert(api.isClosed('2026-11-28'),'Fourth Saturday closed');
assert(!api.isClosed('2026-11-07'),'First Saturday open');
assert(!api.isClosed('2026-11-21'),'Third Saturday open');
const fri=Date.parse('2026-11-13T18:30:00+09:00');
assert.equal(api.nextOpen(fri).date,'2026-11-16','Second Friday must forecast through Monday');
const sat=Date.parse('2026-11-07T18:30:00+09:00');
assert.equal(api.nextOpen(sat).date,'2026-11-09','Working Saturday must forecast through Monday');
assert.equal(api.nextOpen(fri,['2026-11-16']).date,'2026-11-17','Shared full-day closure extends horizon');
function hourlyForecast(reference,through,wetTime=null,type='rain'){
 const hours=[];
 const start=Math.floor(reference/3600000)*3600000;
 for(let t=start;t<through;t+=3600000){
  hours.push({at:new Date(t).toISOString(),type:t===wetTime?type:'none',pop:0,temp:0});
 }
 return {schema:1,status:'ok',date:new Date(reference+9*3600000).toISOString().slice(0,10),
  issued_at:new Date(reference-3600000).toISOString(),hours};
}
const monday=Date.parse('2026-11-16T09:00:00+09:00');
const saturdayRain=Date.parse('2026-11-14T10:00:00+09:00');
const holidayDoc=hourlyForecast(fri,monday,saturdayRain);
assert(api.valid(holidayDoc,fri));
const weekendView=api.summarize(holidayDoc,fri);
assert.equal(weekendView.precip,'','Saturday rain is not presented as Friday rain');
assert(weekendView.mapAlert.includes('지도함')&&weekendView.mapAlert.includes('11/16'),
 'Second Friday rain on closed Saturday still needs Friday evening action');
assert.equal(weekendView.coverage,true,'Full long-weekend forecast covers next opening');
const mondayAfterSat=Date.parse('2026-11-09T09:00:00+09:00');
const sundaySnow=Date.parse('2026-11-08T13:00:00+09:00');
const saturdayDoc=hourlyForecast(sat,mondayAfterSat,sundaySnow,'snow');
assert(api.summarize(saturdayDoc,sat).mapAlert.includes('눈 예보'),
 'Working Saturday must cover Sunday through Monday morning');
const tuesday=Date.parse('2026-11-17T09:00:00+09:00');
const holidayExtended=hourlyForecast(fri,tuesday,Date.parse('2026-11-16T13:00:00+09:00'));
assert(api.summarize(holidayExtended,fri,['2026-11-16']).mapAlert.includes('11/17'),
 'Explicit shared closure extends Monday handover through Tuesday');
console.log('Unified conditional briefing passed: observed vs forecast, dry/uncertain, 2nd/4th Saturdays, Sunday, holiday, verified rain/snow and next 9 AM.');
