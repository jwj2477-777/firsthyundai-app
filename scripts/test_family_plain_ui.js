/* v1.19.16 Parent mode shows actions and concise safety; admin retains the full notes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'theme.css'),'utf8');
const contract=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
const favorites=html.slice(html.indexOf('<div id="nearby"'),html.indexOf('<div id="apiGuide"'));
const news=html.slice(html.indexOf('<div id="news"'),html.indexOf('<div id="contracts"'));
assert(/<body\s+data-office-role="family"(?:\s+[^>]*)?>/.test(html),'Default role prevents explanation flash even with v2 screen markers');
assert(html.includes("document.body?.setAttribute?.('data-office-role',role)"),'Mode changes must update visibility');
assert(css.includes('body:not([data-office-role="admin"]) .adminExplain{display:none!important}'),'Hide admin explanations in family mode');
assert(css.includes('body[data-office-role="admin"] .familySimpleNote{display:none!important}'),'Avoid duplicate notes for admin');
for(const section of [favorites,news,contract])
 assert(section.includes('adminExplain'),'Each family-facing workflow must remove a technical paragraph');
for(const phrase of [
 'Gemini·Groq가 핵심 내용을 요약',
 '금일 천만원',
 '이 안내는 거래당사자에게 계약조건을 전달하고',
 '이 기능은 계약서 자체가 아니라'
]){
 const idx=html.indexOf(phrase);
 assert(idx>0,'Original administrator explanation must survive: '+phrase);
 const start=html.lastIndexOf('<',idx);
 const previous=html.lastIndexOf('adminExplain',idx);
 assert(previous>=0 && previous>=html.lastIndexOf('<p',idx) || 
        phrase==='Gemini·Groq가 핵심 내용을 요약'&&html.lastIndexOf('class="notice adminExplain"',idx)>html.lastIndexOf('<div',idx),
        'Long explanation must be explicitly scoped to admin: '+phrase);
}
for(const removed of [
 '최초 연결 시에는 기존 거래를 알리지 않습니다',
 '앱을 종료한 상태의 실시간 푸시 알림은 별도의 연동이 필요합니다'
])assert(!favorites.includes(removed),'Unnecessary verbose notification explanation removed');
for(const phrase of [
 '뉴스 요약은 참고용입니다. 중요한 정보는 원문에서 확인하세요.',
 '전송 후 동의 여부를 확인하세요.'
])assert(html.includes(phrase),'Keep short family safety instruction '+phrase);
for(const k of [
 'id="favoriteTradeAlertEnabled"','id="favoriteTradeNativeEnabled"',
 'id="favoriteTradeNativeStatus"','id="newsCategory"','id="newsContent"',
 'id="ct_rough"','id="ct_languageWarnings"','id="ct_missing"',
 'FirstHyundaiContracts.approve()','FirstHyundaiContractImage.open()'
])assert(html.includes(k),'Do not hide or remove essential control/status '+k);
assert(!contract.includes('id="ct_noticeConfirmed"')&&!contract.includes('id="ct_includeNotice"'),
 'Parent UI no longer asks for redundant pre-negotiated contract agreement');
const visual=fs.readFileSync(path.join(dir,'ui-v2.css'),'utf8');
for(const token of [
 'body:not([data-office-role="admin"]) #ct_missing.ok',
 'body:not([data-office-role="admin"]) #ct_status',
 'body:not([data-office-role="admin"]) #ct_confirmHelp'
])assert(visual.includes(token),'Family no longer sees repeated informational notes: '+token);
assert(html.includes('id="newsFamilyMeta"'),'Family can still see readable recent news count/time');
assert(html.includes("$('newsFamilyMeta').textContent='갱신 '+compactTradeCollectedAt(payload.checked_at)"),'Compact news date remains dynamic; counts stay beside filtered results');
assert(css.includes('word-break:keep-all')&&css.includes('.sectionTitle>.refreshAction'),'Do not vertically wrap refresh button');
const embedded=html.split('<script>')[1]?.split('</script>')[0];
assert(embedded,'App script exists');
new vm.Script(embedded);
const fn=embedded.slice(embedded.indexOf('function updateRoleBar(){'),embedded.indexOf('function toggleAdminMode(){'));
const node={attributes:{},setAttribute(k,v){this.attributes[k]=v}};
const elements={roleLabel:{textContent:''},roleButton:{textContent:'',setAttribute(k,v){this[k]=v}},modeBar:{className:''}};
const ctx=vm.createContext({role:'family',document:{body:node},$:id=>elements[id]});
vm.runInContext(fn,ctx);
vm.runInContext('updateRoleBar()',ctx);
assert.equal(node.attributes['data-office-role'],'family');
ctx.role='admin';vm.runInContext('updateRoleBar()',ctx);
assert.equal(node.attributes['data-office-role'],'admin');
assert(elements.roleLabel.textContent.includes('관리자'));
assert.equal(elements.roleButton.textContent,'관리자 모드');
assert.equal(elements.roleLabel.textContent,'현재 관리자 모드');
assert(elements.roleButton['aria-label'].includes('가족 모드로 전환'));
ctx.role='family';vm.runInContext('updateRoleBar()',ctx);
assert.equal(node.attributes['data-office-role'],'family','Role must switch without reloading app');
assert.equal(elements.roleButton.textContent,'가족 모드');
assert.equal(elements.roleLabel.textContent,'현재 가족 모드');
assert(elements.roleButton['aria-label'].includes('관리자 모드로 전환'));
assert(html.includes('id="favoriteAlertButton"')&&html.includes('id="favoriteAlertSettingsDialog"'),'Header bell opens the notification settings dialog');
assert(html.indexOf('id="favoriteAlertButton"')<html.indexOf('</header>'),'Bell remains beside family/admin mode');
assert(!favorites.includes('id="favoriteTradeAlertEnabled"'),'Alert preferences must no longer crowd favorite apartment cards');
assert(html.includes('id="favoriteTradeAlertEnabled"')&&html.includes('id="favoriteTradeNativeEnabled"'));
assert(!html.includes('송도 3공구 퍼스트파크 15블럭 사무실 중심'));
assert(html.indexOf('id="modeBar"')<html.indexOf('</header>'));
console.log('Family concise mode passed: explanation visibility, role switching, all actionable controls and safety notes preserved.');
