'use strict';
/* v2.0.46: seven actual Galaxy apartment-detail tab screenshots. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
assert(html.includes('aria-labelledby="complexSheetTitle"') &&
 script.includes("$('complexSheetTitle').textContent=match.label"),
 'Sticky detail title must identify the selected apartment');
assert(!script.includes("'<h3 class=\"complexDetailTitle\">'+escapeHtml(p.label)"),
 'The selected complex name must not appear twice in the header');
for(const tab of ["['basic','기본정보']","['types','평형·타입']",
 "['schools','학교·학군']","['deals','실거래']","['trends','가격동향']",
 "['public','관리비']","['nearby','주변시설']",
 "['sources','평면도·원문']"])
 assert(script.includes(tab),'Missing existing detail tab '+tab);
for(const feature of [
 "FirstHyundaiContracts.fromSelectedComplex()",
 'function showComplexTrades(',
 'function renderPublicComplexInfo(p)',
 'function renderNearbyComplexInfo(p)',
 'function renderSchoolPublicInfo()',
 "sourceLink('https://schoolzone.emac.kr/'",
 '이 단지의 배정학교는 아직 검증되지 않았습니다',
 '실제 입학 배정은 교육지원청에 확인해 주세요',
 '실제 평균 고지서가 아니며',
 '관리사무소 전화 걸기',
 'K-apt에서 단지명으로 관리비 조회',
 '원본 사이트에서 확인할 수 있습니다'
])assert(script.includes(feature),'Business-critical detail functionality must remain: '+feature);
assert(script.includes("(ready?'카카오맵 시설정보를 필요할 때 조회합니다. 거리는 직선거리입니다.':'선택한 시설을 카카오맵에서 바로 검색할 수 있습니다.')"),
 'Do not promise a live in-app lookup when only a Kakao Map search is available');
assert(!script.includes("'공식 카카오맵 자료를 실시간 조회합니다."),
 'Remove unconditional live API claim');
assert(script.includes('<details class="details complexSourceDetails"><summary>자료 출처·기준일 보기</summary>') &&
 script.includes("escapeHtml(updated)+'</p></details>'"),
 'Long school provenance details must be reachable but initially collapsed');
assert(script.includes('현재 선택한 아파트의 배정학교가 아닙니다'),
 'Prominent school allocation caution must remain outside collapsed metadata');
const marker='/* v2.0.46 · Apartment detail tabs';
const start=css.lastIndexOf(marker);
const next=css.indexOf('/* v2.0.47 · REVERSIBLE WORKFLOW PILOT',start+marker.length);
const theme=css.slice(start,next<0?undefined:next);
assert(theme.includes(marker));
for(const s of ['#complexSheet .complexTradeFilters button.active',
 '#complexSheet .complexQuickLinks a','#complexSheet .complexSourceDetails',
 '#complexSheet .nearbyFacilityButtons button.active',
 '#complexSheet .complexTap'])assert(theme.includes(s),'Visual consistency selector missing '+s);
assert(!/grid-template-columns\s*:|(?:^|[;{]\s*)(?:order|position|display|overflow)\s*:/m.test(theme),
 'Do not change the 2-column tab layout, ordering, or page composition');
console.log('Seven apartment detail tabs verified: no duplicate title, safe source disclosures, correct live availability, preserved functions.');
