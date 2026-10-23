/* v2.0.30: one-touch new-deal filtering and clear, accurate result summary. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
const begin=html.indexOf('<div id="new"'),end=html.indexOf('<div id="trades"',begin);
const panel=html.slice(begin,end);
for(const id of ['newDate','newTypeAll','newTypeSale','newTypeLease','newTypeMonthly',
  'newAptFilter','newFavoriteToggle','newCounts','newStatus','newContent','newFavoriteFilter','newType']){
 assert(panel.includes('id="'+id+'"'),'Missing new-deal control '+id);
}
assert(!panel.includes('신규 공개 확인일 (한국시간)'),'Old redundant explanatory date removed');
assert(!panel.includes('id="newFavoriteFilter" aria-label='),'Legacy favorite dropdown must not be visible');
assert(panel.includes('id="newFavoriteFilter" class="hidden"'));
assert(panel.includes('id="newType" class="hidden"'));
assert(css.includes('#new .newTypeChips')&&css.includes('#new .newSimpleCounts'));
const i=js.indexOf('let newAlertFocusIds=null;');
const j=js.indexOf('window.FirstHyundaiTradeAlerts?.syncOption();',i);
assert(i>=0&&j>i);
const nodes=new Map();
function el(id){
 if(!nodes.has(id)){
  const flags=new Set(id==='newStatus'?['hidden']:[]);
  nodes.set(id,{value:'',innerHTML:'',textContent:'',options:[{value:'2026-10-23'}],
   classList:{toggle(x,enable){if(enable)flags.add(x);else flags.delete(x)},contains(x){return flags.has(x)}},
   setAttribute(key,value){this[key]=value}});
 }
 return nodes.get(id);
}
el('newDate').value='2026-10-23';
const records=[
 {building:'송도 A',type:'매매',first_seen_date:'2026-10-23',contract_date:'2026-10-18',area_m2:84.8,amount_10k:70000,favorite:true,status:'신고',floor:10,id:'sale'},
 {building:'송도 B',type:'전세',first_seen_date:'2026-10-23',contract_date:'2026-10-19',area_m2:59.8,deposit_10k:30000,favorite:false,status:'신고',floor:7,id:'lease'},
 {building:'송도 C',type:'월세',first_seen_date:'2026-10-23',contract_date:'2026-10-20',area_m2:84.8,deposit_10k:2000,monthly_10k:130,favorite:true,status:'신고',floor:12,id:'monthly'}
];
const ctx=vm.createContext({
 $:el,
 remote:{new_trades:{state:'ok',checked_at:'2026-10-23T01:00:00Z',records}},
 window:{FirstHyundaiTradeAlerts:{stableId:x=>x.id}},
 prettyTime:()=> '2026. 10. 23. 10시',
 kstDateOffset:()=> '2026-10-23',
 number:x=>String(x),escapeHtml:s=>String(s),favoriteIdForBuilding:x=>x==='송도 B'?null:'favorite',
 value10k:n=>n+'만원',
 dealArticleClass:()=> 'dealRow',dealBadge:x=>x,tradeStatusBadge:()=>'',tradeExtraBadges:()=>'',displayExclusiveArea:()=> '84㎡',
 catalogForTradeName:()=>null,tradeRenewalDetails:()=>'',tradeBrokerLocation:()=>''
});
vm.runInContext(js.slice(i,j),ctx);
const run=stmt=>vm.runInContext(stmt,ctx);
run('renderNew()');
assert(el('newCounts').innerHTML.includes('3<small>건</small>'));
assert(el('newCounts').innerHTML.includes('매매 1 · 전세 1 · 월세 1'));
assert(!el('newContent').innerHTML.includes('최대 120건 표시'));
assert(el('newTypeAll').classList.contains('active'));
run("chooseNewType('전세')");
assert.equal(el('newType').value,'전세');
assert.equal(el('newTypeLease')['aria-pressed'],'true');
assert(el('newCounts').innerHTML.includes('1<small>건</small>'));
assert(!el('newCounts').innerHTML.includes('매매 1'));
run("chooseNewType('')");
run('toggleNewFavorites()');
assert.equal(el('newFavoriteFilter').value,'favorites');
assert(el('newFavoriteToggle').classList.contains('active'));
assert(el('newCounts').innerHTML.includes('2<small>건</small>'));
el('newAptFilter').value='송도 A';
run('renderNew()');
assert(el('newCounts').innerHTML.includes('1<small>건</small>'));
assert(el('newContent').innerHTML.includes('송도 A')&&!el('newContent').innerHTML.includes('송도 C'));
el('newAptFilter').value='없는 단지';
run('renderNew()');
assert(el('newCounts').innerHTML.includes('0<small>건</small>'));
assert(el('newContent').innerHTML.includes('다른 날짜나 조건으로 확인'));
el('newAptFilter').value='';
ctx.remote.new_trades.state='partial';
run('renderNew()');
assert(!el('newStatus').classList.contains('hidden'));
assert(el('newStatus').textContent.includes('누락'));
ctx.remote.new_trades.state='ok';
run('renderNew()');
assert(el('newStatus').classList.contains('hidden'),'Do not repeat normal collection status');
console.log('New trade intuitive UI checks: date, chips, favorite search, exact live counts, alert safety and partial fetch status passed.');
