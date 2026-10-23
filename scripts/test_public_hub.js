'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const javascript=html.split('<script>')[1].split('</script>')[0];
new vm.Script(javascript);
for(const m of ['id="officetelPanel"','id="officeRentContent"','id="publicSubscriptions"' ,'관리비','학교·학군'])assert(html.includes(m),m);
const nav=html.match(/const NAV_CATEGORIES=\[([\s\S]*?)\];/);assert(nav);
assert.equal((nav[1].match(/icon:/g)||[]).length,3,'Keep three large family menu categories');
const snippet=javascript.slice(javascript.indexOf('// Source-backed optional integrations.'),javascript.indexOf('function tradeClass(type)'));
assert(javascript.includes('propertyTypeSwitch'),'Property type switch must be part of TOP navigation');
assert(javascript.includes("id!=='officetel'&&chosen.children.length>1"),'Hide apartment-only subnavigation in office mode');
assert(!html.includes('class="officeOnDemand"'),'Remove bottom-of-page-only office access');
assert(html.includes('오피스텔 실거래')&&html.includes('<option value="매매">매매</option>'));

const nodes={};
const ctx=vm.createContext({
 safeLink:v=>String(v||'').startsWith('https://')?v:'',
 escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 $:id=>(nodes[id]??={innerHTML:'',value:''}),
 number:n=>String(n),prettyTime:v=>v,
 value10k:n=>String(n)+'만원', URL,
 dealArticleClass:v=>'dealRow',dealBadge:v=>v.type,fetchRemote:async()=>{throw Error('missing optional')},
 currentPage:'nearby',renderComplexes(){},showRefreshFeedback(){},console
});
vm.runInContext(snippet,ctx);
const run=q=>vm.runInContext(q,ctx);
const missing=run("renderPublicComplexInfo({id:'f13',label:'퍼스트파크13'})");
assert(missing.includes('평형별 월 관리비'));
assert(missing.includes('실제 세대 관리비 자료가 없습니다.'));
assert(!missing.includes('건축물대장')&&!missing.includes('단지 전체 공개 비용'),
  'Redundant apartment-wide costs and building facts must be removed');
assert(!missing.includes('공식 자료·신청'), 'Family users never see API signup prompts');
const addressed=run("renderPublicComplexInfo({id:'f13',label:'퍼스트파크13',address:'인천광역시 연수구 컨벤시아대로252번길 70'})");
assert(!addressed.includes('도로명·지번주소')&&!addressed.includes('지도에서 주소 확인'),
 'Address is in the cadastral-first detail header, not duplicated in fees');
assert(run('renderSchoolPublicInfo()').includes('배정학교가 아닙니다'));
assert(run('renderSchoolPublicInfo()').includes('schoolzone.emac.kr'));
assert(!run('renderSchoolPublicInfo()').includes('NEIS_EDU_KEY를 등록'),'Absent verified data must not falsely claim the stored NEIS key is missing');
run('renderOfficeRentals()');assert(nodes.officeRentContent.innerHTML.includes('공식 자료 확인 중')&&!nodes.officeRentContent.innerHTML.includes('조회 0건'),'Pending access is not an empty official result');
run('publicServices={office_rents:{state:"verified",records:[]},office_sales:{state:"awaiting_approval",records:[]}}');
run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('매매 API 활용승인'),'Unapproved sale API is not confirmed zero');
run('publicServices.office_sales='+JSON.stringify({state:'verified',records:[{type:'매매',building:'송도 매매오피스텔',price_10k:32100,contract_date:'2026-10-20',area_m2:44.5,status:'신고'}]}));
run('renderOfficeRentals()');
assert(nodes.officeRentContent.innerHTML.includes('송도 매매오피스텔'),'Sale type included only after verified collection');
assert(nodes.officeRentContent.innerHTML.includes('32100만원'),'Correct verified sale price shown');
run('publicServices.office_sales={state:"awaiting_approval",records:[]}');
run('renderPublicSubscriptions()');assert(nodes.publicSubscriptions.innerHTML.includes('첫 수집'));
// News always comes first and subscriptions are a separate, reachable pane.
assert(html.includes('id="newsArticlesPane"')&&html.includes('id="newsSubscriptionsPane"'));
assert(html.indexOf('id="newsArticlesPane"')<html.indexOf('id="newsSubscriptionsPane"'));
assert(html.includes('id="subscriptionStatusFilter"'));
const sample={
 schools:{state:'verified',records:[{name:'송도초등학교',level:'초등학교',address:'인천광역시 연수구 송도교육로 1'}]},
 office_rents:{state:'verified',records:[{building:'송도 오피스텔',type:'전세',deposit_10k:20000,monthly_10k:0,area_m2:42,contract_date:'2026-10-03'}]},
 subscriptions:{state:'awaiting_approval',records:[]}
};
run("publicServices="+JSON.stringify({
 schools:{state:'awaiting_key',records:[]},
 school_locations:{state:'verified',import_method:'official_csv',reference_date:'2026-10-01',updated_at:'2026-10-22T09:00:00Z',records:[
 {code:'B000025226',name:'인천송일초등학교',level:'초등학교',address:'인천광역시 연수구 컨벤시아대로252번길 15',lat:37.38,lng:126.63}
 ]},
 office_rents:{state:'awaiting_approval',records:[]},subscriptions:{state:'awaiting_approval',records:[]}
}));
const csvSchool=run('renderSchoolPublicInfo()');
assert(csvSchool.includes('인천송일초등학교')&&csvSchool.includes('교육시설안전원 학교위치 CSV'),'CSV provider and school name shown');
assert(csvSchool.includes('2026-10-01')&&csvSchool.includes('지도에서 학교 위치 보기'),'CSV reference date and map link shown');
run('publicServices='+JSON.stringify(sample));
const schools=run('renderSchoolPublicInfo()');
assert(schools.includes('송도초등학교')&&!schools.includes('배정학교 확인'));
run("publicServices="+JSON.stringify({
 schools:{state:'awaiting_key',records:[]},
 school_locations:{state:'verified',updated_at:'2026-10-01T00:00:00+0900',records:[
 {code:'B000022222',name:'송도모의초등학교',level:'초등학교',address:'인천광역시 연수구 송도테스트로 10',lat:37.4,lng:126.66},
 {code:'B000022223',name:'송도모의중학교',level:'중학교',address:'인천광역시 연수구 송도테스트로 20',lat:37.41,lng:126.67}
 ]},
 office_rents:{state:'awaiting_approval',records:[]},subscriptions:{state:'awaiting_approval',records:[]}
}));
const fallback=run('renderSchoolPublicInfo()');
assert(fallback.includes('송도모의초등학교')&&fallback.includes('송도모의중학교'),'Show verified official fallback when NEIS fails');
assert(fallback.includes('교육부 학교위치 표준데이터 API')&&fallback.includes('지도에서 학교 위치 보기'),'Display actual source and map action');
assert(!fallback.includes('배정학교 확인'),'Location alone cannot verify catchment');
run("selectNeisSchoolLevel('중학교')");
const secondary=run('renderSchoolPublicInfo()');
assert(secondary.includes('송도모의중학교')&&!secondary.includes('송도모의초등학교'),'Grade filter applies to fallback');
run("selectNeisSchoolLevel('all')");
run('publicServices='+JSON.stringify(sample));

