'use strict';
/* Wind-drift regression: 5 global navigation destinations across two rows,
 * stationary real text, palette preservation, no circular moving card. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const script=fs.readFileSync(path.join(root,'app/src/main/assets/selection-flow.js'),'utf8');
new vm.Script(script);
assert(html.includes('<script src="selection-flow.js"></script>'));
assert(css.includes('v2.0.72 · ONE source of truth for equal-rank page headings.'));
assert(!script.includes('cloneNode'),'Never copy real icon or text faces');
assert(!/scale\(\.47,\.24\)|borderRadius:'48%'|fhd-liquid-trail|fhd-liquid-drop/.test(script),
 'Circular slug, bridge and balloon morph are forbidden');
assert(script.includes("key:'top-five',selector:'#nav'"),
 'Global navigation must contain both top rows and all 5 destinations');
assert(script.includes(".primaryNav > button, .utilityNav > button"),
 'All 5 destinations share the same source/target group');
assert(script.includes("function fillFrame"),'Flat edge-on wipe rather than rounded blob');
assert(script.includes("function wind("),'Sparse wind particles accompany the wipe');
let handler,raf,selected=0,reduced=false;
const animations=[];
function style(){
 const data=new Map();
 return {
  getPropertyValue:k=>data.get(k)?.value||'',
  getPropertyPriority:k=>data.get(k)?.priority||'',
  setProperty(k,v,p=''){data.set(k,{value:String(v),priority:String(p)})},
  removeProperty(k){data.delete(k)}
 };
}
function mock(tag='span',classes=[]){
 const obj={
  tagName:tag.toUpperCase(),style:style(),classNames:new Set(classes),
  children:[],events:{},innerHTML:'',parentElement:null,
  classList:{contains(k){return obj.classNames.has(k)}},
  setAttribute(){},
  appendChild(child){obj.children.push(child);child.parentElement=obj},
  remove(){
   if(obj.parentElement)obj.parentElement.children=
    obj.parentElement.children.filter(el=>el!==obj);
  },
  addEventListener(k,fn){obj.events[k]=fn},
  animate(frames,options){
   const a={node:obj,frames,options,callbacks:{},
    addEventListener(k,fn){this.callbacks[k]=fn},cancel(){}};
   animations.push(a);return a;
  },
  getBoundingClientRect(){return obj.rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}},
  closest(selector){
   if(selector==='button')return obj.tagName==='BUTTON'?obj:null;
   if(selector==='.hidden')return null;
   if(selector==='#nav')return nav;
   return null;
  }
 };
 return obj;
}
const nav=mock('nav');
nav.rect={left:10,top:10,right:390,bottom:300,width:380,height:290};
const primary=mock('div',['primaryNav']),utility=mock('div',['utilityNav']);
primary.parentElement=nav;utility.parentElement=nav;
const btns=Array.from({length:5},(_,i)=>{
 const b=mock('button');
 b.parentElement=i<3?primary:utility;
 b.rect=i<3?
  {left:20+i*123,top:27,right:131+i*123,bottom:128,width:111,height:101}:
  {left:20+(i-3)*182,top:151,right:192+(i-3)*182,bottom:224,width:172,height:73};
 b.innerHTML=['<span>↗</span>실거래','<span>⌂</span>아파트정보','<span>▤</span>뉴스','▦ 오늘 요약','✎ 계약문자 만들기'][i];
 b.getAttribute=k=>k==='aria-current'?(i===selected?'page':'false'):null;
 b.classList={contains:k=>k==='active'&&i===selected};
 return b;
});
primary.children=btns.slice(0,3);utility.children=btns.slice(3);
nav.children=[primary,utility];
nav.querySelectorAll=s=>s==='.primaryNav > button, .utilityNav > button'?btns:[];
const colors=['#2456AA','#13766B','#6547A5','#787FCA','#D99A7B'];
const document={
 head:{appendChild(){}},
 createElement:()=>mock('span'),
 addEventListener(k,fn,opts){
  if(k==='click'){handler=fn;assert.equal(opts.capture,true)}
 },
 querySelector:sel=>sel==='#nav'?nav:null
};
const window={
 innerWidth:410,innerHeight:890,
 requestAnimationFrame(fn){raf=fn},
 matchMedia:()=>({matches:reduced}),
 getComputedStyle:b=>{
  const i=btns.indexOf(b);
  return {
   backgroundImage:'none',
   backgroundColor:i===selected?colors[i]:'#FFFFFF',
   color:i===selected?'rgb(255, 255, 255)':'rgb(49, 77, 88)',
   borderRadius:i<3?'18px':'13px'
  };
 }
};
vm.runInNewContext(script,{document,window,Math,Object,Array,Number});
const api=window.FirstHyundaiSelectionFlow;
assert.equal(api.version,'4.0.0');
assert.equal(api._test.buttons(nav,'top-five').length,5);
const labels=btns.map(b=>b.innerHTML);
assert.equal(api._test.findGroup(btns[4]).spec.key,'top-five');
function change(to){
 handler({target:btns[to],defaultPrevented:false});
 selected=to;  // direct button onclick completes; #nav is logically rerendered
 assert.equal(nav.children.length,2,'No temporary shapes during click capture');
 raf();
}
change(4); // top-left blue to bottom-right orange
const shapes=nav.children.slice(2);
assert.equal(shapes.length,15,'Two bases + two wipes + three wisps and eight dust grains');
assert(shapes.every(x=>x.tagName==='SPAN'));
assert.equal(shapes.filter(x=>x.className==='fhd-wind-wisp').length,3);
assert.equal(shapes.filter(x=>x.className==='fhd-wind-grain').length,8);
assert.equal(shapes[0].style.background,'#FFFFFF','Outgoing rests on original inactive palette');
assert.equal(shapes[1].style.background,'#FFFFFF','Incoming starts as original idle surface');
assert.equal(shapes[2].style.background,colors[0],'Original blue selected background is retained');
assert.equal(shapes[3].style.background,colors[4],'New contract color is retained');
assert.deepEqual(btns.map(b=>b.innerHTML),labels,'Buttons retain real text and icons');
assert.equal(btns[0].style.getPropertyValue('background'),'transparent');
assert.equal(btns[4].style.getPropertyValue('background'),'transparent');
const retreat=animations.find(a=>a.node===shapes[2]);
const arrive=animations.find(a=>a.node===shapes[3]);
assert(retreat.frames.some(x=>x.clipPath?.includes('inset(0% 0% 0% 100%')),
 'Source color moves away as a flat wipe');
assert(arrive.frames.some(x=>x.clipPath?.includes('inset(0% 100% 0% 0%')),
 'Destination fills from incoming edge');
assert(animations.every(x=>x.options.duration===760));
assert(!animations.some(x=>x.node===shapes[2]&&
 x.frames.some(k=>k.transform?.includes('scale('))),'Main tab is not a moving ball');
assert.equal(api._test.stats.topFive,1);
retreat.callbacks.finish();
assert.equal(nav.children.length,2,'All decorative layers must be removed on finish');
assert.equal(btns[0].style.getPropertyValue('background'),'');
assert.equal(btns[4].style.getPropertyValue('background'),'');
change(1); // cross row reverse: contract -> apartment info
assert.equal(api._test.stats.topFive,2);
const next=nav.children.slice(2);
assert.equal(next[2].style.background,colors[4]);
assert.equal(next[3].style.background,colors[1]);
animations.filter(a=>a.node===next[2])[0].callbacks.finish();
reduced=true;
handler({target:btns[2],defaultPrevented:false});
assert.equal(nav.children.length,2,'Reduced motion disables the wind');
assert.equal(api._test.stats.finished,2);
console.log('Wind-drift v4 passed: all five upper menus, cross-row palette flow, no circular morph, real text stable, cleanup and accessibility.');
