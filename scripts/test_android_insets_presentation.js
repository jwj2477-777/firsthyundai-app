'use strict';
/* Screenshot-derived regression: Android 15 edge-to-edge, compact readable tabs. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=get('app/src/main/java/kr/co/firsthyundai/app/SystemBars.java');
const main=get('app/src/main/java/kr/co/firsthyundai/app/MainActivity.java');
const lock=get('app/src/main/java/kr/co/firsthyundai/app/LockActivity.java');
const css=get('app/src/main/assets/ui-v2.css');
const html=get('app/src/main/assets/index.html');
assert(native.includes('Build.VERSION.SDK_INT >= 35'),'Inset hook must only run under enforced edge-to-edge');
assert(native.includes('WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout()'),
 'Account for status text and display cutouts');
assert(native.includes('WindowInsets.Type.navigationBars()')&&native.includes('WindowInsets.Type.ime()'),
 'Account for bottom navigation and keyboard');
assert(native.includes('contentLayout.topMargin=top')&&native.includes('contentLayout.bottomMargin=bottom'),
 'Content must not be behind status/navigation/IME surfaces');
assert(native.includes('windowRoot.setBackgroundColor(Color.rgb(16,45,56))'),
 'Dark background belongs behind white Android status icons');
assert(native.includes('navigationSurface.setBackgroundColor(Color.rgb(247,248,245))'),
 'Navigation bar must have its own light surface for dark icons');
assert(main.includes('SystemBars.install(this,stage);')&&main.includes('stage.addView(web,')&&main.includes('stage.addView(nativeHandoff,'),'WebView and native logo bridge must share one inset-safe content stage');
assert(!main.includes('setContentView(web);'));
assert(lock.includes('SystemBars.install(this,stage);')&&!lock.includes('setContentView(stage);'));
assert(lock.includes('showWelcome(stage);'),'Opening logo must remain present');
assert(main.includes('web.loadUrl("file:///android_asset/index.html")'),'Same WebView entry');
assert(css.includes('/* v2.0.41: real-phone screenshot review'));
const visualStart=css.indexOf('/* v2.0.41: real-phone screenshot review');
const visualEnd=css.indexOf('/* v2.0.42 · SCREENSHOT-DRIVEN CONSISTENCY',visualStart);
const visual=css.slice(visualStart,visualEnd<0?undefined:visualEnd);
for(const t of [
 '#nav .primaryNav button.active::after{content:none;display:none}',
 '#nav .primaryNav button{',
 '#trades .apartmentTradeNav>button',
 '#trades .tradeTypeBar button.active.sale',
 '#trades .tradeTypeBar button.active.lease',
 '#trades .tradeTypeBar button.active.monthly',
 '@media(prefers-contrast:more)'
]) assert(visual.includes(t),'Missing screenshot polish '+t);
assert(!visual.includes('grid-template-columns:'),'Existing navigation structure and column order stay intact');
assert(css.includes('v2.0.72 · ONE source of truth for equal-rank page headings.'),
 'All page heading metadata should now be controlled by one shared typography scale');
assert(!css.includes('#trades .sectionTitle #tradesMeta{font-size:13px'),
 'Do not reintroduce the old high-specificity trade-only 13px text');
const script=html.split('<script>')[1]?.split('</script>')[0];
assert(script&&script.includes("function compactTradeCollectedAt("),'Compact timestamp formatter exists');
assert(script.includes("' · 수집 '+compactTradeCollectedAt(payload.checked_at)"));
const snippet=script.slice(script.indexOf('function compactTradeCollectedAt('),
 script.indexOf('function number(',script.indexOf('function compactTradeCollectedAt(')));
const c=vm.createContext({Date,Intl});
vm.runInContext(snippet,c);
assert.equal(vm.runInContext("compactTradeCollectedAt('2026-10-23T19:37:10Z')",c),'26.10.24 04:37');
assert.equal(vm.runInContext("compactTradeCollectedAt(null)",c),'아직 수집 전');
assert.equal(vm.runInContext("compactTradeCollectedAt('invalid-date')",c),'수집 시각 확인 필요');
console.log('Android safe insets, first-screen visual density and timezone timestamp checks passed.');
