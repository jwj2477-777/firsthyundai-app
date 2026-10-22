/* v2.0.13 regression: a single unobtrusive fixed scroll-to-top control, tab and apartment sheets. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/ui-v2.css');
const js=read('app/src/main/assets/scroll-top.js');
new vm.Script(js);
assert.equal((html.match(/id="scrollToTop"/g)||[]).length,1,'One floating control across all tabs');
assert(html.includes('src="scroll-top.js"'));
assert(html.includes('aria-label="현재 화면 맨 위로 이동"'));
assert(html.includes('hidden>↑</button>'),'Button is icon-only and initially hidden');
assert(css.includes('position:fixed;z-index:165'),'Control stays fixed above detail sheets');
assert(css.includes('width:44px;height:44px'),'Keep the small touch-friendly 44px circle');
assert(css.includes('safe-area-inset-bottom'),'Avoid Android navigation and display insets');
assert(css.includes('main{padding-bottom:calc(100px'),'Keep bottom lines clear of button');
assert(css.includes('.apartmentSheet.panel{padding-bottom:calc(102px'),'Keep detail ending clear of button');
assert(html.includes('window.FirstHyundaiScrollTop?.update?.();'),'Refresh after page/sheet navigation');
function element(id){
 const listeners={};
 const attrs={};
 const classes=new Set();
 return {
  id,scrollTop:0,hidden:true,listeners,attrs,classes,
  classList:{contains:x=>classes.has(x)},
  getAttribute:x=>attrs[x],
  setAttribute:(key,val)=>{attrs[key]=val},
  addEventListener:(type,fn)=>{listeners[type]=fn},
  scrollTo(opts){this.scrollOpts=opts;this.scrollTop=opts.top}
 };
}
const button=element('scrollToTop');
const complex=element('complexSheet');
const nearby=element('nearbyDetails');
const nodes={scrollToTop:button,complexSheet:complex,nearbyDetails:nearby};
const scrolling={scrollTop:0};
const root={scrollTop:0};
const body={scrollTop:0};
const events={};
const window={
 scrollY:0,
 addEventListener:(type,fn)=>{events[type]=fn},
 scrollTo(o){this.lastScroll=o;this.scrollY=o.top;scrolling.scrollTop=o.top},
 matchMedia:()=>({matches:false})
};
const document={getElementById:id=>nodes[id],scrollingElement:scrolling,documentElement:root,body};
vm.runInNewContext(js,{window,document,Number,Math});
const top=window.FirstHyundaiScrollTop;
assert(top&&typeof top.update==='function'&&typeof top.go==='function');
assert.equal(button.hidden,true,'Hidden at page start');
scrolling.scrollTop=240;events.scroll();assert(button.hidden,'Not shown until sufficiently scrolled');
scrolling.scrollTop=320;events.scroll();assert.equal(button.hidden,false,'Shown on long tab');
assert.equal(button.attrs['aria-hidden'],'false');
button.listeners.click();assert.equal(window.lastScroll.top,0);assert.equal(button.hidden,true);
assert.equal(window.lastScroll.behavior,'smooth');
window.scrollY=500;scrolling.scrollTop=500;
complex.classes.add('detailOpen');complex.attrs['aria-hidden']='false';complex.scrollTop=0;
top.update();assert(button.hidden,'Long background scroll does not show atop a fresh detail sheet');
complex.scrollTop=450;complex.listeners.scroll();assert.equal(button.hidden,false,'Detail sheet has own scroll');
button.listeners.click();assert.equal(complex.scrollTop,0,'Click scrolls detail, not underlying tab');
assert.equal(window.scrollY,500,'Background scroll preserved');
assert.equal(button.hidden,true);
complex.classes.delete('detailOpen');complex.attrs['aria-hidden']='true';
nearby.classes.add('detailOpen');nearby.attrs['aria-hidden']='false';nearby.scrollTop=380;
top.update();assert.equal(button.hidden,false);
window.matchMedia=()=>({matches:true});
button.listeners.click();assert.equal(nearby.scrollOpts.behavior,'auto','Reduced motion honored');
nearby.classes.delete('detailOpen');nearby.attrs['aria-hidden']='true';
top.update();assert.equal(button.hidden,false,'Restores underlying tab button state');
console.log('Scroll-to-top regression passed: all tabs, both sheets, safe placement and reduced motion.');
