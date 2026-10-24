'use strict';
/* News 2-tab regression: selected purple must visibly flow DIRECTLY on both
 * button backgrounds (prior z-index:-1 overlay was hidden under buttons). */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('app/src/main/assets/ui-v2.css');
const html=read('app/src/main/assets/index.html');
const code=read('app/src/main/assets/selection-flow.js');
assert(css.includes('v2.0.74 · News tabs must NEVER move'));
assert(css.includes('#news.page>.sectionTitle.newsUnifiedHeading>div{'));
assert(css.includes('min-height:88px')&&css.includes('min-height:134px'));
assert(html.includes("switchNewsPane('articles')")&&
 html.includes("switchNewsPane('subscriptions')"));
assert(!code.includes('z-index:-1'));
new vm.Script(code);
let click,selected=0,id=0;
const queue=[],cancelled=new Set();
function style(){
 const values=new Map();
 return {setProperty:(k,v,p='')=>values.set(k,{v:String(v),p}),
  getPropertyValue:k=>values.get(k)?.v||'',
  getPropertyPriority:k=>values.get(k)?.p||'',
  removeProperty:k=>values.delete(k)};
}
function item(tag='button'){
 const el={tagName:tag.toUpperCase(),style:style(),children:[],parentElement:null,
  classList:{contains(){return false}},disabled:false,innerHTML:'',
  closest(selector){
   if(selector==='button')return el.tagName==='BUTTON'?el:null;
   if(selector==='.hidden'||selector==='#nav')return null;
   if(selector==='.page:not(.hidden) .newsCategoryTabs')return group;
   return null;},
  getAttribute(){return null},
  getBoundingClientRect(){return el.rect}
 };
 return el;
}
const group=item('div');
group.rect={left:10,top:200,width:375,height:90,right:385,bottom:290};
const buttons=[0,1].map(i=>{
 const b=item(),x=20+i*177;
 b.parentElement=group;b.innerHTML=i?'인천 청약·분양':'뉴스 브리핑';
 b.getAttribute=k=>k==='aria-selected'?(i===selected?'true':'false'):null;
 b.rect={left:x,top:211,width:168,height:62,right:x+168,bottom:273};
 return b;
});
group.children=buttons;
const document={
 addEventListener(k,fn,opt){if(k==='click'){click=fn;assert.equal(opt.capture,true)}},
 querySelector:s=>s==='.page:not(.hidden) .newsCategoryTabs'?group:null
};
const window={innerWidth:410,innerHeight:860,
 requestAnimationFrame(fn){const key=++id;queue.push({id:key,fn});return key},
 cancelAnimationFrame(key){cancelled.add(key)},
 matchMedia:()=>({matches:false}),
 getComputedStyle:b=>{
  const i=buttons.indexOf(b);
  return {backgroundImage:'none',backgroundColor:i===selected?'#6547A5':'#FCFBFE'};
 }
};
vm.runInNewContext(code,{window,document,Math,Map,Object,Array,Number});
function frame(t){const v=queue.shift();assert(v);if(!cancelled.has(v.id))v.fn(t)}
const before=buttons.map(b=>({...b.rect,text:b.innerHTML}));
click({target:buttons[1],defaultPrevented:false});
selected=1;frame(0);
assert.equal(window.FirstHyundaiSelectionFlow._test.stats.news,1,
 'Lower news switch MUST animate');
assert.equal(group.children.length,2);
assert.equal(buttons[0].style.getPropertyPriority('background'),'important');
assert.equal(buttons[1].style.getPropertyPriority('background'),'important');
assert(buttons[0].style.getPropertyValue('background').includes('#6547A5'));
assert(buttons[1].style.getPropertyValue('background').includes('#6547A5'));
frame(0);frame(330);
assert(buttons[0].style.getPropertyValue('background').includes('linear-gradient'));
assert(buttons[1].style.getPropertyValue('background').includes('linear-gradient'));
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),before);
frame(630);
assert.equal(window.FirstHyundaiSelectionFlow._test.stats.finished,1);
assert.equal(buttons[0].style.getPropertyValue('background'),'');
assert.equal(buttons[1].style.getPropertyValue('background'),'');
assert.deepEqual(buttons.map(b=>({...b.rect,text:b.innerHTML})),before);
console.log('News/subscription switch paints selected color on ACTUAL buttons, preserves size and metadata spacing.');
