'use strict';
/* V5 regression: actual text never moves, only masked backgrounds change. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('app/src/main/assets/selection-flow.js');
const css=read('app/src/main/assets/ui-v2.css');
const html=read('app/src/main/assets/index.html');
new vm.Script(code);
assert(html.includes('<script src="selection-flow.js"></script>'));
assert(css.includes('v2.0.72 · ONE source of truth for equal-rank page headings.'));
assert(css.includes('v2.0.75 · No layout movement during background transfer'));
assert(!/fhd-wind-|function wind\(|function sweep\(|function layer\(|translate3d|scale\(|rotate\(|clipPath|cloneNode/.test(code),
 'No animated flying slabs, dust, cloned letters, geometry transform or card morph');
assert(code.includes('webkitMaskImage')&&code.includes('maskImage'),
 'Only the selected background mask may change during color handoff');
assert(code.includes("key:'top-five',selector:'#nav'"));
const frames=[];let clickHandler,selected=0,reduced=false;
function style(){
 const m=new Map();
 return {
  setProperty(k,v,p){m.set(k,{value:String(v),priority:p||''})},
  getPropertyValue:k=>m.get(k)?.value||'',
  getPropertyPriority:k=>m.get(k)?.priority||'',
  removeProperty:k=>m.delete(k)
 };
}
function element(tag='span',classes=[]){
 const el={tagName:tag.toUpperCase(),style:style(),children:[],events:{},innerHTML:'',
  parentElement:null,classes:new Set(classes),
  classList:{contains:k=>el.classes.has(k)},
  getAttribute(){return null},setAttribute(){},
  appendChild(child){el.children.push(child);child.parentElement=el},
  remove(){if(el.parentElement)el.parentElement.children=
    el.parentElement.children.filter(x=>x!==el)},
  closest(s){if(s==='button')return el.tagName==='BUTTON'?el:null;
   if(s==='.hidden')return null;
   if(s==='#nav')return nav;
   return null;},
  animate(f,o){return {frames:f,options:o,cancel(){}}},
  getBoundingClientRect(){return el.rect||{width:0,height:0}}
 };
 return el;
}
const nav=element('nav'),primary=element('div',['primaryNav']),
 utility=element('div',['utilityNav']);
primary.parentElement=nav;utility.parentElement=nav;nav.children=[primary,utility];
const labels=['실거래','아파트정보','뉴스','오늘 요약','계약문자 만들기'];
const colors=['#2456AA','#136D63','#6547A5','#4B5895','#9C5737'];
const buttons=labels.map((label,i)=>{
 const b=element('button');b.innerHTML=label;b.disabled=false;
 b.parentElement=i<3?primary:utility;
 const x=i<3?20+i*122:20+(i-3)*184,y=i<3?30:155,w=i<3?112:172,h=i<3?104:67;
 b.rect={left:x,top:y,right:x+w,bottom:y+h,width:w,height:h};
 b.getAttribute=k=>k==='aria-current'?(selected===i?'page':'false'):null;
 b.classList={contains:k=>k==='active'&&selected===i};
 return b;
});
primary.children=buttons.slice(0,3);utility.children=buttons.slice(3);
nav.querySelectorAll=s=>s==='.primaryNav > button, .utilityNav > button'?buttons:[];
let pending=[],cancelled=new Set(),nextId=1;
const requestAnimationFrame=fn=>{const id=nextId++;pending.push({id,fn});return id};
const step=now=>{const n=pending.shift();assert(n,'Missing scheduled animation frame');
 if(!cancelled.has(n.id))n.fn(now)};
const document={
 addEventListener(k,fn,opts){if(k==='click'){clickHandler=fn;assert.equal(opts.capture,true)}},
 head:{appendChild(){}},createElement:()=>element('span'),
 querySelector:s=>s==='#nav'?nav:null
};
const window={
 innerWidth:400,innerHeight:900,requestAnimationFrame,
 cancelAnimationFrame:id=>cancelled.add(id),
 matchMedia:()=>({matches:reduced}),
 getComputedStyle:b=>{
  const i=buttons.indexOf(b);
  return {backgroundImage:'none',
   backgroundColor:i===selected?colors[i]:'#FFFFFF',
   color:i===selected?'white':'rgb(48,72,83)'}
 }
};
vm.runInNewContext(code,{document,window,Math,Number,Object,Array});
const api=window.FirstHyundaiSelectionFlow;
assert.equal(api.version,'5.0.0');
assert.equal(api._test.buttons(nav,'top-five').length,5);
assert.equal(api._test.direction(buttons[0],buttons[4])>90,true,
 'Diagonal from top left to bottom right must use downward gradient');
const reverse=api._test.direction(buttons[4],buttons[0]);
assert(reverse<90||reverse>270,'Reverse gradient must actually point back upwards');
const before=buttons.map(b=>({...b.rect,text:b.innerHTML}));
clickHandler({target:buttons[4],defaultPrevented:false});
selected=4; // Native inline onclick updates selected state
step(0); // capture-then-handler frame sets up selected color only
assert.equal(nav.children.length,2,'Nav layout DOM and row count never changed');
assert.equal(buttons[0].children.length,1);
assert.equal(buttons[4].children.length,1);
const src=buttons[0].children[0],dst=buttons[4].children[0];
assert.equal(src.className,'fhd-color-only-overlay');
assert.equal(dst.className,'fhd-color-only-overlay');
assert.equal(src.style.background,colors[0]);
assert.equal(dst.style.background,colors[4]);
assert.equal(buttons[4].style.getPropertyValue('background'),'#FFFFFF');
assert.equal(buttons[0].style.getPropertyValue('transition'),'none');
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),before,
 'No text, icon dimensions or bounding boxes change');
step(0);step(330);
assert(src.style.webkitMaskImage.includes('linear-gradient'));
assert(dst.style.webkitMaskImage.includes('linear-gradient'));
assert.notEqual(src.style.webkitMaskImage,dst.style.webkitMaskImage);
assert(src.style.webkitMaskImage.includes('transparent'));
assert(dst.style.webkitMaskImage.includes('transparent'));
step(660);
assert.equal(api._test.stats.finished,1);
assert.equal(api._test.stats.topFive,1);
assert.equal(buttons[0].children.length,0);
assert.equal(buttons[4].children.length,0);
assert.equal(buttons[4].style.getPropertyValue('background'),'');
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),before);
clickHandler({target:buttons[1],defaultPrevented:false});
selected=1;step(1200);step(1200);step(1530);step(1860);
assert.equal(api._test.stats.topFive,2,'The bottom-to-upper navigation direction animates');
reduced=true;clickHandler({target:buttons[2],defaultPrevented:false});
assert.equal(pending.length,0);
assert.equal(buttons[1].children.length,0);
console.log('Pure-color v5: all 5 two-row routes, true diagonal/reverse masks, fixed text & geometry, reduced-motion, cleanup passed.');
