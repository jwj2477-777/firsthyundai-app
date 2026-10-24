'use strict';
/* Regression: capture before inline onclick, animate after it and preserve palette. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'app/src/main/assets/selection-flow.js'),'utf8');
assert(html.includes('<script src="selection-flow.js"></script>'));
new vm.Script(script);
let capture,selected=0,reduced=false,raf,attached=[],animationCalls=[],removed=0;
const group={children:[],matches:s=>s==='#nav .primaryNav'};
function button(index){
 const b={tagName:'BUTTON',parentElement:group,disabled:false,
  innerHTML:index===0?'<span class="navIcon">↗</span><span>실거래</span>':
   '<span class="navIcon">⌂</span><span>아파트정보</span>',
  classList:{contains:c=>c==='active'&&index===selected},
  getAttribute:k=>k==='aria-current'?(index===selected?'page':'false'):null,
  getBoundingClientRect:()=>({left:20+index*140,top:80,width:128,height:110}),
  closest:s=>s==='button'?b:s==='.hidden'?null:group,
  cloneNode:()=>({innerHTML:b.innerHTML,querySelectorAll:()=>[],cloneNode(){return this}})
 };
 return b;
}
group.children=[button(0),button(1)];
function elem(){
 const e={style:{},innerHTML:'',setAttribute(){},remove(){removed++},
  addEventListener(name,callback){if(!this.events)this.events={};this.events[name]=callback},
  append(){},querySelectorAll:()=>[],
  animate(frames,options){
   const a={frames,options,callbacks:{},
    addEventListener(name,cb){this.callbacks[name]=cb},cancel(){}};
   animationCalls.push({el:e,frames,options});
   return a;
  }};
 return e;
}
const document={
 addEventListener(type,cb,options){if(type==='click'){capture=cb;assert.equal(options.capture,true)}},
 createElement:elem,
 head:{appendChild(){}},
 body:{append(...items){attached.push(...items)}},
 querySelector:s=>s==='#nav .primaryNav'?group:null
};
const colors=['#2456AA','#136D63'];
const window={
 innerWidth:390,innerHeight:820,
 matchMedia:()=>({matches:reduced}),
 requestAnimationFrame:cb=>{raf=cb},
 getComputedStyle:b=>{
  const i=group.children.indexOf(b);
  return {backgroundImage:'none',backgroundColor:i===selected?colors[i]:'#FFFFFF',
   color:i===selected?'rgb(255,255,255)':'rgb(54,75,98)',
   border:'2px solid #ccc',borderRadius:'18px',boxShadow:'none',
   font:'800 16px Arial',fontFamily:'Arial',fontSize:'16px',fontWeight:'800',
   lineHeight:'24px',letterSpacing:'0px',textAlign:'center',
   display:'flex',flexDirection:'column',alignItems:'center',
   justifyContent:'center',gap:'6px',padding:'12px'}
 }
};
vm.runInNewContext(script,{document,window,Math,Number,Object,Array});
assert.equal(typeof capture,'function');
const event={target:group.children[1],defaultPrevented:false};
capture(event); // document capture is always before target inline onclick
assert.equal(attached.length,0,'Never use a capture-phase microtask to read selection');
selected=1; // onclick has now switched the selected tab
raf();
assert.equal(attached.length,4,'Color-draining source, inactive target mask and liquid bridge/drop exist');
assert.equal(attached[0].style.background,colors[0],'Outgoing button preserves original blue');
assert.equal(attached[1].style.background,'#FFFFFF','Incoming selected button is temporarily masked with its old white background');
assert(attached[2].style.background.includes(colors[0])&&
 attached[2].style.background.includes(colors[1]),'Bridge blends original old and new palette colors');
assert(animationCalls.length===4);
assert(animationCalls.every(a=>a.options.duration===820));
assert(animationCalls[0].frames.some(k=>k.clipPath?.includes('100%')),'Source visibly drains');
assert(animationCalls[1].frames.some(k=>k.clipPath?.includes('100%')),'Destination visibly fills');
assert.equal(window.FirstHyundaiSelectionFlow._test.stats.requests,1);
assert.equal(window.FirstHyundaiSelectionFlow.version,'2.0.0');
reduced=true;
const previous=attached.length;
capture({target:group.children[0],defaultPrevented:false});
assert.equal(attached.length,previous,'Reduced-motion setting prevents effect');
console.log('Fluid selection handoff: capture/inline timing, same color palette, source drain and destination fill passed.');
