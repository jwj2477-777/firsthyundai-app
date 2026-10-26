'use strict';
/* v14 regression: trades↔news via Apartment Info, today↔memo via Contracts */
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
let selected=0,reduced=false,click,bubble;
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
const colors=['#2456AA','#136D63','#6547A5','#4B5895','#9C5737','#946A37'];
const labels=['실거래','아파트정보','뉴스','오늘 요약','계약문자 만들기','공유 메모'];
const buttons=labels.map((label,i)=>{
 const button=node('button');
 button.parentElement=i<3?top:bottom;button.innerHTML=label;
 const x=i<3?24+i*123:35+(i-3)*125,y=i<3?40:240,w=i<3?110:115,h=i<3?130:74;
 button.rect={left:x,top:y,width:w,height:h,right:x+w,bottom:y+h};
 button.classList={contains:k=>k==='active'&&selected===i};
 button.getAttribute=k=>k==='aria-current'?(selected===i?'page':'false'):null;
 return button;
});
top.children=buttons.slice(0,3);bottom.children=buttons.slice(3);
nav.querySelectorAll=q=>q==='.primaryNav > button, .utilityNav > button'?buttons:[];
const doc={
 addEventListener(type,fn,opts){if(type==='click'&&opts?.capture){click=fn;assert.equal(opts.capture,true)}else if(type==='click')bubble=fn;},
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
assert.equal(api.version,'14.1.0');
assert.equal(api._test.buttons(nav,'top-five').length,6);
assert(!('beginDirect' in api)&&!('endDirect' in api),'Removed non-working direct-hook branch');
assert.equal(api._test.viaIndex('top-five',0,2),1);
assert.equal(typeof api._test.isLowerRow,'function');
assert.equal(api._test.viaIndex('top-five',2,0),1);
assert.equal(api._test.viaIndex('top-five',3,5),4,'Summary → Memo passes via Contracts');
assert.equal(api._test.viaIndex('top-five',5,3),4,'Memo → Summary passes via Contracts');
assert.equal(api._test.viaIndices('top-five',3,5,buttons).join(','),'4');
assert.equal(api._test.viaIndices('top-five',5,3,buttons).join(','),'4');
assert.equal(api._test.viaIndices('top-five',0,5,buttons).join(','),'1,4',
 'Trades → Shared Memo travels across both center-column buttons');
assert.equal(api._test.viaIndices('top-five',5,0,buttons).join(','),'4,1',
 'Shared Memo → Trades follows the exact reverse journey');
assert.equal(api._test.viaIndices('top-five',3,2,buttons).join(','),'4,1',
 'Today Summary → News travels Contract → Apartment Info');
assert.equal(api._test.viaIndices('top-five',2,3,buttons).join(','),'1,4',
 'News → Today Summary travels Apartment Info → Contract');
for(const pair of [[0,1],[1,2],[0,3],[2,4],[3,4],[3,2],[4,5]])
 assert.equal(api._test.viaIndex('top-five',...pair),-1,
  'Other navigation paths stay untouched');
assert.equal(api._test.viaIndex('news',0,2),-1);
assert.equal(api._test.viaIndex('trade-types',0,2),-1);
assert.equal(api._test.softlyMix('#FFFFFF','#2456AA',0),'rgb(255, 255, 255)');
assert.equal(api._test.softlyMix('#FFFFFF','#2456AA',.2),'rgb(211, 221, 238)');
const before=buttons.map(b=>({text:b.innerHTML,rect:{...b.rect}}));
function complete(end){frame(end)}
// TRADES → NEWS. The middle "Apartment Info" stays unselected,
// shows a faint soft-color wash, and returns to its original idle paint.
click({target:buttons[2],defaultPrevented:false});
selected=2;
frame(0); // post-click queue sets up actual selected/idle button colors
assert.equal(buttons[0].style.getPropertyPriority('background'),'important');
assert.equal(buttons[2].style.getPropertyPriority('background'),'important');
assert.equal(nav.children.length,2,'No DOM, icon or row changes');
frame(0);frame(395);
assert.equal(api._test.stats.lastPath.join(','),'0,1,2');
assert(buttons[1].style.getPropertyValue('background').includes('linear-gradient'),
 'Exactly one midpoint is visibly washed with color');
assert(buttons[1].style.getPropertyValue('background').includes('rgb('),
 'Passing shade is light blended pigment rather than fully selected blue');
assert.equal(buttons[1].getAttribute('aria-current'),'false',
 'Midpoint must never become selected');
for(const i of [3,4])assert.equal(buttons[i].style.getPropertyValue('background'),'');
assert.deepEqual(buttons.map(b=>({text:b.innerHTML,rect:{...b.rect}})),before);
complete(790);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
assert.equal(api._test.stats.finished,1);
// NEWS → TRADES in reverse. The middle hint follows the purple source.
click({target:buttons[0],defaultPrevented:false});
selected=0;
frame(1000);frame(1000);frame(1395);
assert.equal(api._test.stats.lastPath.join(','),'2,1,0');
assert(buttons[1].style.getPropertyValue('background').includes('linear-gradient'));
assert(buttons[1].style.getPropertyValue('background').includes('rgb('));
assert.equal(buttons[1].getAttribute('aria-current'),'false');
complete(1790);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
// Other jump: TRADES → CONTRACT never changes Apartment Info or News.
click({target:buttons[4],defaultPrevented:false});
selected=4;
frame(2000);frame(2000);frame(2315);
assert.equal(api._test.stats.lastPath.join(','),'0,4');
for(const i of [1,2,3,5])assert.equal(buttons[i].style.getPropertyValue('background'),'',
 'Unrelated main button '+i+' is untouched');
complete(2630);
assert.equal(api._test.stats.topFive,3);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));

