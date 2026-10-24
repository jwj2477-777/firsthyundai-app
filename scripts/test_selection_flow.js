'use strict';
/* Fluid group-level background, fixed actual text, and no state workflow edits. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'app/src/main/assets/selection-flow.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
new vm.Script(script);
assert(html.includes('<script src="selection-flow.js"></script>'));
assert(!script.includes('cloneNode'),'Never clone text or icon button faces');
assert(css.includes('v2.0.72 · ONE source of truth for equal-rank page headings.'));
assert(css.includes(':is(#trades,#nearby,#new,#officetel,#complexes,#news).page>.sectionTitle:first-child h2{'));
assert(css.includes('#officetel.page>.sectionTitle:first-child p.tiny'));
assert(css.includes('#trades.page>.sectionTitle:first-child #tradesMeta'));
let capture,raf,activeIndex=0,reduce=false;
const created=[],motions=[];
function style(){
 const values={};
 return {
  getPropertyValue:k=>values[k]?.value||'',
  getPropertyPriority:k=>values[k]?.priority||'',
  setProperty(k,v,p=''){values[k]={value:String(v),priority:String(p)};},
  removeProperty:k=>{delete values[k];},
 };
}
function element(tag='span'){
 const x={tagName:tag.toUpperCase(),children:[],style:style(),events:{},
  appendChild(child){this.children.push(child);child.parentElement=this;},
  remove(){this.removed=true;if(this.parentElement)
   this.parentElement.children=this.parentElement.children.filter(e=>e!==this);},
  addEventListener(name,cb){this.events[name]=cb;},
  setAttribute(){},
  animate(frames,options){
   const o={element:this,frames,options,cancel(){},addEventListener(name,cb){this[name]=cb}};
   motions.push(o);return o;
  }};
 created.push(x);return x;
}
const group=element('div');
group.matches=s=>s==='#nav .primaryNav';
group.scrollLeft=0;group.scrollTop=0;
group.getBoundingClientRect=()=>({left:10,top:10,right:390,bottom:170,width:380,height:160});
const labels=['<span class="navIcon">↗</span>실거래',
 '<span class="navIcon">⌂</span>아파트정보'];
function button(index){
 const b=element('button');
 b.disabled=false;b.innerHTML=labels[index];b.parentElement=group;
 b.getBoundingClientRect=()=>({left:20+index*170,top:35,width:156,height:112,
  right:176+index*170,bottom:147});
 b.getAttribute=k=>k==='aria-current'?(activeIndex===index?'page':'false'):null;
 b.classList={contains:k=>k==='active'&&activeIndex===index};
 b.closest=q=>q==='button'?b:q==='.hidden'?null:group;
 return b;
}
const first=button(0),second=button(1);group.children=[first,second];
const document={
 addEventListener(name,fn,opts){
  if(name==='click'){capture=fn;assert.equal(opts.capture,true)}
 },
 createElement:()=>element(),
 head:{appendChild(){}},
 querySelector:s=>s==='#nav .primaryNav'?group:null
};
const colors=['#2456AA','#136D63'];
const window={
 innerWidth:410,innerHeight:900,
 requestAnimationFrame:f=>{raf=f;},
 matchMedia:()=>({matches:reduce}),
 getComputedStyle:b=>{
  const i=[first,second].indexOf(b);
  return {backgroundImage:'none',backgroundColor:activeIndex===i?colors[i]:'#FFFFFF',
   color:activeIndex===i?'rgb(255, 255, 255)':'rgb(40, 70, 85)',
   borderRadius:'18px'};
 }
};
vm.runInNewContext(script,{document,window,Math,Array,Object,Number});
assert.equal(typeof capture,'function');
const beforeLabels=[first.innerHTML,second.innerHTML];
capture({target:second,defaultPrevented:false});
assert.equal(group.children.length,2,'No overlay before native onclick');
activeIndex=1; // User navigation completes synchronously after document capture.
raf(); // The animation reads new selected state before paint.
assert.equal(window.FirstHyundaiSelectionFlow.version,'3.0.0');
assert.equal(group.children.length,6,'Two idle surfaces, single movable pigment and ribbon');
assert.deepEqual([first.innerHTML,second.innerHTML],beforeLabels,'Fonts/labels never replaced');
const layers=group.children.slice(2);
assert(layers.every(x=>x.tagName==='SPAN'),'No duplicate buttons');
assert.equal(layers[0].style.background,'#FFFFFF','Source rests on inactive white surface');
assert.equal(layers[1].style.background,'#FFFFFF','Target starts at original inactive color');
assert.equal(layers[2].children[0].style.background,colors[0],'Fluid starts blue');
assert.equal(layers[2].children[1].style.background,colors[1],'Fluid arrives teal');
assert(layers[3].style.background.includes(colors[0])&&
 layers[3].style.background.includes(colors[1]),'Connector interpolates both palette colors');
assert.equal(first.style.getPropertyValue('background'),'transparent');
assert.equal(second.style.getPropertyValue('background'),'transparent');
assert(motions.some(m=>m.frames.length===5&&m.frames[2].transform.includes('scale(.47,.24)')),
 'Selected paint narrows into a stream instead of moving a button');
assert(motions.some(m=>m.frames.some(x=>x.opacity===.29)),'Liquid bridge is subtly visible');
assert(motions.every(m=>m.options.duration===860),'Deliberate fluid timing');
assert.equal(window.FirstHyundaiSelectionFlow._test.stats.started,1);
const main=motions.find(m=>m.element===layers[2]);
main.finish();
assert.equal(group.children.length,2,'All temporary color layers removed on finish');
assert.equal(first.style.getPropertyValue('background'),'','Actual inactive style restored');
assert.equal(second.style.getPropertyValue('background'),'','Selected CSS palette restored');
assert.equal(window.FirstHyundaiSelectionFlow._test.stats.finished,1);
reduce=true;
capture({target:first,defaultPrevented:false});
assert.equal(group.children.length,2,'Reduced motion disables cosmetic animations');
console.log('Selection flow v3 passed: no text clones, unchanged geometry, palette transfer, cleanup and accessibility.');
