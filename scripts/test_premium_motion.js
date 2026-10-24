'use strict';
/* v2.0.71: old tap/ripple/page-pop motion is removed; startup brand survives. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html'),
 css=read('app/src/main/assets/ui-v2.css'),
 js=read('app/src/main/assets/premium-motion.js'),
 liquid=read('app/src/main/assets/selection-flow.js');
assert(html.includes('<script src="premium-motion.js"></script>'));
assert(html.includes('<script src="selection-flow.js"></script>'));
new vm.Script(js);new vm.Script(liquid);
assert(!js.includes("pointerdown")&&!js.includes("fhd-tap-wave")&&!js.includes("fhd-touch-feedback"),
 'Legacy touch ripple must not be created or attached');
assert(!css.includes("@keyframes fhd-tap-wave")&&!css.includes(".fhd-tap-wave{"),
 'Legacy ripple paint must not be loaded');
assert(!css.includes("@keyframes fhd-page-reveal")&&!css.includes("@keyframes fhd-section-reveal"),
 'Old screen-enter fades must not overlap fluid transfer');
assert(!css.includes("@keyframes fhd-nav-arrive"),
 'Main menu tiles may not hop on appearance');
assert(!/button:active\s*\{\s*transform:scale/.test(css),
 'Old button squeeze must be removed');
assert(css.includes('v2.0.71 · Quiet interaction policy'));
assert(css.includes('.page:not(.hidden),.page:not(.hidden)>.sectionTitle:first-child{\n animation:none!important;'));
assert(css.includes('body.fhd-first-render #nav .primaryNav>button{\n animation:none!important;'));
assert(css.includes('body.fhd-native-handoff header .officeMark') &&
 css.includes('.fhd-bridge-logo'),
 'Original native-to-WebView logo animation stays intact');
assert(!/cloneNode/.test(liquid),'Liquid effect must not clone text/icon labels');
let touchListeners=0;
const flags=new Set(),classList={
 add:x=>flags.add(x),remove:x=>flags.delete(x),contains:x=>flags.has(x)
};
const element=()=>({style:{},setAttribute(){},addEventListener(){},getBoundingClientRect(){return {top:this.top||0}},remove(){}});
const bounds=[
 {left:12,top:18,width:50,height:50},
 {left:77,top:17,width:176,height:34},
 {left:77,top:53,width:240,height:18}
];
const selectors=['header .officeMarkDisplay','header .brandWordmark h1','header .brandSubtitle'];
const targets=selectors.map((_,i)=>({getBoundingClientRect:()=>bounds[i],appendChild(marker){marker.top=bounds[i].top+bounds[i].height*.8}}));
const doc={
 body:{classList},documentElement:{clientWidth:390},
 addEventListener(type){if(type==='pointerdown')touchListeners++},
 createElement:element,
 querySelector:q=>q==='#nav .primaryNav button:last-child'?element():
  q==='header .brandHeaderText'?element():
  targets[selectors.indexOf(q)]||null
};
const context=vm.createContext({
 document:doc,
 window:{FirstHyundaiNative:{},matchMedia:()=>({matches:false}),innerWidth:390,getComputedStyle:node=>({fontSize:node===targets[1]?'28px':'12px'})},
 Number,Math,Promise
});
vm.runInContext(js,context);
assert.equal(touchListeners,0,'No listener performs extra touch effects');
const api=context.window.FirstHyundaiMotion;
assert.equal(api.playEntrance(),true);
assert.equal(api.playEntrance(),false,'Welcome only once');
assert(flags.has('fhd-first-render'));
const rects=api.nativeHeaderRects();
assert.equal(rects.length,17);
assert.equal(rects[13],28);assert.equal(rects[15],12);
assert(flags.has('fhd-native-handoff'));
api.finishNativeHandoff();
assert(!flags.has('fhd-first-render'));
assert(!flags.has('fhd-native-handoff'));
assert(flags.has('fhd-native-arrived'));
for(const fn of ['prepareBrandHandoff','startBrandHandoff','beginNativeHandoffLanding'])
 assert.equal(typeof api[fn],'function',fn+' brand API must remain available');
console.log('Quiet motion verified: no ripple/press/page-hop; native FHD identity preserved; fluid transfer still present.');