// TODAY → SHARED MEMO. Contract Message is the faint transitional wash.
// The original DOM contents and button geometry never move.
selected=3;
click({target:buttons[5],defaultPrevented:false});
selected=5;
frame(3000);frame(3000);frame(3395);
assert.equal(api._test.stats.lastPath.join(','),'3,4,5');
assert(buttons[4].style.getPropertyValue('background').includes('linear-gradient'));
assert.equal(buttons[4].getAttribute('aria-current'),'false');
for(const i of [0,1,2])assert.equal(buttons[i].style.getPropertyValue('background'),'',
 'Unrelated main button '+i+' must not repaint');
assert.deepEqual(buttons.map(b=>({text:b.innerHTML,rect:{...b.rect}})),before);
complete(3790);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));

// SHARED MEMO → TODAY follows the same route in the opposite direction.
click({target:buttons[3],defaultPrevented:false});
selected=3;
frame(4000);frame(4000);frame(4395);
assert.equal(api._test.stats.lastPath.join(','),'5,4,3');
assert(buttons[4].style.getPropertyValue('background').includes('linear-gradient'));
assert.equal(buttons[4].getAttribute('aria-current'),'false');
complete(4790);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
assert.equal(api._test.stats.topFive,5);
// Diagonal route must wash only Apartment Info then Contract Message, never
// select either; endpoints are the user's actual first and last pressed tiles.
selected=0;
click({target:buttons[5],defaultPrevented:false});
selected=5;
frame(5000);frame(5000);frame(5380);
assert.equal(api._test.stats.lastPath.join(','),'0,1,4,5');
assert.equal(buttons[1].getAttribute('aria-current'),'false');
assert.equal(buttons[4].getAttribute('aria-current'),'false');
assert.equal(nav.children.length,2);
complete(5900);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
click({target:buttons[0],defaultPrevented:false});
selected=0;
frame(6000);frame(6000);frame(6380);
assert.equal(api._test.stats.lastPath.join(','),'5,4,1,0');
complete(6900);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
// Other opposite corner: TODAY → NEWS travels both center-column tiles.
selected=3;
click({target:buttons[2],defaultPrevented:false});
selected=2;
frame(7000);frame(7000);frame(7380);
assert.equal(api._test.stats.lastPath.join(','),'3,4,1,2');
for(const i of [4,1])assert.equal(buttons[i].getAttribute('aria-current'),'false');
complete(7900);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));
// NEWS → TODAY is exactly the reverse, and never switches the middle pages.
click({target:buttons[3],defaultPrevented:false});
selected=3;
frame(8000);frame(8000);frame(8380);
assert.equal(api._test.stats.lastPath.join(','),'2,1,4,3');
for(const i of [1,4])assert.equal(buttons[i].getAttribute('aria-current'),'false');
complete(8900);
assert(buttons.every(b=>b.style.getPropertyValue('background')===''));



