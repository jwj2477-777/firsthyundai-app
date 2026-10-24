'use strict';
/* Direct actual trade-filter event regression: checks both apartment/office
 * groups, selected status, no unrelated tabs, and native onclick untouched. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const flow=fs.readFileSync(path.join(root,'app/src/main/assets/selection-flow.js'),'utf8');
for(const id of ['tradeTypeBar','officeTypeBar','nearbyTypeBar'])
 assert(html.includes('id="'+id+'"') && html.includes('onclick="set'),
  id+' keeps its original click handler and row identity');
assert(!html.includes('beginDirect?.(') && !html.includes('endDirect?.('),
 'Removed duplicate direct hook workaround');
assert(flow.includes("row?.classList?.contains('tradeTypeBar')"),
 'Delegated click finds the exact trade type row');
new vm.Script(flow);
const groups={},pending=[],cancelled=new Set();let serial=0,click;
const nodeStyle=()=>{const m=new Map();return {
 setProperty:(k,v,p='')=>m.set(k,{v:String(v),p}),
 getPropertyValue:k=>m.get(k)?.v||'',
 getPropertyPriority:k=>m.get(k)?.p||'',
 removeProperty:k=>m.delete(k)
}};
function create(tag){
 const el={tagName:tag.toUpperCase(),style:nodeStyle(),parentElement:null,disabled:false,
  getBoundingClientRect(){return el.rect},
  classList:{contains:()=>false},getAttribute(){return null},
  closest(s){if(s==='button')return el.tagName==='BUTTON'?el:null;
   if(s==='.hidden'||s==='#nav')return null;
   return null;}
 };
 return el;
}
const ids=['tradeTypeBar','officeTypeBar','nearbyTypeBar'];
ids.forEach((id,gi)=>{
 const group=create('div');group.id=id;group.classList={contains:k=>k==='tradeTypeBar'};
 const selected={value:0},palette=['#24566D','#255CA5','#146A50','#875007'];
 const btns=Array.from({length:4},(_,i)=>{
  const b=create('button');b.parentElement=group;b.label=['전체','매매','전세','월세'][i];
  b.rect={left:20+i*92,top:160+gi*110,width:85,height:58,
   right:105+i*92,bottom:218+gi*110};
  b.classList={contains:k=>k==='active'&&selected.value===i};
  b.getAttribute=k=>k==='aria-pressed'?(selected.value===i?'true':'false'):null;
  return b;
 });
 group.children=btns;
 groups[id]={group,btns,selected,palette};
});
const doc={
 addEventListener(type,handler,options){
  if(type==='click'){assert.equal(options.capture,true);click=handler;}
 },
 getElementById:id=>groups[id]?.group,
 querySelector(){return null}
};
const win={
 innerWidth:410,innerHeight:900,
 matchMedia:()=>({matches:false}),
 requestAnimationFrame(fn){const n=++serial;pending.push({id:n,fn});return n},
 cancelAnimationFrame:n=>cancelled.add(n),
 getComputedStyle:el=>{
  const g=ids.map(x=>groups[x]).find(g=>g.btns.includes(el));
  const i=g.btns.indexOf(el);
  return {backgroundImage:'none',
   backgroundColor:i===g.selected.value?g.palette[i]:'#FFFFFF',
   color:i===g.selected.value?'white':'#345'};
 }
};
vm.runInNewContext(flow,{window:win,document:doc,Math,Map,Object,Array,Number});
const api=win.FirstHyundaiSelectionFlow;
assert.equal(api.version,'9.0.0');
function step(time){const item=pending.shift();assert(item,'RAF missing');if(!cancelled.has(item.id))item.fn(time)}
for(const id of ids){
 const g=groups[id],other=ids.filter(x=>x!==id).map(x=>groups[x]);
 const origOther=other.map(x=>x.btns.map(b=>b.style.getPropertyValue('background')));
 const oldActive=g.selected.value,target=3;
 click({target:g.btns[target],defaultPrevented:false}); // document capture
 g.selected.value=target; // original inline handler updates active + aria-pressed
 step(0); // next frame enters the exact clicked row
 assert.equal(g.btns[oldActive].style.getPropertyPriority('background'),'important');
 assert.equal(g.btns[target].style.getPropertyPriority('background'),'important');
 for(let i=0;i<4;i++)if(i!==oldActive&&i!==target)
  assert.equal(g.btns[i].style.getPropertyValue('background'),'','Unrelated filter must be static');
 step(0);step(315);
 assert(g.btns[target].style.getPropertyValue('background').includes('linear-gradient'));
 step(630);
 assert(g.btns.every(b=>b.style.getPropertyValue('background')===''));
 assert.deepEqual(other.map(x=>x.btns.map(b=>b.style.getPropertyValue('background'))),origOther,
  'Switching one type bar must not alter any others');
}
console.log('Real capture-click trade filters passed: apartment, officetel, nearby; exactly two colored backgrounds, unchanged other rows.');
