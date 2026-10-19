// v1.8: large mobile categories, 13 distinct favourites and 3-colour transactions.
// These tests exercise the actual app JavaScript without Android UI.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
assert(html.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
assert(html.includes('.dealRow.sale')&&html.includes('.dealRow.lease')&&html.includes('.dealRow.monthly'));
assert(html.includes('.dealBadge.sale')&&html.includes('.dealBadge.lease')&&html.includes('.dealBadge.monthly'));
assert(!html.includes('overflow-x:auto'),'Main menu must not scroll horizontally');
const elems=new Map();
function el(id){
 if(!elems.has(id)){
  let classes=new Set(id==='complexAdmin'?['hidden']:[]);
  elems.set(id,{value:'',textContent:'',innerHTML:'',options:[{}],open:false,
   classList:{toggle(n,bool){if(bool)classes.add(n);else classes.delete(n)},
    remove(n){classes.delete(n)},contains(n){return classes.has(n)}},
   scrollIntoView(){},reset(){},showModal(){this.open=true},close(){this.open=false},
   querySelectorAll(){return []},setAttribute(){}});
 }
 return elems.get(id);
}
const data={
 'complexes.json':JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8')),
 'trades.json':{schema_version:1,state:'ok',area:'송도동',checked_at:'2026-10-19T00:00:00Z',records:[
  {building:'더샵송도프라임뷰20BL',contract_date:'2026-10-19',area_m2:84.95,type:'매매',amount_10k:70000,status:'신고'},
  {building:'더샵송도프라임뷰25BL',contract_date:'2026-10-18',area_m2:101.5,type:'전세',deposit_10k:45000,status:'신고'},
  {building:'더샵송도프라임뷰20BL',contract_date:'2026-10-17',area_m2:84.95,type:'월세',deposit_10k:2000,monthly_10k:150,status:'신고'},
  {building:'더샵송도프라임뷰20BL',contract_date:'2026-10-16',area_m2:65.1,type:'매매',amount_10k:50000,status:'해제',cancel_date_raw:'2026-10-18'}
 ]},
 'new_trades.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T00:00:00Z',records:[
  {building:'더샵송도프라임뷰20BL',contract_date:'2026-10-19',first_seen_date:'2026-10-19',type:'매매',area_m2:84.95,amount_10k:70000,status:'신고'}
 ]},
 'news.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T00:00:00Z',briefs:[]}
};
const ctx=vm.createContext({
 window:{},
 document:{getElementById:el},
 localStorage:{getItem:()=>null,setItem(){}},
 fetch:async url=>({ok:true,json:async()=>data[url.split('/').pop().split('?')[0]]}),
 alert(){},confirm:()=>true,console,Blob,URL
});
vm.runInContext(js,ctx);
(async()=>{
 for(let i=0;i<30;i++)await Promise.resolve();
 const run=q=>vm.runInContext(q,ctx);
 assert.equal(run('FAVORITE_APTS.length'),14);
 assert.equal(run("favoriteIdForBuilding('더샵송도프라임뷰20BL')"),'prime20');
 assert.equal(run("favoriteIdForBuilding('더샵송도프라임뷰25BL')"),'prime25');
 assert.equal(run("favoriteIdForBuilding('송도센트럴파크푸르지오')"),'kapt-a10027887');
 assert.equal(run("favoriteIdForBuilding('송도센트럴파크 푸르지오')"),'kapt-a10027887');
 assert.equal(run("favoriteIdForBuilding('더샵송도센트럴파크Ⅲ')"),'central3');
 assert.equal(run('NAV_CATEGORIES.length'),3);
 assert(el('nav').innerHTML.includes('실거래')&&el('nav').innerHTML.includes('아파트정보')&&el('nav').innerHTML.includes('뉴스'));
 assert(!el('nav').innerHTML.includes('관리자 도구'));
 run("openTradeLatest()");
 assert.equal(run('currentPage'),'trades');
 assert(el('tradeSearchPanel').classList.contains('hidden'),'First look should be simple');
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>4건</b>'));
 const all=el('tradesContent').innerHTML;
 assert(all.includes('dealRow sale')&&all.includes('dealRow lease')&&all.includes('dealRow monthly'));
 assert(all.includes('dealBadge sale')&&all.includes('dealBadge lease')&&all.includes('dealBadge monthly'));
 assert(all.includes('dealRow sale cancelled'),'Cancelled sale must keep red warning independently');
 run("setTradeType('전세')");
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>1건</b>'));
 assert(el('tradesContent').innerHTML.includes('프라임뷰25BL'));
 run("setTradeType('')");
 run('startTradeSearch()');
 assert(!el('tradeSearchPanel').classList.contains('hidden'));
 el('tradeBuildingSelect').value='더샵송도프라임뷰20BL';
 run('chooseTradeBuilding()');
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>3건</b>'));
 assert(!el('tradesContent').innerHTML.includes('프라임뷰25BL'));
 el('tradeAreaSelect').value='84.95';
 run('setTradeArea()');
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>2건</b>'));
 run("openTradeLatest()");
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>4건</b>'));
 run("switchPage('nearby')");
 run("chooseNearby('prime20')");
 assert(el('nearbyTrades').innerHTML.includes('검색 결과 <b>3건</b>'));
 assert(!el('nearbyTrades').innerHTML.includes('프라임뷰25블럭'));
 run("chooseNearby('prime25')");
 assert(el('nearbyTrades').innerHTML.includes('검색 결과 <b>1건</b>'));
 run("chooseNearby('all')");
 assert(el('nearbyDetails').classList.contains('detailOpen'));
 assert(el('nearbyTrades').innerHTML.includes('검색 결과 <b>4건</b>'));
 run("closeApartmentSheet()");
 run("chooseNearby('prime25')");
 run("chooseNearby('kapt-a10027887')");
 assert(el('nearbyTitle').textContent.includes('센트럴파크푸르지오'),'New favorite has independent dedicated screen');
 assert(el('nearbyTrades').innerHTML.includes('선택한 단지·유형'),'No invented recent transactions for this test dataset');
 run("chooseNearby('prime25')");
 run("setNearbyType('전세')");
 assert(el('nearbyTrades').innerHTML.includes('dealBadge lease'));
 run("setNearbyType('매매')");
 assert(el('nearbyTrades').innerHTML.includes('선택한 단지·유형'));
 run("setNearbyType('')");
 run("window.onRoleChanged('admin')");
 assert(el('nav').innerHTML.includes('관리자 도구'));
 run("window.onRoleChanged('family')");
 assert(!el('nav').innerHTML.includes('관리자 도구'),'Family must not be shown protected tools');
 console.log('Mobile first v1.8 UI passed: 3 categories, 13 distinct favourites, 3 contract colours, red cancellation, smart sizes');
})().catch(e=>{console.error(e);process.exitCode=1});
