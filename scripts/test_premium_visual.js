'use strict';
/* v2.0.40: prove the redesign is cosmetic and readable. Real-device visual QA remains necessary. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('app/src/main/assets/ui-v2.css');
const html=read('app/src/main/assets/index.html');
const start='/* v2.0.40 / PREMIUM VISUAL REFINEMENT';
const end='/* END v2.0.40 PREMIUM VISUAL REFINEMENT */';
assert(css.includes(start)&&css.includes(end),'Premium layer must be present and intact');
const layer=css.slice(css.lastIndexOf(start),css.lastIndexOf(end)+end.length);
assert(layer.length>6000,'Premium visuals cannot be an empty cosmetic edit');
assert(!/(?:^|[;{]\s*)(?:display|grid-template(?:-columns|-rows)?|(?:min-|max-)?width|(?:min-|max-)?height|padding|margin|gap|order|overflow|z-index|font-size|line-height|white-space|position)\s*:/m.test(layer),
  'Cosmetic layer must not change sizing, display, placement, grid, or text wrapping');
for(const token of ['--ui2-shadow','--ui2-gold','--segment-active','#nearbyCards .compactCardHeading',
 '#complexes #complexCards .nearbyCard.complexSummaryCard','.dealRow .tradeRenewalDetail',
 '#contracts .contractMemoCard','#news .newsCard','prefers-contrast:more','prefers-reduced-motion:reduce'])
 assert(layer.includes(token),'Visual system missing '+token);
for(const core of ['id="nearbyCards"','id="complexCards"','id="ct_rough"',
  'class="propertyTypeSwitch sectionSubnav sectionModeSwitch"','onclick="openTradeLatest()"',
  'onclick="FirstHyundaiEasy.compose()"','onclick="FirstHyundaiTradeAlerts.previewFromSettings()"'])
 assert(html.includes(core),'Do not remove existing layout or actions: '+core);
const lumi=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255)
 .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
 .reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=lumi(a),y=lumi(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
for(const hue of ['#3167B0','#204C90','#1A8077','#0C615B','#7764AC',
 '#5E4C97','#116F68','#255CA5','#64529B','#9C5737','#225A65'])
 assert(ratio('#FFFFFF',hue)>=4.5,'Active label contrast too low: '+hue);
assert(html.includes('href="ui-v2.css"'),'Premium theme remains last CSS layer');
console.log('v2.0.40 premium visual guard passed: semantic contrast, existing controls, unchanged layout geometry.');
