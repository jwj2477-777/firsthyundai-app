'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
const nav=script.slice(script.indexOf('const NAV_CATEGORIES=['),script.indexOf('function navGroupForPage(',script.indexOf('const NAV_CATEGORIES=[')));
assert.equal((nav.match(/icon:/g)||[]).length,3,'Preserve existing three top categories');
assert(!nav.includes('officetel'),'Officetel is not part of apartment top menu');
assert(html.includes('id="officetel" class="page hidden"'));
assert((html.match(/class="propertyTypeSwitch sectionSubnav sectionModeSwitch"/g)||[]).length===4,'Property category switch is placed after all apartment and officetel page titles');
const trades=html.slice(html.indexOf('<div id="trades"'),html.indexOf('<div id="officetel"'));
assert(!trades.includes('id="officeRentContent"'),'Apartment and office trade records must remain separate');
for(const phrase of ['id="officeModeLatest"','id="officeModeSearch"','id="officeBuildingSelect"',
  'id="officeAreaSelect"','id="officeTypeBar"','id="officeAdvanced"','id="officeDateFrom"',
  'id="officeDateTo"','id="officeStatusFilter"','id="officeNameSearch"']){
 assert(html.includes(phrase),phrase+' is required');
}
assert(!html.includes('id="officeDetailToggle"'),'No different officetel compact-mode control');
const js=script.slice(script.indexOf('// Source-backed optional integrations.'),script.indexOf('function tradeClass(type)'));
const nodes={};
function element(id){
 if(!nodes[id]){
  const classes=new Set();nodes[id]={value:'',innerHTML:'',checked:false,textContent:'',attributes:{},
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,val)=>val?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
   setAttribute(k,v){this.attributes[k]=v}};
 }
 return nodes[id];
}
const storage={},localStorage={getItem:k=>storage[k],setItem:(k,v)=>{storage[k]=v}};
const escape=s=>String(s??'').replace(/[&<>"]/g,'');
const ctx=vm.createContext({
 localStorage,$:element,escapeHtml:escape,prettyTime:s=>s,number:n=>String(n),
 value10k:n=>String(n)+'만원',dealBadge:t=>'<b>'+t+'</b>',
 dealArticleClass:x=>'dealRow '+x.type,tradeStatusBadge:x=>x.status==='해제'?'해제':'',
 tradeExtraBadges:x=>x.dealing_type?'거래방식':'',renderTypeButtons:(id,type,counts)=>{nodes._lastType=type;nodes._lastCounts=counts&&{...counts}},
 areaKey:n=>Number.isFinite(Number(n))?String(Number(n)):'',
 sourceLink:()=>'',safeLink:()=>'',fetchRemote:async()=>{},console
});
vm.runInContext(script.slice(script.indexOf('function compactTradeCollectedAt('),script.indexOf('function number(')),ctx);
vm.runInContext(js,ctx);
vm.runInContext(script.slice(script.indexOf('function tradeClass(type)'),script.indexOf('function renderTypeButtons(')),ctx);
const run=q=>vm.runInContext(q,ctx);
run("publicServices={office_rents:{state:'awaiting_approval',records:[]},office_sales:{state:'awaiting_approval',records:[]}};renderOfficeRentals()");
assert(nodes.officeRentContent.innerHTML.includes('공식 자료 확인 중'));
assert(!nodes.officeRentContent.innerHTML.includes('검색 결과 <b>0건</b>'),'Pending must not be counted as zero');
assert.equal(nodes._lastCounts[''],null);
assert.equal(nodes._lastCounts.매매,null);
assert.equal(nodes._lastCounts.전세,null);
assert.equal(nodes._lastCounts.월세,null);
const rentals=[
 {building:'송도 플러스오피스텔',type:'월세',deposit_10k:3000,monthly_10k:85,area_m2:35.5,contract_date:'2026-10-12',floor:'9',lot_number:'123'},
 {building:'송도 퍼스트오피스텔',type:'전세',deposit_10k:20000,monthly_10k:0,area_m2:62.4,contract_date:'2026-09-15',floor:'14',lot_number:'456'},
 {building:'송도 플러스오피스텔',type:'전세',deposit_10k:22000,monthly_10k:0,area_m2:45.6,contract_date:'2026-10-10',floor:'7',lot_number:'123'}
];
const sales=[{building:'송도 센트럴오피스텔',type:'매매',price_10k:33000,area_m2:34,contract_date:'2026-10-21',floor:'22',status:'신고'},
 {building:'송도 센트럴오피스텔',type:'매매',price_10k:35000,area_m2:36,contract_date:'2026-10-19',floor:'25',status:'해제',cancellation_date:'2026-10-20'}];
run('publicServices='+JSON.stringify({office_rents:{state:'verified',records:rentals},office_sales:{state:'verified',records:sales}})+';renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>5건</b>'));
assert.equal(nodes._lastCounts[''],5);assert.equal(nodes._lastCounts.매매,2);
assert.equal(nodes._lastCounts.전세,2);assert.equal(nodes._lastCounts.월세,1);
assert(nodes.officeRentContent.innerHTML.includes('dealRow'),'Same apartment deal card base class');
assert(nodes.officeRentContent.innerHTML.includes('9층'),'Office floors visible like apartment cards');
assert(!nodes.officeRentContent.innerHTML.includes('거래 상세정보 보기'));
assert(!nodes.officeRentContent.innerHTML.includes('지번 123'));
assert(nodes.officeRentContent.innerHTML.includes('tradeDateFloor'));
assert(nodes.officeRentContent.innerHTML.includes('tradeArea'));
run("setOfficeType('전세')");
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>2건</b>'));
assert.equal(nodes._lastType,'전세');assert.equal(nodes._lastCounts[''],5);
run("setOfficeType('')");
run("startOfficeSearch()");
assert(!nodes.officeSearchPanel.classList.contains('hidden'));
assert(nodes.officeBuildingSelect.innerHTML.includes('송도 플러스오피스텔'));
nodes.officeBuildingSelect.value='송도 플러스오피스텔';
run('chooseOfficeBuilding()');
assert(!nodes.officeAreaPanel.classList.contains('hidden'));
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>2건</b>'));
assert(nodes.officeAreaSelect.innerHTML.includes('35.5'));
nodes.officeAreaSelect.value='35.5';
run('chooseOfficeArea()');
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>1건</b>'));
run('openOfficeLatest()');
assert(nodes.officeSearchPanel.classList.contains('hidden'));
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>5건</b>'));
nodes.officeNameSearch.value='퍼스트오피스텔';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>1건</b>'));
nodes.officeNameSearch.value='';
nodes.officeDateFrom.value='2026-10-19';nodes.officeDateTo.value='2026-10-19';
run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>1건</b>'));
nodes.officeStatusFilter.value='cancel';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('해제'));
nodes.officeDateFrom.value='2026-10-23';nodes.officeDateTo.value='2026-10-01';
run('renderOfficeRentals()');
assert(nodes.officeDateError.textContent.includes('범위'));
assert(nodes.officeRentContent.innerHTML.includes('검색 기간과 면적 범위'));
run('resetOfficeDateFilter()');nodes.officeStatusFilter.value='';
nodes.officeMinArea.value='40';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('검색 결과 <b>2건</b>'));
nodes.officeMinArea.value='';
run("publicServices={office_sales:{state:'verified',records:[]},office_rents:{state:'awaiting_approval'}};setOfficeType('')");
assert.equal(nodes._lastCounts.매매,0);
assert.equal(nodes._lastCounts.전세,null);
assert.equal(nodes._lastCounts[''],null);
// Header uses the actual included office snapshots, independently of apartments/schools.
assert(!html.includes('아파트와 동일한 검색 방식 · 오피스텔 자료만 별도 조회'));
assert(html.includes('id="officeMeta"'));
run("publicServices={updated_at:'2026-10-26T12:00:00+09:00',office_sales:{state:'verified',updated_at:'2026-10-25T10:20:00+09:00',records:[]},office_rents:{state:'verified',updated_at:'2026-10-24T08:31:00+09:00',records:[]}}");
assert.equal(run("officeCollectionLabel('')"),'수집 202026.10.24 08:31');
assert.equal(run("officeCollectionLabel('매매')"),'수집 2026.10.25 10:20');
assert.equal(run("officeCollectionLabel('전세')"),'수집 202026.10.24 08:31');
assert.equal(run("officeCollectionLabel('월세')"),'수집 202026.10.24 08:31');
run("setOfficeType('매매')");
assert.equal(nodes.officeMeta.textContent,'송도동 · 수집 2026.10.25 10:20');
run("publicServices.office_sales.updated_at='invalid'");
assert.equal(run("officeCollectionLabel('매매')"),'수집 시각 확인 필요');
run("publicServices.office_sales.state='awaiting_approval'");
assert.equal(run("officeCollectionLabel('매매')"),'아직 수집 전');
run('publicServices=null');
assert.equal(run("officeCollectionLabel('')"),'수집 시각 확인 중');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
assert(/versionCode [0-9]+; versionName '[0-9]+\.[0-9]+\.[0-9]+'/.test(gradle),'Build must expose an updatable semantic APK version');
const w=fs.readFileSync(path.join(root,'.github/workflows/sync-public-services.yml'),'utf8');
assert(w.includes('--mode offices')&&w.includes('--mode office_sales'));
console.log('Officetel same-as-apartment search and cards passed: latest, selection, area, category, date, status, range, independent records');
