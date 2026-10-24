'use strict';
/* Regression: real news markup + native CSS variable transition. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/ui-v2.css');
const flow=read('app/src/main/assets/selection-flow.js');
assert(html.includes('class="controls newsCategoryTabs sectionModeSwitch"'));
assert(html.includes('onclick="switchNewsPane(\'articles\')"'));
assert(html.includes('onclick="switchNewsPane(\'subscriptions\')"'));
assert(html.includes("setAttribute('aria-selected',pane==='articles'?'true':'false')"));
assert(html.includes("setAttribute('aria-selected',pane==='subscriptions'?'true':'false')"));
assert(css.includes('@property --fhd-native-fill'));
assert(css.includes('#news .newsCategoryTabs.sectionModeSwitch>button[aria-selected="true"]'));
assert(css.includes('--fhd-native-fill:100%'));
assert(css.includes('transition:--fhd-native-fill 660ms'));
assert(css.includes('#6547A5'));
assert(css.includes('v2.0.74 · News tabs must NEVER move'));
assert(flow.includes("if(isNativeRow(row))return null"),
 'No JS repaint may override the browser-native fill');
assert(flow.includes("row.setAttribute?.('data-fhd-direction',next<previous?'left':'right')"));
console.log('News tab native CSS trigger: both real aria-selected labels and correct purple fill are wired.');
