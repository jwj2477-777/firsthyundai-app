'use strict';
/* v2.0.43 final-polish regression from 10 real Galaxy scroll captures. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('app/src/main/assets/ui-v2.css');
const html=read('app/src/main/assets/index.html');
const theme=css.slice(css.lastIndexOf('/* v2.0.43 · ALL-TABS REAL-DEVICE FINISH'));
assert(theme.length>5000,'Missing scoped cross-screen finishing theme');
for(const term of [
 '#complexSheet.apartmentSheet.panel','#nearbyDetails.apartmentSheet.panel',
 '#complexSheet .detailSheetTop','#complexSheet .complexTabBar button.active',
 '#complexSheet .complexFacts','#complexSheet .complexFact strong',
 '#complexSheet .complexCallButton',
 '#contracts .contractHero','#contracts .contractSteps li',
 '#contracts .contractMemoCard #ct_rough',
 '#contracts .contractMemoCard .contractOneTap',
 '#overview .metric',
 '#news #publicSubscriptions .subscriptionListingCard',
 '#news #publicSubscriptions .subscriptionListingCard .subscriptionDate',
 '#officetel .officeUnifiedDeal','#new .dealRow','#nearby #nearbyCards .favoriteSummaryCard',
 '@media(prefers-contrast:more)'
])assert(theme.includes(term),'Missing screen treatment: '+term);
assert(!/grid-template-columns\s*:|(?:^|[{;]\s*)(?:display\s*:\s*none|position\s*:\s*(?:fixed|absolute)|order\s*:)/m.test(theme),
 'Do not rearrange cards or hide essential content');
assert(theme.includes('min-height:56px'),'Primary contract action remains large');
assert(html.includes('nearbyFacilityItem subscriptionListingCard'),'Scoped subscription style must load');
assert(html.includes('class="tiny subscriptionDate"'),'Official application period remains visibly labeled');
for(const hook of [
 "switchNewsPane('subscriptions')",
 "renderPublicSubscriptions()",
 "onclick=\"FirstHyundaiEasy.compose()\"",
 "onclick=\"FirstHyundaiContracts.voice()\"",
 "onclick=\"FirstHyundaiContracts.fromSelectedComplex()\"",
 "onclick=\"closeApartmentSheet()\"",
 "onclick=\"switchPage('nearby')\"",
 "onclick=\"switchPage('new')\"",
 "id=\"ct_rough\" rows=\"10\" maxlength=\"12000\"",
 "id=\"tradesContent\"",
 "id=\"nearbyCards\"",
 "id=\"complexCards\""
])assert(html.includes(hook),'Lost original function or data hook: '+hook);
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
const start=script.indexOf('function renderPublicSubscriptions(){');
const end=script.indexOf('async function refreshPublicServices(',start);
const source=script.slice(start,end);
for(const phrase of [
 'subscriptionStage(p,today)','officialSubscriptionUrl(p.notice_url)',
 "escapeHtml(p.name||'명칭 미표시')","escapeHtml(p.address||'공급위치 확인 필요')",
 "escapeHtml(p.notice_date||'확인 필요')",
 'escapeHtml(p.apply_start)','escapeHtml(p.apply_end)',
 'sourceLink(official','verifiedRecords('
])assert(source.includes(phrase),'Official subscription data field lost: '+phrase);
assert(html.includes('자료 차이·확인사항 보기')&&html.includes('관리사무소 전화 걸기'),
 'Verified apartment details/actions must survive');
assert(html.includes('id="ct_polishTerms"')&&html.includes('id="ct_reviewDetails"'),
 'Contract safety review must remain');
console.log('v2.0.43 all-tab presentation regression passed: visual scopes, source fields, large actions, unchanged routes.');
