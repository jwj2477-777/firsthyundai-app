'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
const nav=script.slice(script.indexOf('const NAV_CATEGORIES=['),script.indexOf('function navGroupForPage(',script.indexOf('const NAV_CATEGORIES=[')));
assert.equal((nav.match(/icon:/g)||[]).length,3,'Preserve exact existing main menu categories');
assert(!nav.includes('officetel'),'Officetel must not appear as top-level/ordinary trade navigation');
assert(html.includes('id="officetel" class="page hidden"'),'Separate office-only hidden screen');
assert(html.includes('onclick="switchPage(\'officetel\')"'),'Explicit entry when needed');
const trades=html.slice(html.indexOf('<div id="trades"'),html.indexOf('<div id="officetel"'));
assert(trades.includes('officeOpenLink'),'Only one unobtrusive link in regular trade page');
assert(!trades.includes('id="officeRentContent"'),'Never combine apartment and office results');
assert(html.includes('id="officeDetailToggle"')&&html.includes('id="officeAdvancedFilters" class="officeAdvancedFilters hidden"'));
const rows=script.slice(script.indexOf('// Source-backed optional integrations.'),script.indexOf('function tradeClass(type)'));
const nodes={};for(const id of ['officeRentContent','officeDetailToggle','officeAdvancedFilters','officeMore','officeNameSearch','officeTypeSearch','officeDateFrom','officeDateTo','officeMinArea','officeMaxArea']){
 nodes[id]={value:'',innerHTML:'',checked:false,classList:{add(){},toggle(){}},textContent:''};
}
const storage={},localStorage={getItem:k=>storage[k],setItem:(k,v)=>{storage[k]=v}};
const ctx=vm.createContext({
 localStorage,$:id=>nodes[id],escapeHtml:s=>String(s??'').replace(/[&<>"]/g,''),
 prettyTime:s=>s,number:n=>String(n),value10k:n=>String(n)+'만원',
 dealBadge:t=>t,sourceLink:()=>'',safeLink:()=>'',fetchRemote:async()=>{},console
});
vm.runInContext(rows,ctx);
const run=source=>vm.runInContext(source,ctx);
run("publicServices={office_rents:{state:'awaiting_approval',records:[]}};renderOfficeRentals()");
assert(nodes.officeRentContent.innerHTML.includes('연결 확인 중'));
assert(!nodes.officeRentContent.innerHTML.includes('조회 0건'));
const data=[
 {building:'송도 플러스오피스텔',type:'월세',deposit_10k:3000,monthly_10k:85,area_m2:35.5,contract_date:'2026-10-12',floor:'9',lot_number:'123'},
 {building:'송도 퍼스트오피스텔',type:'전세',deposit_10k:20000,monthly_10k:0,area_m2:62.4,contract_date:'2026-09-15',floor:'14',lot_number:'456'}
];
run("publicServices="+JSON.stringify({office_rents:{state:'verified',records:data,updated_at:'2026-10-22T08:00:00+09:00'}})+";renderOfficeRentals()");
assert(nodes.officeRentContent.innerHTML.includes('조회 2건'));
assert(!nodes.officeRentContent.innerHTML.includes('9층'),'Simple mode hides floor');
nodes.officeTypeSearch.value='전세';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('조회 1건'));
assert(!nodes.officeRentContent.innerHTML.includes('송도 플러스오피스텔'));
nodes.officeTypeSearch.value='';
run('toggleOfficeDetailed(true)');
assert(storage.firsthyundai_officetel_detailed_v1==='1');
assert(nodes.officeRentContent.innerHTML.includes('9층')&&nodes.officeRentContent.innerHTML.includes('지번 123'));
nodes.officeDateFrom.value='2026-10-01';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('조회 1건'));
nodes.officeDateFrom.value='2026-10-23';nodes.officeDateTo.value='2026-10-01';run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('기간과 면적 범위'));
run('toggleOfficeDetailed(false)');
assert(storage.firsthyundai_officetel_detailed_v1==='0');
assert(!nodes.officeRentContent.innerHTML.includes('9층'),'Compact mode hides office-only detail');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
assert(gradle.includes("versionCode 69; versionName '2.0.18'"));
const w=fs.readFileSync(path.join(root,'.github/workflows/sync-public-services.yml'),'utf8');
assert(w.includes('python scripts/collect_public_services.py --mode offices'),'Automated office-rent polling uses existing secret');
assert(w.includes('keeping previously published records'),'Network failure must preserve old official data');
console.log('On-demand offices isolated, compact-by-default, optionally detailed, safely approved official data');
