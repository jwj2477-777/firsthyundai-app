'use strict';
/* v2.0.62 · Verify genuine center-to-header FLIP, responsive targets and safe fallback. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'app/src/main/assets/premium-motion.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const main=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
const lock=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/LockActivity.java'),'utf8');
new vm.Script(src);
assert(css.includes('body.fhd-native-handoff header .officeMark')&&css.includes('body.fhd-native-arrived'));
const native=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/SmoothBrandOverlay.java'),'utf8');
const identity=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/BrandIdentityStyle.java'),'utf8');
assert(native.includes('R.drawable.ic_launcher_badge')&&native.includes('DURATION=790L')&&native.includes('getLocationOnScreen'));
assert(native.includes('scaleX(scale).scaleY(scale)'),'Logo scales uniformly, preserving aspect ratio');
assert(native.includes('layoutAttempts>8'),'Prevent infinite layout retries on slow devices');
assert(main.includes('ignored->{')&&main.includes('overlay.detach()'),'Reveal live HTML first, then remove the native brand to prevent a visible blink');
assert(css.includes('.fhd-bridge-backdrop')&&css.includes('linear-gradient(135deg,#03212A,#095B5E)'));
assert(main.includes('nativeHeaderRects?.()')&&main.includes('overlay.moveToHeader('));
assert(native.includes('PathInterpolator(.34f,.06f,.18f,1f)'),'Use gentler takeoff and soft landing');
assert(native.includes('DURATION-LANDING_LEAD')&&native.includes('ObjectAnimator.ofFloat(part,View.ALPHA,1f,0f)'),'Native brand cross-dissolves during landing instead of snapping');
assert(native.includes('LANDING_LEAD=255L')&&native.includes('fade.setDuration(205)'),'Allow enough overlap to hide font-weight and size change');
assert(native.includes('ring.animate().translationX(')&&native.includes('.scaleX(ringScale).scaleY(ringScale)'),'Gold circular halo must travel and shrink with the logo');
assert(!native.includes('ValueAnimator.ofArgb('),'No native text color change during the flight: both ends must start at final colors');
assert(identity.includes('SUBTITLE_COLOR=Color.rgb(216,231,228)')&&identity.includes('TITLE_COLOR=Color.rgb(249,255,255)'),'Start, flight and header use the exact same text colors');
assert(identity.includes('SUBTITLE="FIRST HYUNDAI · REAL ESTATE"'),'Native brand text has the exact header spacing');
assert(lock.includes('BrandIdentityStyle.title(title)')&&lock.includes('BrandIdentityStyle.subtitle(subtitle)'),'Native cold start uses shared typography');
assert(native.includes('BrandIdentityStyle.title(title)')&&native.includes('BrandIdentityStyle.subtitle(subtitle)'),'Native flying text uses the very same typography as cold start');
assert(css.includes('header .brandSubtitle{font-family:Roboto,"Noto Sans KR",sans-serif}'),'WebView matches the native font family fallbacks');
assert(lock.includes('BrandIdentityStyle.logoBacking()')&&native.includes('BrandIdentityStyle.logoBacking()'),'Same logo surround appears on the intro and flying emblem');
assert(native.includes('backing.animate().translationX(')&&native.includes('scaleX(backingScale).scaleY(backingScale)'),'The logo backing travels and shrinks instead of appearing abruptly');
assert(css.includes('background-color:#FDFBF6!important')&&css.includes('background-color 235ms ease-out'),'Main circular cream backing must appear gradually rather than pop');
assert(main.includes('beginNativeHandoffLanding?.()')&&main.includes('onApproach,done'),'Android informs the WebView before the native shared elements land');
assert(src.includes('function beginNativeHandoffLanding()'),'Browser can reveal the existing header before native overlay exits');
assert(css.includes('body.fhd-native-handoff.fhd-native-landing header .officeMark'),'Header arrival CSS blends native and WebView artwork');
assert(main.includes('view.setAlpha(1f)')&&main.includes('ANIMATOR_DURATION_SCALE'));
assert(lock.includes('AccessPolicy.authorized(')&&lock.includes('overridePendingTransition(0,0)'));
function box(left,top,width,height){return {left,top,width,height};}
function harness(width,{reduced=false,hasNative=true,hasHeader=true}={}){
 const logoBounds=box(17,13,55,55),wordBounds=box(90,13,width-193,36),subBounds=box(90,57,width-193,15);
 const animations=[],timers=[],created=[],nodes=[];
 let removed=0;
 class Mock {
  constructor(tag='div',cls=''){this.tag=tag;this.className=cls;this.children=[];this.style={};this.listeners={};this.textContent='';this.attributes={};
   this.classList={add:c=>{this.classes.add(c)},remove:c=>{this.classes.delete(c)},contains:c=>this.classes.has(c)};
   this.classes=new Set();
  }
  setAttribute(a,v){this.attributes[a]=v}
  appendChild(x){this.children.push(x);x.parent=this;nodes.push(x)}
  addEventListener(t,fn){this.listeners[t]=fn}
  remove(){removed++;this.parent&&(this.parent.children=this.parent.children.filter(x=>x!==this))}
  cloneNode(){return new Mock('span','officeMark')}
  getBoundingClientRect(){
   if(this.className==='fhd-bridge-logo')return box((width-144)/2,283,144,144);
   if(this.className==='fhd-bridge-title')return box((width-175)/2,470,175,42);
   if(this.className==='fhd-bridge-subtitle')return box((width-263)/2,548,263,16);
   if(this.className==='officeMark')return logoBounds;
   if(this.tag==='h1')return wordBounds;
   if(this.className==='brandSubtitle')return subBounds;
   return box(0,0,50,50);
  }
  animate(keyframes,opts){
   animations.push({node:this,frames:keyframes,opts});
   return {finished:Promise.resolve()};
  }
 }
 const targets=[new Mock('span','officeMark'),new Mock('h1',''),new Mock('div','brandSubtitle')];
 targets[0].textContent='FHD';targets[1].textContent='퍼스트현대';targets[2].textContent='FIRST HYUNDAI · REAL ESTATE';
 const nav=new Mock('button');
 const body=new Mock('body');
 const found={'header .officeMark':targets[0],'header .brandWordmark h1':targets[1],
  'header .brandSubtitle':targets[2],'#nav .primaryNav button:last-child':nav};
 const document={
  body,createElement:t=>{const n=new Mock(t);created.push(n);return n},
  querySelector:selector=>hasHeader?found[selector]:null,
  addEventListener(){}
 };
 const window={
  matchMedia:()=>({matches:reduced}),
  setTimeout:fn=>{timers.push(fn)},
  ...(hasNative?{FirstHyundaiNative:{}}:{})
 };
 const ctx=vm.createContext({document,window,Number,Math,Promise});
 vm.runInContext(src,ctx);
 return {api:ctx.window.FirstHyundaiMotion,body,created,animations,timers,targets,stats:ctx.window.FirstHyundaiMotion._test.stats,
  get removed(){return removed}};
}
for(const width of [340,393,430]){
 const h=harness(width);
 assert.equal(h.api.prepareBrandHandoff(),true,'Legacy web bridge fallback remains available if needed');
 assert(h.body.classes.has('fhd-brand-handoff'),'Hide duplicate live header during move');
 assert.equal(h.api.prepareBrandHandoff(),false,'Do not create duplicate splash layers');
 assert.equal(h.api.startBrandHandoff(),true);
 const moves=h.animations.filter(x=>x.opts.duration===620&&['fhd-bridge-logo','fhd-bridge-title','fhd-bridge-subtitle'].includes(x.node.className));
 assert.equal(moves.length,3,'Emblem, title, and English subtitle all move separately');
 const expectedRatio=55/144;
 assert(moves[0].frames[1].transform.includes('scale('+expectedRatio),'Badge shrinks to measured original header size');
 assert(moves[0].frames[1].transform.includes('translate3d('),'Fly from center to real top-left');
 assert(moves[1].frames[1].transform.includes('scale('),'Title must scale to actual heading');
 assert(moves[2].frames[1].transform.includes('scale('),'Subtitle must scale to original header subtitle');
 assert.equal(h.stats.entrances,1,'Existing first screen tile animation stays active');
 assert.equal(h.stats.handoffs,0,'Header stays hidden until landing');
 h.timers[0]();
 assert.equal(h.stats.handoffs,1,'Guard callback ends any stuck animation');
 assert(!h.body.classes.has('fhd-brand-handoff'),'Actual header is visible at the end');
 assert.equal(h.api.startBrandHandoff(),false,'Shared transition must be once only');
}
const reduced=harness(393,{reduced:true});
assert.equal(reduced.api.prepareBrandHandoff(),false,'Accessibility reduce motion must disable FLIP');
assert(!reduced.body.classes.has('fhd-brand-handoff'));
const noHeader=harness(393,{hasHeader:false});
assert.equal(noHeader.api.prepareBrandHandoff(),false,'Layout not ready goes through native fallback fade');
const browser=harness(393,{hasNative:false});
assert.equal(browser.api.prepareBrandHandoff(),false,'No simulated native transition on desktop browser');
console.log('Shared brand transition verified: native intro -> measured logo/title/subtitle for 340/393/430, fallback and cleanup.');
