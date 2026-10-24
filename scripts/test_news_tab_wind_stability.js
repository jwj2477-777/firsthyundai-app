'use strict';
/* News/subscription switch remains at the same position and produces wind.
 * Regression for a previously unanimated lower toggle with jumping header.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const src=fs.readFileSync(path.join(root,'app/src/main/assets/selection-flow.js'),'utf8');
assert(css.includes('v2.0.74 · News tabs must NEVER move') &&
 css.includes('#news.page>.sectionTitle.newsUnifiedHeading>div{'),
 'Article and subscriptions headings must reserve the same space');
assert(css.includes('min-height:88px')&&css.includes('min-height:134px'),
 'Both family and admin metadata rows reserve height');
assert(html.includes("switchNewsPane('subscriptions')")&&html.includes("switchNewsPane('articles')"));
new vm.Script(src);
let onClick,frame,selected=0;
const animations=[];
function cssStyle(){
 const m=new Map();
 return {
  setProperty:(k,v,p)=>m.set(k,{value:v,priority:p||''}),
  getPropertyValue:k=>m.get(k)?.value||'',
  getPropertyPriority:k=>m.get(k)?.priority||'',
  removeProperty:k=>m.delete(k)
 };
}
function node(tag){
 const n={
  tagName:tag.toUpperCase(),style:cssStyle(),children:[],parentElement:null,
  classList:{contains(){return false}},
  getAttribute(){return null},
  closest(s){if(s==='button')return n.tagName==='BUTTON'?n:null;
   if(s==='.hidden'||s==='#nav')return null;
   if(s==='.page:not(.hidden) .newsCategoryTabs')return group;
   return null;},
  setAttribute(){},
  getBoundingClientRect(){return n.rect||{}},
  appendChild(el){el.parentElement=n;n.children.push(el)},
  remove(){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n)},
  animate(frames,options){
   const a={node:n,frames,options,listeners:{},cancel(){},addEventListener(k,fn){a.listeners[k]=fn}};
   animations.push(a);return a;
  }
 };
 return n;
}
const group=node('div');
group.rect={left:10,top:200,width:365,height:85,right:375,bottom:285};
group.scrollLeft=0;group.scrollTop=0;
group.matches=s=>s==='.page:not(.hidden) .newsCategoryTabs';
function tab(i){
 const t=node('button');t.parentElement=group;
 t.rect={left:20+i*176,top:212,width:165,height:61,right:185+i*176,bottom:273};
 t.innerHTML=i===0?'뉴스 브리핑':'인천 청약·분양';
 t.getAttribute=k=>k==='aria-selected'?(selected===i?'true':'false'):null;
 return t;
}
const a=tab(0),b=tab(1);
group.children=[a,b];
const document={
 addEventListener(k,fn,opt){if(k==='click'){onClick=fn;assert.equal(opt.capture,true)}},
 createElement:()=>node('span'),
 head:{appendChild(){}},
 querySelector:s=>s==='.page:not(.hidden) .newsCategoryTabs'?group:null
};
const window={
 innerWidth:393,innerHeight:840,
 requestAnimationFrame:f=>frame=f,
 matchMedia:()=>({matches:false}),
 getComputedStyle:el=>{
  const i=[a,b].indexOf(el);
  return {backgroundColor:i===selected?'#6547A5':'#FCFBFE',
   backgroundImage:'none',color:i===selected?'#FFFFFF':'#5C5275',borderRadius:'13px'};
 }
};
vm.runInNewContext(src,{document,window,Math,Object,Array,Number});
const original=[a.innerHTML,b.innerHTML];
onClick({target:b,defaultPrevented:false});
selected=1;frame();
const v=window.FirstHyundaiSelectionFlow;
assert.equal(v._test.stats.started,1,'Both news sub-tabs must animate');
assert.equal(group.children.length,17,'Two buttons, two idle bases, two filled cards, eleven wind grains');
assert.equal(group.children[4].style.background,'#6547A5','Original purple moves out');
assert.equal(group.children[5].children[0].style.background,'#6547A5','Purple fills incoming card');
assert.equal(group.children[4].style.overflow,'hidden','Wind is clipped within button');
assert.deepEqual([a.innerHTML,b.innerHTML],original,'No text resize or cloning');
const main=animations.find(anim=>anim.node===group.children[4].children[0]);
assert(main,'The source-color sweep really starts');
main.listeners.finish();
assert.equal(group.children.length,2,'Temporary colored planes are restored cleanly');
console.log('News tab flow + stable subheading height regression passed.');
