'use strict';
/* v7 regression: ONLY source and target background change, 5 routes remain */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('app/src/main/assets/selection-flow.js');
const css=read('app/src/main/assets/ui-v2.css');
const html=read('app/src/main/assets/index.html');
new vm.Script(code);
assert(html.includes('<script src="selection-flow.js"></script>'));
assert(css.includes('v2.0.72 · ONE source of truth for equal-rank page headings.'));
assert(css.includes('v2.0.75 · No layout movement during background transfer'));
assert(!/createElement\(|cloneNode|fhd-wind-|fhd-color-only-overlay|webkitMaskImage|maskImage|translate3d|rotate\(|\.animate\(/.test(code),
 'Only the REAL button background may be repainted; no hidden layer or transform');
assert(code.includes("key:'top-five',selector:'#nav'"));
let selected=0,reduced=false,click;
const callbacks=[],cancelled=new Set();
let nextId=0;
const requestAnimationFrame=fn=>{
 const id=++nextId;callbacks.push({fn,id});return id;
};
function frame(now){
 const item=callbacks.shift();
 assert(item,'Expected RAF callback');
 if(!cancelled.has(item.id))item.fn(now);
}
function style(){
 const values=new Map();
 return {
  setProperty(k,value,priority=''){values.set(k,{value:String(value),priority})},
  getPropertyValue:k=>values.get(k)?.value||'',
  getPropertyPriority:k=>values.get(k)?.priority||'',
  removeProperty:k=>values.delete(k)
 };
}
function node(tag,klass=[]){
 const item={tagName:tag.toUpperCase(),style:style(),
  children:[],parentElement:null,innerHTML:'',disabled:false,
  classList:{contains:name=>klass.includes(name)},
  getAttribute(){return null},closest(s){
   if(s==='button')return item.tagName==='BUTTON'?item:null;
   if(s==='.hidden')return null;
   if(s==='#nav')return nav;
   return null;
  },getBoundingClientRect(){return item.rect}};
 return item;
}
const nav=node('nav'),top=node('div',['primaryNav']),
 bottom=node('div',['utilityNav']);
top.parentElement=nav;bottom.parentElement=nav;nav.children=[top,bottom];
const colors=['#2456AA','#136D63','#6547A5','#4B5895','#9C5737'];
const labels=['실거래','아파트정보','뉴스','오늘 요약','계약문자 만들기'];
const buttons=labels.map((label,i)=>{
 const button=node('button');
 button.parentElement=i<3?top:bottom;button.innerHTML=label;
 const x=i<3?24+i*123:35+(i-3)*190,y=i<3?40:240,w=i<3?110:172,h=i<3?130:74;
 button.rect={left:x,top:y,width:w,height:h,right:x+w,bottom:y+h};
 button.classList={contains:k=>k==='active'&&selected===i};
 button.getAttribute=k=>k==='aria-current'?(selected===i?'page':'false'):null;
 return button;
});
top.children=buttons.slice(0,3);bottom.children=buttons.slice(3);
nav.querySelectorAll=q=>q==='.primaryNav > button, .utilityNav > button'?buttons:[];
const doc={
 addEventListener(type,fn,opts){if(type==='click'){click=fn;assert.equal(opts.capture,true)}},
 querySelector:s=>s==='#nav'?nav:null
};
const win={innerWidth:415,innerHeight:980,requestAnimationFrame,
 cancelAnimationFrame:id=>cancelled.add(id),
 matchMedia:()=>({matches:reduced}),
 getComputedStyle:b=>{
  const i=buttons.indexOf(b);
  return {backgroundColor:i===selected?colors[i]:'#FFFFFF',
   backgroundImage:'none',color:i===selected?'white':'#233943'}
 }
};
vm.runInNewContext(code,{window:win,document:doc,Math,Number,Object,Array,Map});
const api=win.FirstHyundaiSelectionFlow;
assert.equal(api.version,'9.0.0');
assert.equal(api._test.buttons(nav,'top-five').length,5);
assert(!('beginDirect' in api)&&!('endDirect' in api),'Removed non-working direct-hook branch');
assert(!/intermediates\(|passPaint\(|mids\b/.test(code),'No intermediate tab may be animated');
const before=buttons.map(b=>({text:b.innerHTML,rect:{...b.rect}}));
click({target:buttons[2],defaultPrevented:false});selected=2;
frame(0); // next frame, after inline onclick: install initial two gradients
assert.equal(buttons[0].style.getPropertyPriority('background'),'important');
assert.equal(buttons[2].style.getPropertyPriority('background'),'important');
assert(buttons[0].style.getPropertyValue('background').includes(colors[0]));
assert(buttons[2].style.getPropertyValue('background').includes(colors[2]));
assert.equal(nav.children.length,2,'No DOM/row insertions');
frame(0);frame(320);
assert(api._test.stats.lastPath.join(',')==='0,2',
 'Only the previous and destination menus may participate');
for(let i=0;i<buttons.length;i++){
 if(i!==0&&i!==2)
  assert.equal(buttons[i].style.getPropertyValue('background'),'',
   'Unrelated main menu '+i+' must never change');
}
assert.deepEqual(buttons.map(b=>({text:b.innerHTML,rect:{...b.rect}})),before,
 'No text, size, geometry, icon or position changed');
frame(630);
assert.equal(buttons[0].style.getPropertyValue('background'),'');
assert.equal(buttons[1].style.getPropertyValue('background'),'');
assert.equal(buttons[2].style.getPropertyValue('background'),'');
assert.equal(api._test.stats.finished,1);
const nr=callbacks.length;
click({target:buttons[4],defaultPrevented:false});selected=4;
frame(900);frame(900);frame(1215);frame(1530);
assert.equal(api._test.stats.topFive,2,'Cross-row menu selection animates');
assert.equal(buttons[4].style.getPropertyValue('background'),'');
const vector=api._test.vector(buttons[4].rect,buttons[0].rect);
assert(vector.dy<0&&vector.dx<0,'Reverse cross-row direction points up-left');
reduced=true;
click({target:buttons[3],defaultPrevented:false});
assert.equal(callbacks.length,0);
assert.equal(nav.children.length,2);
assert.equal(nr,0,'No dangling timers from previous selection');
console.log('V7 minimal two-button color transfer passed: all 5 destinations, no unrelated tiles, no layout changes.');
