'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const javascript=html.split('<script>')[1].split('</script>')[0];
new vm.Script(javascript);
for(const m of ['id="officetelPanel"','id="officeRentContent"','id="publicSubscriptions"','건축·관리비','학교·학군'])assert(html.includes(m),m);
const nav=html.match(/const NAV_CATEGORIES=\[([\s\S]*?)\];/);assert(nav);
assert.equal((nav[1].match(/icon:/g)||[]).length,3,'Keep three large family menu categories');
const snippet=javascript.slice(javascript.indexOf('// Source-backed optional integrations.'),javascript.indexOf('function tradeClass(type)'));
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
assert(missing.includes('건축물대장')&&missing.includes('공동주택 관리비'));
assert(missing.includes('아직 검증된 단지별 조회 자료가 없습니다.'), 'Unverified units must be clearly marked unavailable');
assert(!missing.includes('공식 자료·신청'), 'Family users must never be sent to developer API signup pages');
const addressed=run("renderPublicComplexInfo({id:'f13',label:'퍼스트파크13',address:'인천광역시 연수구 컨벤시아대로252번길 70'})");
assert(addressed.includes('카카오맵에서 주소 확인')&&addressed.includes('컨벤시아대로252번길 70'));
assert(missing.includes('자료 미제공은 0원 또는 0건이 아니며'), 'Missing fee is clearly labeled unknown, not zero');
assert(run('renderSchoolPublicInfo()').includes('배정학교가 아닙니다'));
assert(run('renderSchoolPublicInfo()').includes('schoolzone.emac.kr'));
run('renderOfficeRentals()');assert(nodes.officeRentContent.innerHTML.includes('활용승인'));
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
run('publicServices='+JSON.stringify(sample));
const schools=run('renderSchoolPublicInfo()');
assert(schools.includes('송도초등학교')&&!schools.includes('배정학교 확인'));
run('renderOfficeRentals()');assert(nodes.officeRentContent.innerHTML.includes('송도 오피스텔'));
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
for(const name of ['schools','school_zones','office_rents','building_registry','maintenance','addresses','subscriptions'])assert(snapshot[name]);
console.log('Public hub UI passed: school not falsely assigned, separate office rents, API approval statuses, three family menus');
