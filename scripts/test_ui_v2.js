/* FirstHyundai 2.0 visual system + semantic navigation regression.
 * Static design assertions complement pre-existing functional tests; no Android screenshots assumed. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/ui-v2.css');
const theme=read('app/src/main/assets/theme.css');
const native=read('app/src/main/res/values/styles.xml');
const lock=read('app/src/main/java/kr/co/firsthyundai/app/LockActivity.java');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script);new vm.Script(script);
assert(html.indexOf('href="ui-v2.css"')>html.indexOf('href="theme.css"'),'2.0 overrides must load last');
assert(!html.includes('class="brandEdition">2.0</span>'),'Stale fixed-version badge must be removed');
assert(html.includes('class="brandSubtitle"'),'Brand label remains as a compact English subtitle');
assert(html.includes('data-section="nearby"'),'Safe initial design scope');
assert(script.includes("document.body?.setAttribute?.('data-section',id)"),'Screen changes recolor navigation');
const luminance=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const contrast=(fg,bg)=>{let a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
for(const color of ['#2456AA','#136D63','#6547A5','#464DA5','#A44A27','#146A50','#875007']){
 assert(contrast('#FFFFFF',color)>=4.5,'Active button text cannot be low contrast: '+color);
 assert(css.includes(color),'Missing design token '+color);
}
for(const needle of [
 '--ui2-bg:#F4F6FA','--ui2-line:#DCE3ED',
 '#nav .primaryNav button:nth-child(1).active',
 '#nav .primaryNav button:nth-child(2).active',
 '#nav .primaryNav button:nth-child(3).active',
 "#nav .primaryNav button.active::after",
 "content:'✓ 선택됨'",
 '#nav .utilityNav>button:nth-child(1).active',
 '#nav .utilityNav>button:nth-child(2).active',
 '#nav .secondaryNav button.active',
 '#news .newsCategoryTabs>button[aria-selected="true"]',
 '#news .newsCategoryTabs>button[aria-selected="false"]',
 '#trades .tradeStarter button.active',
 '.tradeTypeBar button.active.sale',
 '.tradeTypeBar button.active.lease',
 '.tradeTypeBar button.active.monthly',
 '#complexes .nearbyCard.selected',
 '#contracts .contractMemoInputArea',
 '#contracts .contractMemoCard .contractOneTap',
 '#contracts #ct_resultPanel .contractActions .btn:nth-child(3)',
 '.contractReview.ok,.refreshFeedback.success',
 'body[data-office-role="admin"] .modeBar',
 '@media(max-width:350px)','@media(prefers-contrast:more)',
 '@media(prefers-reduced-motion:reduce)'
])assert(css.includes(needle),'Incomplete commercial UI rule '+needle);
assert(/#nav \.primaryNav button\{[^}]*min-height:102px/.test(css),'Large primary touch area');
assert(/#news \.newsCategoryTabs>button\{[^}]*min-height:64px/.test(css),'Large news tabs');
assert(theme.includes('body:not([data-office-role="admin"]) .adminExplain'),'Family still hides lengthy technical text');
for(const hook of ["FirstHyundaiEasy.compose()","FirstHyundaiContracts.voice()","FirstHyundaiContracts.approve()","FirstHyundaiContractImage.open()","refreshOne('trades',true)","switchNewsPane('subscriptions')","setTradeType('매매')"]){
 assert(html.includes(hook),'Core workflow missing '+hook);
}
assert(native.includes('<item name="android:statusBarColor">#182C46</item>'));
assert(lock.includes('Color.rgb(36, 86, 170)'));
assert(html.includes('aria-current=')&&html.includes('aria-selected="true"'));
console.log('v2.0.0 UI regression passed: independent selection hues, 4.5+ contrast, native branding, screen state and existing actions.');
