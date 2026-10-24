'use strict';
/* v2.0.47: Workflow-first layout pilot; preserve parent-safe navigation and data. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
const overview=html.slice(html.indexOf('<div id="overview"'),html.indexOf('<div id="nearby"'));
const order=['id="overviewNextTitle"','id="overviewNewQuickCount"','id="overviewStatus"','id="overviewStatsTitle"','id="totalDeals"'];
let last=-1;
for(const term of order){const pos=overview.indexOf(term);assert(pos>last,'Action-first order is wrong: '+term);last=pos;}
for(const term of ["onclick=\"openTodayNewTrades()\"","onclick=\"switchPage('nearby')\"",
 "onclick=\"openComplexHome()\"","id=\"totalDeals\"","id=\"saleDeals\"",
 "id=\"rentDeals\"","id=\"newDeals\"","id=\"newsGroups\"",
 "id=\"overviewStatus\"","onclick=\"refreshAll(true)\""])
 assert(overview.includes(term),'Existing metric or new action missing: '+term);
const contracts=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="contracts"')+3900);
assert(contracts.includes('<details class="contractFirstGuide">') &&
 contracts.includes('<summary>작성 방법 보기</summary>') &&
 !contracts.includes('class="contractFirstGuide" open'),
 'Instruction must start collapsed for repeat use');
for(const term of ['id="ct_rough"','FirstHyundaiEasy.compose()',
 'FirstHyundaiContracts.voice()','id="ct_reviewDetails"','contractSteps'])
 assert(contracts.includes(term),'Critical contract form or help lost: '+term);
assert(html.includes('id="tradeActiveSummary" class="tradeActiveSummary hidden"'),
 'Trade context summary hidden by default');
const marker='/* v2.0.47 · REVERSIBLE WORKFLOW PILOT';
const layer=css.slice(css.lastIndexOf(marker));
assert(layer.includes(marker));
for(const selector of ['#overview .overviewActionGrid',
 '#overview .overviewActionCard',
 '#overview .overviewStatusPanel',
 '#overview .overviewStats>h3',
 '#contracts .contractFirstGuide summary',
 '#trades .tradeActiveSummary.hidden'])
 assert(layer.includes(selector),'Missing scoped pilot style '+selector);
assert(/#overview \.overviewActionCard\{[^}]*min-height:86px/.test(layer),'Large task touch area');
assert(/#overview \.overviewActionSecondary\{[^}]*min-height:49px/.test(layer),'Large directory touch area');
assert(/#trades \.tradeActiveSummary.hidden\{display:none\}/.test(layer),'No summary visual noise without filters');
assert(!layer.includes('#nav .primaryNav'),'Core three main navigation stays unchanged');
const methods=script.slice(script.indexOf('function kstDateOffset('),script.indexOf('function renderNew(){'));
const overviewFn=script.slice(script.indexOf('function renderOverview(){'),script.indexOf('// National trade snapshots'));
const summaryFn=script.slice(script.indexOf('function updateTradeActiveSummary(){'),script.indexOf('function renderTrades(){'));
const els=Object.fromEntries(['totalDeals','saleDeals','rentDeals','newsGroups','newDeals',
 'overviewNewQuickCount','overviewStatus','tradeActiveSummary','aptFilter','typeFilter','tradeDateFrom',
 'tradeDateTo','statusFilter','tradesFavoriteFilter','newDate','newType',
 'newFavoriteFilter','newAptFilter'].map(k=>[k,{value:'',textContent:'',innerHTML:'',classList:{
 hidden:false,toggle(key,bool){if(key==='hidden')this.hidden=!!bool;}
 }}]));
const ctx=vm.createContext({
 Date,number:n=>Number(n||0).toLocaleString('ko-KR'),
 escapeHtml:x=>String(x).replace(/</g,'&lt;'),textState:(x,t)=>t+': '+(x?.state||'미수집'),
 $:id=>els[id],issues:{trades:'',new_trades:'',news:''},
 remote:{trades:null,new_trades:null,news:null},
 catalogRows:()=>[{id:'f13',label:'퍼스트파크 13블럭'}],
 areaKey:x=>String(x),tradeFocus:null,tradeMode:'latest',
 selectedTradeBuilding:'',selectedTradeArea:'',newAlertFocusIds:new Set(['old']),
 switchPage:id=>{ctx.route=id;els.newDate.value=ctx.kstDateOffset(0);},
 renderNew:()=>{ctx.renderCount=(ctx.renderCount||0)+1;}
});
vm.runInContext(methods+overviewFn+summaryFn,ctx);
const day=vm.runInContext('kstDateOffset(0)',ctx);
ctx.remote={trades:{state:'complete',records:[{type:'매매'},{type:'전세'}]},
 new_trades:{state:'complete',records:[{first_seen_date:day},{first_seen_date:day},{first_seen_date:'2020-01-01'}]},
 news:{state:'complete',briefs:[{title:'a'}]}};
vm.runInContext('renderOverview()',ctx);
assert.equal(els.overviewNewQuickCount.textContent,'2건');
assert.equal(els.newDeals.textContent,'2');
assert.equal(els.totalDeals.textContent,'2');
assert.equal(els.saleDeals.textContent,'1');
assert.equal(els.rentDeals.textContent,'1');
assert.equal(els.newsGroups.textContent,'1');
ctx.remote.new_trades=null;
vm.runInContext('renderOverview()',ctx);
assert.equal(els.overviewNewQuickCount.textContent,'확인 전');
assert.equal(els.newDeals.textContent,'—');
ctx.remote.new_trades={state:'complete',records:[]};
vm.runInContext('renderOverview()',ctx);
assert.equal(els.overviewNewQuickCount.textContent,'0건','Zero must not be confused with uncollected.');
vm.runInContext('newAlertFocusIds=new Set(["old"])',ctx);
els.newDate.value='2020-01-01';
els.newType.value='전세';els.newFavoriteFilter.value='favorites';els.newAptFilter.value='old';
vm.runInContext('openTodayNewTrades()',ctx);
assert.equal(ctx.route,'new');
assert.equal(els.newDate.value,day);
assert.equal(els.newType.value,'');
assert.equal(els.newFavoriteFilter.value,'');
assert.equal(els.newAptFilter.value,'');
assert.equal(vm.runInContext('newAlertFocusIds',ctx),null);
vm.runInContext('updateTradeActiveSummary()',ctx);
assert.equal(els.tradeActiveSummary.classList.hidden,true);
els.typeFilter.value='전세';els.statusFilter.value='notcancel';
ctx.tradeFocus={id:'f13',area:84.9};vm.runInContext('updateTradeActiveSummary()',ctx);
assert.equal(els.tradeActiveSummary.classList.hidden,false);
assert(els.tradeActiveSummary.textContent.includes('퍼스트파크 13블럭'));
assert(els.tradeActiveSummary.textContent.includes('전세'));
assert(els.tradeActiveSummary.textContent.includes('해제 제외'));
assert(!script.includes('function renderOverview(){let list='),'Overview logic rewritten without changing existing totals');
console.log('v2.0.47 pilot verified: tasks first, real counts, unknown/zero distinction, today navigation reset, filtered-only summary and preserved contract actions.');