// If the administrator reorders the quick actions, the middle button
// no longer sits between Summary and Memo: no false sideways detour.
const contractBounds=buttons[4].rect;
buttons[4].rect={...contractBounds,left:5,right:120};
assert.equal(api._test.viaIndices('top-five',3,5,buttons).length,0,
 'A visually reordered contract shortcut is not on the physical route');
buttons[4].rect={...contractBounds,top:350,bottom:424};
assert.equal(api._test.viaIndices('top-five',5,3,buttons).length,0,
 'A wrapped contract shortcut is not part of a horizontal route');
buttons[4].rect=contractBounds;
const vector=api._test.vector(buttons[4].rect,buttons[0].rect);
assert(vector.dy<0&&vector.dx<0,'Cross-row direction still points up-left');
reduced=true;
click({target:buttons[3],defaultPrevented:false});
assert.equal(callbacks.length,0);
assert.equal(nav.children.length,2);
console.log('V14 soft intermediate wash: Trades↔News and Today↔Shared Memo, both directions, no extra UI movement.');

// Real native event dispatch can drain microtasks after capture but before
// inline onclick. Lower rows MUST wait for bubbling (not a capture microtask).
reduced=false;
const newsRow=node('div',['newsCategoryTabs']);
newsRow.children=buttons.slice(0,2);
for(const b of newsRow.children)b.parentElement=newsRow;
selected=0;
const event={target:buttons[1],defaultPrevented:false};
click(event);
assert.equal(callbacks.length,0,'Capture must not queue a premature lower-row RAF');
assert(buttons.every(b=>!b.style.getPropertyValue('background')),
 'Capture must not paint the obsolete selection');
selected=1; // actual switchNewsPane inline handler
bubble(event);
assert.equal(buttons[1].style.getPropertyPriority('background'),'important',
 'Bubble paints immediately after real selection, before rendering');
frame(4000);frame(4315);complete(4630);
assert(buttons.every(b=>!b.style.getPropertyValue('background')));
console.log('Native-event ordering: capture snapshot → actual onclick → bubble paint; no capture microtask race.');

// Four-way same-row journeys can pass through MORE than one peer, in order.
const aligned=Array.from({length:4},(_,i)=>{
 const b=node('button');b.rect={left:10+i*90,top:500,width:80,height:50,right:90+i*90,bottom:550};return b;
});
assert.equal(api._test.viaIndices('trade-types',0,3,aligned).join(','),'1,2');
assert.equal(api._test.viaIndices('trade-types',3,0,aligned).join(','),'2,1');
assert.equal(api._test.viaIndices('apartments',0,2,aligned).join(','),'1');
assert.equal(api._test.viaIndices('new-types',2,0,aligned).join(','),'1');
assert.equal(api._test.viaIndices('trade-types',0,1,aligned).length,0);
aligned[1].rect.top=600;aligned[1].rect.bottom=650;
assert.equal(api._test.viaIndices('trade-types',0,3,aligned).join(','),'2','Wrapped rows never receive a wash');
assert.equal(api._test.viaIndices('trade-types',0,1,aligned).length,0);
console.log('Skipped-peer path: all intermediate buttons in travel order; adjacent and other visual rows excluded.');
