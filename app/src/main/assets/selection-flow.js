/* FIRST HYUNDAI · minimal color flow v14 · shared real-button paint
 * No overlays, masks, moving shapes, transforms, resized buttons or clones.
 * The ACTUAL button backgrounds are painted in place, behind original text.
 * Skipped peers on the SAME visual row receive a faint, sequential wash.
 * Main Trades ↔ News routes via Apartment Info; Today ↔ Shared Memo routes via Contract.
 */
(function(){
 'use strict';
 if(!document?.addEventListener||!window?.getComputedStyle)return;
 const DURATION=630;
 const MAIN={key:'top-five',selector:'#nav'};
 const PEER_GROUPS=[
  {key:'property',selector:'.page:not(.hidden) .propertyTypeSwitch'},
  {key:'apartments',selector:'.page:not(.hidden) .tradeStarter.apartmentTradeNav'},
  {key:'office',selector:'.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'},
  {key:'trade-types',selector:'.page:not(.hidden) .tradeTypeBar'},
  {key:'new-types',selector:'.page:not(.hidden) .newTypeChips'},
  {key:'news',selector:'.page:not(.hidden) .newsCategoryTabs'}
 ];
 const stats={started:0,finished:0,skipped:0,topFive:0,news:0,lastPath:[]};
 let running=null,sequence=0;
 const lowerClicks=new WeakMap();
 const reduceMotion=()=>window.FirstHyundaiUIOptions?.get?.().motion==='reduced'||!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const chosen=b=>!!b&&(b.classList.contains('active')||
  b.classList.contains('selected')||b.getAttribute('aria-current')==='page'||
  b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true');
 const buttons=(group,key)=>!group?[]:key==='top-five'?
  Array.from(group.querySelectorAll('.primaryNav > button, .utilityNav > button'))
   .filter(el=>el.tagName==='BUTTON'&&
    (el.parentElement?.classList?.contains('primaryNav')||
     el.parentElement?.classList?.contains('utilityNav'))):
  Array.from(group.children).filter(el=>el.tagName==='BUTTON');
 // These stable rows use the SAME real-background painter as the main menu.
 // Retain the clicked row itself, including the open favorites detail sheet.
 function isLowerRow(row){
  return !!row&&(row.classList?.contains('newsCategoryTabs')||
   row.classList?.contains('officeBoardViewToggle')||
   (row.classList?.contains('tradeTypeBar')&&
    ['tradeTypeBar','officeTypeBar','nearbyTypeBar'].includes(row.id)));
 }
 function findGroup(button){
  const row=button.parentElement;
  if(isLowerRow(row))return {group:row,spec:{
   key:row.classList.contains('newsCategoryTabs')?'news':
    row.classList.contains('officeBoardViewToggle')?'memo':'trade-types',stable:true
  }};
  const nav=button.closest('#nav');
  if(nav&&(row?.classList?.contains('primaryNav')||
   row?.classList?.contains('utilityNav')))return {group:nav,spec:MAIN};
  for(const spec of PEER_GROUPS){
   const group=button.closest(spec.selector);
   if(group&&button.parentElement===group)return {group,spec};
  }
  return null;
 }
 function getPaint(button){
  const style=window.getComputedStyle(button);
  const image=style.backgroundImage&&style.backgroundImage!=='none'?
   style.backgroundImage:'';
  const raw=style.backgroundColor||'';
  // A background image may overlay a white backgroundColor. Sample the first
  // actual gradient stop instead of treating its base white as selected paint.
  const match=(image.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/)||[])[0];
  const color=match||(!/^(?:transparent|rgba\(0,\s*0,\s*0,\s*0\))$/.test(raw)?
   raw:'#FFFFFF');
  return {color,background:image||raw};
 }
 function center(r){return {x:r.left+r.width/2,y:r.top+r.height/2}}
 function vector(a,b){
  const A=center(a),B=center(b);
  const dx=B.x-A.x,dy=B.y-A.y,len=Math.max(1,Math.hypot(dx,dy));
  return {dx,dy,len,ux:dx/len,uy:dy/len,
   angle:(Math.atan2(dy,dx)*180/Math.PI+90+360)%360};
 }
 const visible=r=>r&&r.width>0&&r.height>0&&r.bottom>0&&
  r.top<window.innerHeight&&r.right>0&&r.left<window.innerWidth;
 const clamp=n=>Math.max(0,Math.min(1,n));
 const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
 const pct=n=>n.toFixed(2)+'%';
 // Linear gradients are painted by the real buttons, BELOW their text/icons.
 // The selected fill moves away from the trailing edge in its true direction.
 function fromPaint(angle,idle,selected,position){
  return 'linear-gradient('+angle+'deg, '+
   idle+' '+pct(position-12)+', '+selected+' '+pct(position+12)+')';
 }
 function toPaint(angle,idle,selected,position){
  return 'linear-gradient('+angle+'deg, '+
   selected+' '+pct(position-12)+', '+idle+' '+pct(position+12)+')';
 }
 // Two three-button lanes: Trades → Apartment Info → News and
 // Today Summary → Contract Message → Shared Memo (and reverse).
 // The center button is merely washed by color, never actually selected.
 function viaIndex(key,previous,next){
  if(key!=='top-five')return -1;
  if((previous===0&&next===2)||(previous===2&&next===0))return 1;
  if((previous===3&&next===5)||(previous===5&&next===3))return 4;
  return -1;
 }
 // Never paint a different visual row, even when DOM indices are adjacent.
 function viaIndices(key,previous,next,peers){
  if(key==='top-five'){
   const index=viaIndex(key,previous,next);
   if(index<0)return [];
   // The quick actions support administrator-defined visual ordering.
   // Follow the contract button only while it is truly BETWEEN the
   // endpoints on the same visible row, never across a wrapped row.
   if(index===4){
    const source=peers[previous],target=peers[next],middle=peers[index];
    if(!source||!target||!middle||middle.disabled||chosen(middle))return [];
    const A=source.getBoundingClientRect(),B=target.getBoundingClientRect(),
     C=middle.getBoundingClientRect();
    const p=center(A),q=center(B),m=center(C);
    const tolerance=Math.max(2,Math.min(A.height,B.height,C.height)*.16);
    if(!visible(A)||!visible(B)||!visible(C)||
      Math.abs(p.y-q.y)>tolerance||Math.abs(m.y-p.y)>tolerance||
      !(m.x>Math.min(p.x,q.x)&&m.x<Math.max(p.x,q.x)))return [];
   }
   return [index];
  }
  if(!peers[previous]||!peers[next]||Math.abs(next-previous)<2)return [];
  const a=peers[previous].getBoundingClientRect();
  const b=peers[next].getBoundingClientRect();
  const A=center(a),B=center(b),tolerance=Math.max(2,Math.min(a.height,b.height)*.16);
  if(Math.abs(A.y-B.y)>tolerance)return [];
  const path=[],step=next>previous?1:-1;
  for(let i=previous+step;i!==next;i+=step){
   const peer=peers[i],r=peer.getBoundingClientRect(),C=center(r);
   if(!peer.disabled&&visible(r)&&!chosen(peer)&&
    Math.abs(C.y-A.y)<=tolerance&&
    C.x>Math.min(A.x,B.x)&&C.x<Math.max(A.x,B.x))path.push(i);
  }
  return path;
 }
 function rgb(color){
  if(/^#[0-9a-f]{6}$/i.test(color))
   return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  if(/^#[0-9a-f]{3}$/i.test(color))
   return [1,2,3].map(i=>parseInt(color[i]+color[i],16));
  const m=color.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  return m?[+m[1],+m[2],+m[3]]:null;
 }
 function softlyMix(idle,source,amount){
  const a=rgb(idle),b=rgb(source);
  if(!a||!b)return idle;
  const w=clamp(amount);
  return 'rgb('+a.map((v,i)=>Math.round(v*(1-w)+b[i]*w)).join(', ')+')';
 }
 function middlePaint(angle,idle,highlight,center){
  return 'linear-gradient('+angle+'deg, '+
   idle+' '+pct(center-41)+', '+
   highlight+' '+pct(center-14)+', '+
   highlight+' '+pct(center+14)+', '+
   idle+' '+pct(center+41)+')';
 }
 function restoreOne(saved,button){
  if(!saved.has(button))return;
  const old=saved.get(button);
  if(old.value)button.style.setProperty('background',old.value,old.priority);
  else button.style.removeProperty('background');
 }
 function useBackground(button,background,record){
  if(!record.has(button)){
   record.set(button,{
    value:button.style.getPropertyValue('background'),
    priority:button.style.getPropertyPriority('background')
   });
  }
  button.style.setProperty('background',background,'important');
 }
 function restore(record){
  for(const [button,old] of record){
   if(old.value)button.style.setProperty('background',old.value,old.priority);
   else button.style.removeProperty('background');
  }
 }
 function stop(){
  if(!running)return;
  const prior=running;running=null;prior.cleanup();
 }
 function animate(group,key,previous,next,originalSelected,originalIdle){
  const peers=buttons(group,key);
  const source=peers[previous],target=peers[next];
  if(!source||!target||source===target||reduceMotion()||
   !window.requestAnimationFrame){stats.skipped++;return;}
  // The precisely clicked row is authoritative for news/trade filters.
  if(key!=='news'&&key!=='trade-types'&&!chosen(target)){
   stats.skipped++;return;
  }
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(!visible(a)||!visible(b)){stats.skipped++;return;}
  const v=vector(a,b),afterSource=getPaint(source),afterTarget=getPaint(target);
  const middleIndices=viaIndices(key,previous,next,peers);
  const middles=middleIndices.map(index=>({button:peers[index],idle:getPaint(peers[index]).color}));
  const hasMiddle=middles.length>0;
  const totalDuration=hasMiddle?790+110*(middles.length-1):DURATION;
  const saved=new Map();
  let raf=null,initial=null,finished=false;
  const cleanup=()=>{
   if(finished)return;
   finished=true;
   if(raf!=null)window.cancelAnimationFrame?.(raf);
   restore(saved);
  };
  running={cleanup};
  stats.started++;
  if(key==='top-five')stats.topFive++;
  if(key==='news')stats.news++;
  stats.lastPath=[previous,...middleIndices,next];
  const angle=v.angle;
  const oldColor=originalSelected.color;
  const newColor=afterTarget.color;
  function paintFrame(time){
   if(finished)return;
   if(initial==null)initial=time;
   const t=clamp((time-initial)/totalDuration);
   // One skipped peer preserves the original main-menu timing. Longer
   // jumps send the same restrained wash through each peer in travel order.
   const arrival=hasMiddle ? .32+.12*(middles.length-1) : .065;
   const oldFront=-14+128*ease(hasMiddle?clamp(t/.67):t);
   const newFront=-14+128*ease(clamp((t-arrival)/(1-arrival)));
   useBackground(source,fromPaint(angle,afterSource.color,oldColor,oldFront),saved);
   useBackground(target,toPaint(angle,originalIdle.color,newColor,newFront),saved);
   const windowLength=.68/(1+.55*Math.max(0,middles.length-1));
   middles.forEach(({button,idle},i)=>{
    const phase=(t-.16-i*.55*windowLength)/windowLength;
    if(phase>0&&phase<1){
     const opacity=.21*Math.sin(Math.PI*phase);
     const tint=softlyMix(idle,oldColor,opacity);
     const front=-41+182*ease(phase);
     useBackground(button,middlePaint(angle,idle,tint,front),saved);
    }else restoreOne(saved,button);
   });
   if(t<1)raf=window.requestAnimationFrame(paintFrame);
   else{
    if(running?.cleanup===cleanup)running=null;
    cleanup();
    stats.finished++;
   }
  }
  // Immediate first paint. No RAF delays between new selected DOM and effect.
  useBackground(source,fromPaint(angle,afterSource.color,oldColor,-14),saved);
  useBackground(target,toPaint(angle,originalIdle.color,newColor,-14),saved);
  raf=window.requestAnimationFrame(paintFrame);
 }
 function onClick(event){
  if(reduceMotion()||event.defaultPrevented)return;
  const button=event.target?.closest?.('button');
  if(!button||button.disabled||button.closest('.hidden'))return;
  const result=findGroup(button);
  if(!result)return;
  stop();
  const {group,spec}=result,peers=buttons(group,spec.key);
  const next=peers.indexOf(button),previous=peers.findIndex(chosen);
  if(next<0||previous<0||previous===next)return;
  const selected=getPaint(peers[previous]),idle=getPaint(button),id=++sequence;
  // Real pointer events may run a microtask checkpoint BETWEEN capture and
  // the inline onclick. Finish stable rows in BUBBLING, after their handler,
  // before browser paint. The main menu keeps its original RAF timing.
  const start=()=>{
   if(id!==sequence||reduceMotion())return;
   const nextGroup=spec.stable
    ?(group.isConnected===false?document.getElementById?.(group.id):group)
    :document.querySelector(spec.selector);
   if(nextGroup)animate(nextGroup,spec.key,previous,next,selected,idle);
  };
  if(spec.stable)lowerClicks.set(event,start);
  else window.requestAnimationFrame?.(start);
 }
 document.addEventListener('click',onClick,{capture:true});
 document.addEventListener('click',event=>{
  const start=lowerClicks.get(event);
  lowerClicks.delete(event);
  if(!event.defaultPrevented)start?.();
 });
 window.FirstHyundaiSelectionFlow={version:'14.0.0',
  _test:{buttons,chosen,findGroup,getPaint,fromPaint,toPaint,
   vector,viaIndex,viaIndices,softlyMix,middlePaint,isLowerRow,stop,onClick,stats}};
})();
