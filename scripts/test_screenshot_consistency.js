'use strict';
/* Three real-device screenshots: presentation and parent-view metadata regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/ui-v2.css');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new vm.Script(js);
const marker='/* v2.0.42 · SCREENSHOT-DRIVEN CONSISTENCY';
assert(css.includes(marker));
const begin=css.lastIndexOf(marker);
const next=css.indexOf('/* v2.0.43 · ALL-TABS REAL-DEVICE FINISH',begin+marker.length);
const layer=css.slice(begin,next>=0?next:undefined);
for(const needle of [
 '#trades.page>.sectionTitle:first-child h2',
 '#complexes.page>.sectionTitle:first-child h2',
 '#news.page>.sectionTitle:first-child h2',
 '#news .familyBriefCaution',
 '#news .newsCard h3',
 '#complexes .complexSearchPanel',
 '#complexes #complexSearch',
 '#complexes #complexCards .nearbyCard.complexSummaryCard',
 '#trades .tradeAdvanced',
 '@media(prefers-contrast:more)'
])assert(layer.includes(needle),'Missing common visual rule '+needle);
assert(!/grid-template-columns\s*:|(?:^|[{;]\s*)(?:display|position|order|overflow)\s*:/m.test(layer),
 'Shared visual layer must not alter screen/page composition');
assert(/#complexes #complexSearch\{[^}]*min-height:55px/.test(layer),
 'Search target stays comfortably tappable');
for(const preserved of [
 '<h2 id="newsSectionTitle">송도·부동산 뉴스 브리핑</h2>',
 '뉴스 요약은 참고용입니다. 중요한 정보는 원문에서 확인하세요.',
 "switchNewsPane('articles')","switchNewsPane('subscriptions')",
 "onclick=\"openTradeLatest()\"","onclick=\"switchPage('nearby')\"",
 "onclick=\"switchPage('new')\"",
 "onclick=\"FirstHyundaiTradeAlerts.preview()\"",
 "onclick=\"FirstHyundaiEasy.compose()\"",
 "id=\"complexCards\"","id=\"tradesContent\""
])assert(html.includes(preserved),'Must preserve existing UI and behavior: '+preserved);
assert(js.includes("$('newsFamilyMeta').textContent='갱신 '+compactTradeCollectedAt(payload.checked_at)"),
 'Use verified KST timestamp with no seconds on family news page');
assert(js.includes(" $('complexMeta').textContent='조회 '+visible.length+'곳'+(role==='admin'?' · 원자료 '+(remote.complexes?.records||[]).length+'건':'')+"),
 'Family list should show count of search-selectable complexes, admin can still inspect full records');
for(const warning of ["issues.trades?' · 실거래 갱신 오류'","issues.complexes?' · 단지정보 갱신 오류'","일부 수집 실패: 최신성 주의"])
 assert(js.includes(warning),'Never hide collection/data warnings');
const snippet=js.slice(js.indexOf('function compactTradeCollectedAt('),js.indexOf('function number('));
const ctx=vm.createContext({Date,Intl});vm.runInContext(snippet,ctx);
assert.equal(vm.runInContext("compactTradeCollectedAt('2026-10-23T21:38:26Z')",ctx),'26.10.24 06:38');
assert.equal(vm.runInContext("compactTradeCollectedAt(null)",ctx),'아직 수집 전');
console.log('Three screenshots: consistent headlines, compact KST news metadata, meaningful apartment counts, preserved data warnings and actions.');
