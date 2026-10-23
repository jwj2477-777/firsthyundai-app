'use strict';
/* Favorites: the four transaction buttons carry the real per-type totals. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/ui-v2.css'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
new vm.Script(script);
const sheet=html.slice(html.indexOf('id="nearbyDetails"'),html.indexOf('<div id="apiGuide"'));
assert(sheet.includes('id="nearbyTypeBar"'),'Keep one four-way filter for all favorites and per apartment');
assert(!sheet.includes('id="nearbyStats"'),'Remove repeated count-pill row');
assert(!script.includes("$('nearbyStats')"),'Never render a second copy of trade counts');
assert(css.includes('#nearbyDetails #nearbyTypeBar .typeCount'),'Separate readable type label/count within the same button');
const nodeMap=new Map(),presses=[];
function node(id){
 if(!nodeMap.has(id)){
  const classes=new Set();
  nodeMap.set(id,{id,value:'',innerHTML:'',textContent:'',className:'',options:[{}],
   classList:{toggle(key,on){if(on)classes.add(key);else classes.delete(key)},contains(key){return classes.has(key)}},
   setAttribute(key,value){presses.push([id,key,value]);this[key]=value},
   querySelectorAll: id==='nearbyTypeBar'?()=>buttons:undefined});
 }
 return nodeMap.get(id);
}
const buttons=Array.from({length:4},()=>({className:'',innerHTML:'',attrs:{},
 setAttribute(key,value){this.attrs[key]=value}}));
const favorites=[{id:'f13',label:'퍼스트파크 13블럭'}, {id:'m21',label:'마스터뷰 21블럭'}];
const rows=[
 {building:'f13',type:'매매',area_m2:84,contract_date:'2026-10-20',amount_10k:82000},
 {building:'f13',type:'매매',area_m2:101,contract_date:'2026-10-18',amount_10k:92000},
 {building:'f13',type:'전세',area_m2:84,contract_date:'2026-10-17',deposit_10k:48000},
 {building:'f13',type:'월세',area_m2:84,contract_date:'2026-10-19',deposit_10k:2000,monthly_10k:150},
 {building:'m21',type:'매매',area_m2:84,contract_date:'2026-10-13',amount_10k:90000},
 {building:'m21',type:'전세',area_m2:101,contract_date:'2026-10-12',deposit_10k:54000}
];
const ctx=vm.createContext({
 $:node,FAVORITE_APTS:favorites,remote:{trades:{state:'ok',checked_at:'2026-10-23',records:rows}},
 nearbySelected:'all',nearbyLimit:40,
 nearbyAllRows:()=>rows,updateNearbyAreas:()=>{},
 favoriteIdForBuilding:x=>x,prettyTime:x=>x,
 number:x=>Number(x).toLocaleString('en-US'),escapeHtml:x=>String(x),
 areaKey:x=>String(Number(x)),tradeClass:t=>t==='매매'?'sale':t==='전세'?'lease':t==='월세'?'monthly':'',
 value10k:x=>String(x)+'만원',dealArticleClass:()=> 'dealRow',dealBadge:()=>'',tradeStatusBadge:()=>'',tradeExtraBadges:()=>'',displayExclusiveArea:x=>String(x),
 catalogForTradeName:()=>null,tradeRenewalDetails:()=>'',tradeBrokerLocation:()=>'',tradeAmount:()=>'',tradeCardFacts:()=>''
});
const start=script.indexOf('function renderTypeButtons('),end=script.indexOf('function areaKey(',start);
const rStart=script.indexOf('function renderNearbyDetails('),rEnd=script.indexOf('function renderOverview(',rStart);
assert(start>=0&&end>start&&rStart>=0&&rEnd>rStart);
vm.runInContext(script.slice(start,end)+'\n'+script.slice(rStart,rEnd),ctx);
const run=expr=>vm.runInContext(expr,ctx);
const labels=()=>buttons.map(b=>b.innerHTML.replace(/<[^>]+>/g,'').trim());
node('nearbyType').value='';
node('nearbyAreaSelect').value='';
run('renderNearbyDetails(false)');
assert.deepEqual(labels(),['전체6건','매매3건','전세2건','월세1건']);
assert.equal(buttons[0].attrs['aria-pressed'],'true');
assert.equal(buttons[1].attrs['aria-label'],'매매 3건');
assert(node('nearbyTrades').innerHTML.includes('검색 결과 <b>6건</b> 중 6건 표시'),'Keep result-page count only');
node('nearbyType').value='전세';
run('renderNearbyDetails(true)');
assert.deepEqual(labels(),['전체6건','매매3건','전세2건','월세1건'],'Filter should not rewrite all-type totals');
assert.equal(buttons[2].attrs['aria-pressed'],'true');
assert(node('nearbyTrades').innerHTML.includes('검색 결과 <b>2건</b> 중 2건 표시'));
ctx.nearbySelected='f13';
node('nearbyAreaSelect').value='';
node('nearbyType').value='';
run('renderNearbyDetails(true)');
assert.deepEqual(labels(),['전체4건','매매2건','전세1건','월세1건'],'Specific favorite only');
node('nearbyAreaSelect').value='84';
run('renderNearbyDetails(true)');
assert.deepEqual(labels(),['전체3건','매매1건','전세1건','월세1건'],'Selected floor area must recalculate all type counts');
node('nearbyType').value='매매';
run('renderNearbyDetails(true)');
assert.equal(buttons[1].attrs['aria-pressed'],'true');
assert.equal(buttons[1].attrs['aria-label'],'매매 1건');
assert(node('nearbyTrades').innerHTML.includes('검색 결과 <b>1건</b>'));
ctx.remote.trades=null;
ctx.nearbyAllRows=()=>[];
node('nearbyType').value='';
run('renderNearbyDetails(true)');
assert.deepEqual(labels(),['전체—','매매—','전세—','월세—'],'No false zero before data loads');
console.log('Favorites count-button UI: all 14/single complex, area and type filters, verified count, absent data passed.');
