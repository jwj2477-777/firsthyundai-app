// v2.0.35: compact, truthful transaction and apartment catalog summaries.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script,'inline app code required');
new vm.Script(script);
assert(html.includes('id="nearbyPeriod"'),'Collection window must be visible beside favorites');
assert(html.includes('id="nearbyCards"')&&html.includes('id="complexCards"'));
for(const selector of [
 '#nearby #nearbyCards.nearbyGrid',
 '#nearby #nearbyCards .nearbyCard.favoriteSummaryCard',
 '#complexes #complexCards.nearbyGrid',
 '#complexes #complexCards .nearbyCard.complexSummaryCard',
 '.complexSummaryAddress',
 '.favoriteCardDate'
])assert(css.includes(selector),'Compact card style missing: '+selector);
const mapping=script.slice(script.indexOf('/* FAVORITES_MAPPING_START:'),script.indexOf('/* FAVORITES_MAPPING_END */')+'/* FAVORITES_MAPPING_END */'.length);
const display=script.slice(script.indexOf('function favoriteCollectionScope('),script.indexOf('function renderNearbyDetails('));
const ctx={
 remote:{trades:{state:'ok',checked_at:'2026-10-24T02:00:00+09:00',records:[
  {building:'송도더샵퍼스트파크F13-1BL',contract_date:'2026-10-10'},
  {building:'송도더샵퍼스트파크F13-1BL',contract_date:'2026-10-20'},
  {building:'송도더샵마스터뷰21BL',contract_date:'2026-09-30'}
 ]}},
 nearbySelected:'all',
 elements:new Map(),
 number:x=>Number(x).toLocaleString('ko-KR'),
 escapeHtml:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 renderNearbyDetails:()=>{}
};
ctx.$=id=>{
 if(!ctx.elements.has(id))ctx.elements.set(id,{
  textContent:'',innerHTML:'',classList:{toggle:()=>{}},
  setAttribute:()=>{}
 });
 return ctx.elements.get(id);
};
ctx.nearbyAllRows=()=>ctx.remote.trades.records.filter(rec=>ctx.favoriteIdForBuilding(rec.building));
vm.createContext(ctx);
vm.runInContext(mapping,ctx);
vm.runInContext('globalThis.favoriteIdForBuilding=favoriteIdForBuilding',ctx);
vm.runInContext(display,ctx);
vm.runInContext('renderNearby()',ctx);
assert.equal((ctx.$('nearbyCards').innerHTML.match(/class="nearbyCard favoriteSummaryCard/g)||[]).length,14);
assert(!ctx.$('nearbyCards').innerHTML.includes('주변 핵심단지'),'Redundant category text must not appear on cards');
assert(ctx.$('nearbyCards').innerHTML.includes('퍼스트파크 13블럭'));
assert(ctx.$('nearbyCards').innerHTML.includes('2026.10.20'),'Most recent contract date must show full year');
assert(ctx.$('nearbyCards').innerHTML.includes('거래</span> <b>2건</b>'));
assert(ctx.$('nearbyPeriod').textContent.includes('2025.11–2026.10'));
assert(ctx.$('nearbyPeriod').textContent.includes('매매·전월세 합산'));
ctx.remote.trades.state='partial';ctx.remote.trades.missing_buckets=['202607:임대'];
vm.runInContext('renderNearby()',ctx);
assert(ctx.$('nearbyPeriod').textContent.includes('일부 월 미수집'));
ctx.remote.trades=null;
ctx.nearbyAllRows=()=>[];
vm.runInContext('renderNearby()',ctx);
assert(ctx.$('nearbyCards').innerHTML.includes('확인 전'));
assert(!ctx.$('nearbyCards').innerHTML.includes('거래</span> <b>0건</b>'),'No 0 without data');
const addressFn=script.slice(script.indexOf('function compactComplexAddress('),script.indexOf('function renderComplexes('));
vm.runInContext(addressFn,ctx);
assert.equal(vm.runInContext("compactComplexAddress('인천광역시 연수구 송도동 102')",ctx),'송도동 102');
assert.equal(vm.runInContext("compactComplexAddress('인천광역시 연수구 컨벤시아대로252번길 70')",ctx),'컨벤시아대로252번길 70');
const catalogTemplate=script.slice(script.indexOf(" $('complexCards').innerHTML=shown.length?shown.map(x=>"),script.indexOf(" $('complexShowMore').classList.toggle"));
assert(catalogTemplate.includes('complexSummaryCard'));
assert(catalogTemplate.includes('verifiedLotAddress(x)||x.address'),'Never demote verified lot address');
assert(catalogTemplate.includes('세대수 확인 전'),'Unknown households must not be shown as 0');
console.log('Compact favorite and complex card regression passed: 14 cards, period, dates, addresses, data fallback.');