run('renderOfficeRentals()');assert(nodes.officeRentContent.innerHTML.includes('송도 오피스텔'));
assert(nodes.officeRentContent.innerHTML.includes('확인된 거래 1건'),'Results are separate from apartment transactions');
run('toggleOfficeDetailed(true)');
assert(nodes.officeDetailToggle.checked===true);
assert(nodes.officeRentContent.innerHTML.includes('오피스텔'));
run('toggleOfficeDetailed(false)');
assert(nodes.officeDetailToggle.checked===false);
;
run('renderPublicSubscriptions()');assert(nodes.publicSubscriptions.innerHTML.includes('첫 수집'));
run("publicServices.subscriptions={state:'verified',updated_at:'2026-10-20T09:30:00+0900',window_start:'2025-09-01',records:[{kind:'아파트',name:'송도 새아파트',address:'인천 연수구 송도동',notice_date:'2026-10-19',apply_start:'2026-10-23',apply_end:'2026-10-25',households:123,notice_url:'https://www.applyhome.co.kr/ai/aia/test.do'}]}");
run('renderPublicSubscriptions()');
assert(nodes.publicSubscriptions.innerHTML.includes('송도 새아파트'));
assert(nodes.publicSubscriptions.innerHTML.includes('청약홈 공고 원문'));
assert(nodes.publicSubscriptions.innerHTML.includes('공급 123세대'));
run("publicServices.subscriptions.records[0].notice_url='https://evil.example/'");
run('renderPublicSubscriptions()');
assert(!nodes.publicSubscriptions.innerHTML.includes('https://evil.example/'));
const native=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
assert(native.includes('"public_services.json".equals(filename)'));
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/public_services.json'),'utf8'));
for(const name of ['schools','school_zones','office_rents','office_sales','building_registry','maintenance','addresses','subscriptions'])assert(snapshot[name]);
console.log('Public hub UI passed: school not falsely assigned, separate office rents, API approval statuses, three family menus');

run("publicServices.maintenance={state:'verified',records:[{complex_id:'f13',month:'202608',breakdown_won:{'경비비':100000,'청소비':0}}]}");
const practical=run("renderPublicComplexInfo({id:'f13',management_phone:'032-000-0000',heating:'지역난방'})");
assert(practical.includes('tel:0320000000'));
assert(practical.includes('평형별 월 관리비'));
assert(!practical.includes('100,000원')&&!practical.includes('2026년 8월 단지 전체'),
  'Never expose whole-building cost breakdown as a per-unit bill');
const verifiedBill=run("renderPublicComplexInfo({id:'f13',maintenance_by_type:[{supply_label:'117A',status:'verified_invoice',monthly_won:225000,month:'2026-08',source_url:'https://example.org/verified'}]})");
assert(!verifiedBill.includes('225,000원'), 'No figure unless its matching verified type exists');
