'use strict';
/* The unified, conditional daily briefing replaces the old v2.0.47 five-card layout.
   Guard essential links and data states without recreating obsolete summary blocks. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
const css=fs.readFileSync(path.join(root,'app/src/main/assets/weather-briefing.css'),'utf8');
assert(script);new vm.Script(script);
const start=html.indexOf('<div id="overview"'),end=html.indexOf('<div id="officeBoard"');
assert(start>=0&&end>start,'Unified overview exists before shared notes');
const overview=html.slice(start,end);
let previous=-1;
for(const term of ['id="overviewWeatherMessage"','id="overviewPrecipitation"',
 'id="overviewMapAlert"','id="overviewMemoBriefing"',
 'id="overviewSongdoNews"','id="overviewTodayNewTrade"','id="overviewNewQuickCount"']){
 const next=overview.indexOf(term);
 assert(next>previous,'Weather, notices, agenda and trade follow task order: '+term);
 previous=next;
}
for(const term of ['id="overviewUnified"','id="overviewWeatherDate"',
 'id="overviewWeatherSource"','id="overviewMemoEntries"',
 'onclick="FirstHyundaiOfficeBoard.openBriefingCalendar()"',
 'onclick="openTodayNewTrades()"','onclick="refreshAll(true)"'])
 assert(overview.includes(term),'Essential unified briefing element missing: '+term);
assert(/id="overviewMemoBriefing"[^>]*hidden/.test(overview),'No empty schedule box');
assert(/id="overviewTodayNewTrade"[^>]*hidden/.test(overview),'No empty new-trade box');
for(const id of ['overviewPrecipitation','overviewMapAlert'])
 assert(new RegExp('id="'+id+'"[^>]*hidden').test(overview),'No empty rain/snow boxes: '+id);
assert(!overview.includes('id="overviewMapCaution"'),'Never show speculative map-box forecast warnings');
assert(!overview.includes('id="overviewStatsTitle"'),'No old static statistics panel');
assert(!overview.includes('id="overviewNextTitle"'),'No old hardcoded shortcut list');
assert(css.includes('.overviewBriefLine')||html.includes('overviewBriefLine'),'Important alert layout remains styled');
const contracts=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="contracts"')+4000);
for(const term of ['id="ct_rough"','FirstHyundaiEasy.compose()','id="ct_reviewDetails"'])
 assert(contracts.includes(term),'Contract flow unexpectedly removed: '+term);
assert(html.includes('id="tradeActiveSummary" class="tradeActiveSummary hidden"'),
 'Filtered trade context remains available, but initially hidden');
const render=script.slice(script.indexOf('function renderOverview(){'),script.indexOf('// National trade snapshots'));
assert(render.startsWith('function renderOverview(){'),'Daily trade count renderer exists');
const nodes=new Map();
const element=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,value:''});return nodes.get(id)};
const context=vm.createContext({$:element,number:x=>Number(x||0).toLocaleString('ko-KR'),
 kstDateOffset:()=> '2026-10-26',remote:{new_trades:null}});
vm.runInContext(render,context);
context.renderOverview();
assert.equal(element('overviewTodayNewTrade').hidden,true,'No trade means no extra notice');
context.remote.new_trades={state:'complete',records:[]};
context.renderOverview();
assert.equal(element('overviewTodayNewTrade').hidden,true,'Verified zero means hidden notice');
context.remote.new_trades={state:'complete',records:[
 {first_seen_date:'2026-10-26'},{first_seen_date:'2026-10-26'},
 {first_seen_date:'2026-10-25'}]};
context.renderOverview();
assert.equal(element('overviewTodayNewTrade').hidden,false);
assert.equal(element('overviewNewQuickCount').textContent,'2건');
context.remote.new_trades={state:'not_started',records:[]};
context.renderOverview();
assert.equal(element('overviewTodayNewTrade').hidden,true,'Unverified feed never claims new trades');
const nav=script.slice(script.indexOf('function openTodayNewTrades(){'),script.indexOf('function renderNew(){'));
assert(nav.startsWith('function openTodayNewTrades(){'));
const controls=Object.fromEntries(['newType','newFavoriteFilter','newAptFilter','newDate']
 .map(id=>[id,{value:'old'}]));
const navCtx=vm.createContext({$:id=>controls[id],kstDateOffset:()=> '2026-10-26',
 newAlertFocusIds:new Set(['old']),switchPage:id=>{navCtx.route=id;},renderNew:()=>{navCtx.rendered=true;}});
vm.runInContext(nav,navCtx);navCtx.openTodayNewTrades();
assert.equal(navCtx.route,'new');
for(const id of ['newType','newFavoriteFilter','newAptFilter'])assert.equal(controls[id].value,'');
assert.equal(controls.newDate.value,'2026-10-26');
assert.equal(navCtx.newAlertFocusIds,null);
console.log('Conditional unified briefing, present weather, optional notices, verified new trades, navigation and contract preservation passed.');
