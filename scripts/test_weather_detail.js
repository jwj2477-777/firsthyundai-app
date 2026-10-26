'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'weather-detail.css'),'utf8');
const code=fs.readFileSync(path.join(root,'weather-detail.js'),'utf8');
const boardSource=fs.readFileSync(path.join(root,'office-board.js'),'utf8');
const weatherSource=fs.readFileSync(path.join(root,'weather-briefing.js'),'utf8');
new vm.Script(code);new vm.Script(boardSource);
for(const id of ['fhdWeatherDialog','weatherDetailEntry','fhdWeatherTemp','fhdWeatherHeroIcon','fhdWeatherSummary',
'fhdWeatherHighLow','fhdWeatherChart','fhdWeatherOfficeAlert','fhdWeatherSchedule','fhdWeatherClose'])
 assert(html.includes('id="'+id+'"'),'Missing weather-detail UI: '+id);
assert(html.includes('aria-modal="true" aria-label="송도 상세 날씨" aria-hidden="true" hidden'));
assert(html.includes('onclick="FirstHyundaiWeatherDetail.open()"'),'Briefing one-tap route missing');
assert(html.includes('<script src="weather-detail.js"></script></body>'),'Weather detail must load after office board');
assert(html.includes('<link rel="stylesheet" href="weather-detail.css">'),'Detail stylesheet missing');
assert(css.includes('.fhdWeatherPlot')&&css.includes('overflow-x:auto'),'Forecast graph must be touch scrollable');
assert(css.includes('.fhdWeatherDialog[hidden]'),'Weather detail cannot cover dashboard when closed');
assert(!/localStorage|sessionStorage|\bfetch\(/.test(code),'Weather detail must not save private notes or add unverified APIs');
assert(boardSource.includes('weatherAppointments,')&&!boardSource.includes('window.firstHyundaiPrivateNotes'));
const timestamp=Date.parse('2026-10-27T02:30:00+09:00');
const date='2026-10-27',issued=new Date(timestamp-3600000).toISOString();
const hours=Array.from({length:26},(_,i)=>({
 at:new Date(timestamp+1800000+i*3600000).toISOString(),
 temp:10+(i%7),pop:i===4?75:10,type:i===4?'rain':'none',sky:i===4?4:i%2?1:3
}));
const forecast={schema:1,status:'ok',date,issued_at:issued,hours};
const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{id,hidden:id==='fhdWeatherDialog',textContent:'',innerHTML:'',
  attrs:{},isConnected:true,setAttribute(k,v){this.attrs[k]=v},
  classList:{add(){},remove(){}},focus(){this.focused=true},querySelectorAll(){return []}});
 return elements.get(id);
}
const events=new Map(),classActions=[],callCounts={refresh:0,openBriefing:0,calendar:0};
const body={classList:{add(x){classActions.push('add '+x)},remove(x){classActions.push('remove '+x)}}};
const DateFake=class extends Date{constructor(...args){super(...(args.length?args:[timestamp]))}static now(){return timestamp}};
const context=vm.createContext({Date:DateFake,Intl,Math,Number,Array,String,Set,Map,Promise,
 AbortController,setTimeout,clearTimeout,window:{setInterval(){},FirstHyundaiThemes:{
 currentWeather:()=>({status:'ok',temp:15.2,effect:'none',observed_at:new Date(timestamp-1800000).toISOString()})}},
 document:{hidden:true,body,activeElement:{focus(){this.returned=true},isConnected:true},
 getElementById:el,addEventListener(t,h){events.set(t,h)}}});
vm.runInContext(weatherSource,context);
const impl=context.window.FirstHyundaiWeatherBriefing._test;
context.window.FirstHyundaiWeatherBriefing={
 _test:impl,forecast:()=>forecast,refresh(){callCounts.refresh++},
 forecastStatus:()=>({mapAlert:'퇴근 후 비 예보 · 다음 영업일 오전 9시 전 지도함을 실내로 옮기세요.'})
};
context.window.FirstHyundaiOfficeBoard={
 weatherAppointments:()=>[{at:new Date(timestamp+4.5*3600000).toISOString()}],
 openBriefing(){callCounts.openBriefing++},openBriefingCalendar(){callCounts.calendar++}};
vm.runInContext(code,context);
const api=context.window.FirstHyundaiWeatherDetail;
assert(api._test.labelTime(hours[0].at,timestamp).startsWith('오늘 '));
assert.equal(api._test.rangeStats(forecast,timestamp).complete,true,'24 contiguous hours should be identifiable');
assert.equal(api._test.rangeStats({hours:hours.slice(0,7)},timestamp).complete,false);
assert(api._test.nextSummary(forecast,timestamp).includes('비')&&api._test.nextSummary(forecast,timestamp).includes('경'));
const graph=api._test.chartMarkup(forecast,timestamp);
assert(graph.markup.includes('fhdWeatherPlot')&&graph.markup.includes('<circle'),'Graph has numeric forecast points');
assert(graph.markup.includes('stroke="#5A968D"'),'Graph connects verified contiguous values');
assert(!graph.markup.includes('<script'),'KMA values must not inject markup');
assert.equal(api._test.chartMarkup(null,timestamp).markup,'','No graph with missing forecast');
const sparse={...forecast,hours:[hours[0],hours[1],hours[4]]};
const sparseGraph=api._test.chartMarkup(sparse,timestamp);
assert.equal((sparseGraph.markup.match(/stroke="#5A968D"/g)||[]).length,1,
 'Do not join absent middle forecast hours with misleading continuous lines');
const one=api._test.appointments(forecast,timestamp,[{at:new Date(timestamp+4.5*3600000).toISOString(),text:'고객 전화 010-1111-2222'}]);
assert.equal(one.length,1);
assert(!JSON.stringify(one).includes('고객')&&!JSON.stringify(one).includes('010-'),'Private note names and phones never reach weather detail');
assert(one[0].forecast.includes('비 예보')&&one[0].forecast.includes('75%'));
assert.equal(api.open(),true);
assert.equal(el('fhdWeatherDialog').hidden,false);
assert.equal(el('fhdWeatherDialog').attrs['aria-hidden'],'false');
assert.equal(el('fhdWeatherTemp').textContent,'15.2°');
assert(el('fhdWeatherHighLow').textContent.includes('최고'));
assert(el('fhdWeatherChart').innerHTML.includes('fhdWeatherHour'));
assert(el('fhdWeatherOfficeAlert').textContent.includes('지도함'));
assert(el('fhdWeatherSchedule').innerHTML.includes('강수 75%'));
assert.equal(callCounts.refresh,1);
assert.equal(callCounts.openBriefing,1);
api.close();
assert.equal(el('fhdWeatherDialog').hidden,true);
assert(classActions.includes('remove fhdWeatherDetailOpen'));
api.open();
events.get('keydown')({key:'Escape',preventDefault(){}});
assert(el('fhdWeatherDialog').hidden,'Escape returns to dashboard');
api.openCalendar();
assert.equal(callCounts.calendar,1,'Private calendar route still functions');
console.log('Weather detail: verified KMA curve, missing-hour gap, office schedule privacy, 24h extremes, keyboard/dismiss routing passed.');
