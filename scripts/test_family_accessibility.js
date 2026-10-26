/* Family accessibility and visual refresh regression: no color-only signals.
 * This is a static guard, not a replacement for actual on-device review. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('app/src/main/assets/theme.css');
const html=read('app/src/main/assets/index.html');
const lock=read('app/src/main/java/kr/co/firsthyundai/app/LockActivity.java');
const native=read('app/src/main/res/values/styles.xml');
const image=read('app/src/main/assets/contract-image.js');
const contractCSS=read('app/src/main/assets/contracts.css');
const gr=(s,key)=>{assert(s.includes(key),'Missing '+key);};
const luminance=h=>{
 const a=h.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255)
  .map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
 return a[0]*0.2126+a[1]*0.7152+a[2]*0.0722;
};
const ratio=(a,b)=>{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
};
for(const [fg,bg] of [
 ['#ffffff','#155a66'],['#ffffff','#163b46'],
 ['#26333a','#f2f6f6'],['#234d58','#e8f2f1'],
 ['#536570','#ffffff'],['#52646d','#eaf4f3'],
 ['#154a80','#dceafe'],['#135a44','#ddf2e7'],
 ['#764505','#ffebc9'],['#74420f','#fff1de'],
 ['#ffffff','#925808']
])assert(ratio(fg,bg)>=4.5,'Insufficient text contrast '+fg+' '+bg+': '+ratio(fg,bg));
for(const sel of [
 '--fhd-primary:#155a66','--fhd-page:#f2f6f6',
 '.primaryNav button.active::after', "content:'현재 메뉴'",
 '.secondaryNav button.active','.utilityNav>button.active',
 '.nearbyCard[aria-pressed="true"]',
 '.modeAdmin{background:#fff1df',
 '.refreshFeedback.error','.refreshFeedback.success','.refreshFeedback.warning',
 '.dealRow.sale','.dealRow.lease','.dealRow.monthly',
 '.favoriteTradeAlertDialog{background:#fff',
 '.contractHero{background:linear-gradient',
 '.contractMemoCard .contractOneTap',
 '@media(prefers-contrast:more)','@media(prefers-reduced-motion:reduce)'
])gr(css,sel);
assert(/\.primaryNav button\s*\{[^}]*min-height:96px/.test(css),'Main navigation touch targets');
assert(/\.secondaryNav button\s*\{[^}]*min-height:54px/.test(css),'Secondary navigation touch targets');
assert(/\.btn,button\.btn\s*\{[^}]*min-height:50px/.test(css),'Button touch targets');
assert(/input,select,textarea\s*\{[^}]*min-height:50px/.test(css),'Input touch targets');
assert(/\.nearbyCard strong\s*\{[^}]*font-size:16px/.test(css),'Apartment names legible');
assert(/\.tiny,\.smaller,\.item \.meta,\.complexMeta,\.complexDetailAddress,\.muted\s*\{[^}]*font-size:14px/.test(css),'Secondary text not micro-sized');
assert(/\.sectionTitle h2\s*\{[^}]*font-size:21px/.test(css),'Readable section headings');
gr(html,'<meta name="theme-color" content="#133E48">');
gr(html,'aria-current="\'+(id===\'overview\'?\'page\':\'false\')');
gr(html,'aria-current="\'+(id===\'contracts\'?\'page\':\'false\')');
gr(html,"document.title='퍼스트현대 · '+pageNames[id]");
gr(html,'class="tradeStarter apartmentTradeNav"');
gr(html,'aria-current="page" onclick="openTradeLatest()"');
gr(html,'aria-current="page" onclick="switchPage(\'nearby\')"');
gr(html,'aria-current="page" onclick="switchPage(\'new\')"');
gr(html,"'aria-pressed',nearbySelected==='all'?'true':'false'");
gr(html,"button.setAttribute('aria-pressed',active?'true':'false')");
for(const label of ['매매','전세','월세'])gr(html,label);
for(const workflow of ['FirstHyundaiEasy.compose()','FirstHyundaiContracts.voice()','FirstHyundaiContractImage.open()']){
 gr(html,workflow);
}
gr(contractCSS,'#contracts .contractMemoCard #ct_rough');
gr(native,'<item name="android:statusBarColor">#133E48</item>');
gr(native,'<item name="android:navigationBarColor">#F0F8F6</item>');
gr(lock,'Color.rgb(6,65,70)');
gr(lock,'codeField.setContentDescription("사무실 공통 보안코드 입력")');
gr(lock,'codeField.setTextSize(16)');
gr(lock,'foot.setTextSize(12)');
gr(lock,'loginPanel.setBackground(panelSurface)');
gr(lock,'new LinearLayout.LayoutParams(-1,dp(56))');
gr(lock,'choice.setMinimumHeight(dp(56))');
gr(lock,'choice.setContentDescription(name+(current?');
gr(lock,'codeField.setOnEditorActionListener(');
gr(image,"c.fillStyle='#155a66'");
assert(!/\b(?:fetch|XMLHttpRequest|localStorage)\b/.test(image),'Contract PNG remains offline');
console.log('Family accessibility/theme regression passed: touch targets, state cues, contrast, labels, native colors and existing workflows.');
