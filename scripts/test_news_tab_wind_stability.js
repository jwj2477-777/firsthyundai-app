'use strict';
/* Lower news/subscription buttons: color transition runs without heading jump. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=load('app/src/main/assets/ui-v2.css'),html=load('app/src/main/assets/index.html');
const code=load('app/src/main/assets/selection-flow.js');
assert(css.includes('v2.0.74 · News tabs must NEVER move'));
assert(css.includes('#news.page>.sectionTitle.newsUnifiedHeading>div{'));
assert(css.includes('min-height:88px')&&css.includes('min-height:134px'));
assert(html.includes("switchNewsPane('articles')")&&html.includes("switchNewsPane('subscriptions')"));
new vm.Script(code);
let click,active=0,tickId=0;
const queue=[];
function style(){
 const m=new Map();
 return {getPropertyValue:k=>m.get(k)?.v||'',getPropertyPriority:k=>m.get(k)?.p||'',
  setProperty:(k,v,p)=>m.set(k,{v,p}),removeProperty:k=>m.delete(k)};
}
function el(tag='span'){
 const x={tagName:tag.toUpperCase(),style:style(),children:[],parentElement:null,
  disabled:false,innerHTML:'',classList:{contains(){return false}},
  setAttribute(){},getAttribute(){return null},
  appendChild(child){x.children.push(child);child.parentElement=x},
  remove(){if(x.parentElement)x.parentElement.children=
   x.parentElement.children.filter(y=>y!==x)},
  getBoundingClientRect(){return x.rect},
  animate(){return {cancel(){}}},
  closest(sel){
   if(sel==='button')return x.tagName==='BUTTON'?x:null;
   if(sel==='.hidden'||sel==='#nav')return null;
   if(sel==='.page:not(.hidden) .newsCategoryTabs')return group;
   return null;}
 };
 return x;
}
const group=el('div');group.rect={left:10,top:200,width:375,height:90,right:385,bottom:290};
group.querySelectorAll=()=>[];
const buttons=[0,1].map(i=>{
 const b=el('button'),left=20+i*177;
 b.parentElement=group;b.innerHTML=i?'인천 청약·분양':'뉴스 브리핑';
 b.getAttribute=k=>k==='aria-selected'?(active===i?'true':'false'):null;
 b.rect={left,top:211,width:168,height:62,right:left+168,bottom:273};
 return b;
});
group.children=buttons;
const doc={
 addEventListener(k,fn,opts){if(k==='click'){click=fn;assert.equal(opts.capture,true)}},
 createElement:()=>el('span'),head:{appendChild(){}},
 querySelector:sel=>sel==='.page:not(.hidden) .newsCategoryTabs'?group:null
};
const win={innerWidth:410,innerHeight:860,
 requestAnimationFrame(fn){queue.push(fn);return ++tickId},
 cancelAnimationFrame(){},
 matchMedia:()=>({matches:false}),
 getComputedStyle:button=>{
  const i=buttons.indexOf(button);
  return {backgroundImage:'none',
   backgroundColor:active===i?'#6547A5':'#FCFBFE',
   color:active===i?'white':'#5C5275'};
 }
};
vm.runInNewContext(code,{document:doc,window:win,Math,Number,Object,Array});
const api=win.FirstHyundaiSelectionFlow;
function frame(time){const fn=queue.shift();assert(fn,'Missing RAF');fn(time)}
const prev=buttons.map(b=>({...b.rect,text:b.innerHTML}));
click({target:buttons[1],defaultPrevented:false});
active=1;frame(0);
assert.equal(api._test.stats.news,1,'Lower switch receives the color animation');
assert.equal(group.children.length,2,'No extra group blocks shift news heading');
assert.equal(buttons[0].children.length,1);
assert.equal(buttons[1].children.length,1);
assert.equal(buttons[0].children[0].style.background,'#6547A5');
assert.equal(buttons[1].children[0].style.background,'#6547A5');
frame(0);frame(330);
assert(buttons[0].children[0].style.maskImage.includes('transparent'));
assert(buttons[1].children[0].style.maskImage.includes('transparent'));
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),prev);
frame(660);
assert.equal(buttons[0].children.length,0);
assert.equal(buttons[1].children.length,0);
assert.equal(api._test.stats.finished,1);
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),prev);
console.log('News/subscription color-only handoff and fixed section-heading geometry passed.');
