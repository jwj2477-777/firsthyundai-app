/* FIRST HYUNDAI · fluid selection transfer v2
 * Purely visual. Never changes navigation, selected states or source colors.
 * The click is sampled BEFORE inline handlers and animated AFTER their updates.
 */
(function () {
 'use strict';
 if (!document?.addEventListener || !window?.getComputedStyle) return;
 const TIME=820, EASE='cubic-bezier(.38,0,.18,1)';
 const GROUPS=[
  ['main','#nav .primaryNav'],
  ['shortcuts','#nav .utilityNav'],
  ['property','.page:not(.hidden) .propertyTypeSwitch'],
  ['apartment-modes','.page:not(.hidden) .tradeStarter.apartmentTradeNav'],
  ['office-modes','.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'],
  ['trade-types','.page:not(.hidden) .tradeTypeBar'],
  ['new-types','.page:not(.hidden) .newTypeChips'],
  ['news-tabs','.page:not(.hidden) .newsCategoryTabs']
 ];
 const combined=GROUPS.map(g=>g[1]).join(',');
 let running=null;
 const stats={requests:0,completed:0,skipped:0};
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const buttons=g=>g?Array.from(g.children).filter(e=>e.tagName==='BUTTON'):[];
 const chosen=b=>!!b&&(b.classList.contains('active')||
  b.classList.contains('selected')||
  b.getAttribute('aria-pressed')==='true'||
  b.getAttribute('aria-selected')==='true'||
  b.getAttribute('aria-current')==='page');
 const visible=r=>r&&r.w>0&&r.h>0&&r.y+r.h>0&&r.y<window.innerHeight&&
  r.x+r.w>0&&r.x<window.innerWidth;
 function measure(button){
  const r=button.getBoundingClientRect(),s=window.getComputedStyle(button);
  return {x:r.left,y:r.top,w:r.width,h:r.height,
   color:s.color,paint:s.backgroundImage&&s.backgroundImage!=='none'?
    s.backgroundImage:s.backgroundColor,
   border:s.border, radius:s.borderRadius, shadow:s.boxShadow,
   font:s.font, fontFamily:s.fontFamily, fontSize:s.fontSize,
   fontWeight:s.fontWeight,lineHeight:s.lineHeight,
   letterSpacing:s.letterSpacing,textAlign:s.textAlign,
   display:s.display,flexDirection:s.flexDirection,alignItems:s.alignItems,
   justifyContent:s.justifyContent,gap:s.gap,padding:s.padding};
 }
 function stop(){
  if(!running)return;
  const current=running;running=null;
  current.animations.forEach(a=>{try{a.cancel()}catch(e){}});
  current.elements.forEach(e=>e.remove());
 }
 function face(button,geom){
  const el=document.createElement('div');
  el.className='fhd-fluid-face';
  el.setAttribute('aria-hidden','true');
  // Duplicate visual content only. Ignore pointer ripples; no copied button events.
  const content=button.cloneNode(true);
  content.querySelectorAll?.('.fhd-tap-wave')?.forEach(n=>n.remove());
  el.innerHTML=content.innerHTML;
  Object.assign(el.style,{
   position:'fixed',pointerEvents:'none',boxSizing:'border-box',
   zIndex:'1002',left:geom.x+'px',top:geom.y+'px',
   width:geom.w+'px',height:geom.h+'px',
   background:geom.paint,color:geom.color,
   border:geom.border,borderRadius:geom.radius,
   boxShadow:geom.shadow,font:geom.font,letterSpacing:geom.letterSpacing,
   textAlign:geom.textAlign,
   display:geom.display==='grid'?'grid':'flex',
   flexDirection:geom.flexDirection,alignItems:geom.alignItems,
   justifyContent:geom.justifyContent,gap:geom.gap,padding:geom.padding,
   overflow:'hidden',whiteSpace:'normal',willChange:'clip-path,opacity'
  });
  return el;
 }
 function animate(fromEl,toBeforeEl,from,to){
  if(!visible(from)||!visible(to)||typeof document.createElement('div').animate!=='function'){
   stats.skipped++;return;
  }
  const dx=to.x+to.w/2-from.x-from.w/2;
  const dy=to.y+to.h/2-from.y-from.h/2;
  if(Math.abs(dx)>window.innerWidth*1.15||Math.abs(dy)>window.innerHeight*.63){
   stats.skipped++;return;
  }
  stop();
  const source=face(fromEl,from),cover=face(toBeforeEl,to);
  const distance=Math.hypot(dx,dy), horizontal=Math.abs(dx)>=Math.abs(dy);
  const forwards=horizontal?dx>=0:dy>=0;
  // Colored outgoing face uncovers the original inactive surface,
  // incoming white face uncovers the exact EXISTING selected paint.
  const begin='inset(0% 0% 0% 0% round '+from.radius+')';
  const end='inset(0% 0% 0% 0% round '+to.radius+')';
  const clipOut=horizontal?(forwards?'inset(0% 100% 0% 0%)':'inset(0% 0% 0% 100%)'):
   (forwards?'inset(100% 0% 0% 0%)':'inset(0% 0% 100% 0%)');
  const clipIn=horizontal?(forwards?'inset(0% 0% 0% 100%)':'inset(0% 100% 0% 0%)'):
   (forwards?'inset(0% 0% 100% 0%)':'inset(100% 0% 0% 0%)');
  const bridge=document.createElement('div');
  bridge.className='fhd-fluid-bridge';
  bridge.setAttribute('aria-hidden','true');
  Object.assign(bridge.style,{
   position:'fixed',zIndex:'1001',pointerEvents:'none',
   left:(from.x+from.w/2)+'px',top:(from.y+from.h/2)+'px',
   width:distance+'px',height:Math.min(30,Math.max(14,Math.min(from.h,to.h)*.30))+'px',
   transformOrigin:'left center',
   transform:'translateY(-50%) rotate('+Math.atan2(dy,dx)+'rad)',
   borderRadius:'999px',
   background:'linear-gradient(90deg,'+from.paint+','+to.paint+')',
   filter:'blur(5px)',opacity:'0'
  });
  // Separate leading meniscus softens the hard straight-line bridge.
  const drop=document.createElement('div');
  drop.className='fhd-fluid-drop';
  drop.setAttribute('aria-hidden','true');
  Object.assign(drop.style,{
   position:'fixed',zIndex:'1003',pointerEvents:'none',
   left:(from.x+from.w/2-18)+'px',top:(from.y+from.h/2-18)+'px',
   width:'36px',height:'36px',borderRadius:'50%',
   background:'radial-gradient(circle at 42% 45%,'+from.paint+' 12%,transparent 72%)',
   filter:'blur(5px)',opacity:'0',willChange:'transform,opacity'
  });
  document.body.append(source,cover,bridge,drop);
  const motions=[];
  function play(node,frames,options){
   const a=node.animate(frames,{duration:TIME,easing:EASE,fill:'both',...options});
   motions.push(a);return a;
  }
  // Drawing across the whole duration with staggered fluid edges.
  play(source,[
   {clipPath:begin,opacity:1,offset:0},
   {clipPath:begin,opacity:1,offset:.11},
   {clipPath:clipOut,opacity:.94,offset:.85},
   {clipPath:clipOut,opacity:0,offset:1}
  ]);
  const dest=play(cover,[
   {clipPath:end,opacity:1,offset:0},
   {clipPath:end,opacity:1,offset:.11},
   {clipPath:clipIn,opacity:1,offset:.90},
   {clipPath:clipIn,opacity:0,offset:1}
  ]);
  play(bridge,[
   {clipPath:'inset(0% 100% 0% 0% round 999px)',opacity:0,offset:0},
   {clipPath:'inset(0% 66% 0% 0% round 999px)',opacity:.31,offset:.28},
   {clipPath:'inset(0% 3% 0% 22% round 999px)',opacity:.42,offset:.62},
   {clipPath:'inset(0% 0% 0% 100% round 999px)',opacity:0,offset:1}
  ]);
  play(drop,[
   {transform:'translate3d(0,0,0) scale(.5)',opacity:0,offset:0},
   {transform:'translate3d('+(dx*.22)+'px,'+(dy*.22)+'px,0) scale(1)',opacity:.49,offset:.24},
   {transform:'translate3d('+(dx*.8)+'px,'+(dy*.8)+'px,0) scale(1.18)',opacity:.44,offset:.75},
   {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(.48)',opacity:0,offset:1}
  ]);
  const effect={elements:[source,cover,bridge,drop],animations:motions};
  running=effect;
  function finish(){
   if(running!==effect)return;
   running=null;
   effect.elements.forEach(e=>e.remove());
   stats.completed++;
  }
  dest.addEventListener('finish',finish,{once:true});
  dest.addEventListener('cancel',finish,{once:true});
 }
 function click(event){
  if(reduced()||event.defaultPrevented)return;
  const button=event.target?.closest?.('button');
  if(!button||button.disabled||button.closest('.hidden'))return;
  const group=button.closest(combined);
  if(!group||button.parentElement!==group)return;
  const entry=GROUPS.find(g=>group.matches(g[1]));
  if(!entry)return;
  const peers=buttons(group),next=peers.indexOf(button);
  const old=peers.find(b=>chosen(b));
  if(next<0||!old||old===button)return;
  const from=measure(old),oldTarget=button.cloneNode(true);
  if(!visible(from))return;
  stats.requests++;
  // MUST wait for target/inline onclick handlers to complete.
  // A Promise/microtask here can fire *before* inline onclick in Android WebView.
  const afterClick=()=>{
   if(reduced())return;
   const nextGroup=document.querySelector(entry[1]);
   const selected=buttons(nextGroup)[next];
   if(!selected||!chosen(selected)||selected.disabled){stats.skipped++;return;}
   const to=measure(selected);
   animate(old,oldTarget,from,to);
  };
  if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(afterClick);
  else window.setTimeout?.(afterClick,0);
 }
 const style=document.createElement('style');
 style.textContent=[
  '.fhd-fluid-face .navIcon{font-size:27px;line-height:1.05;color:inherit}',
  '.fhd-fluid-face .starterIcon{font-size:1.13em;color:inherit}',
  '.fhd-fluid-face .fhd-tap-wave{display:none!important}',
  '@media(prefers-reduced-motion:reduce){.fhd-fluid-face,.fhd-fluid-bridge,.fhd-fluid-drop{display:none!important}}'
 ].join('');
 document.head.appendChild(style);
 document.addEventListener('click',click,{capture:true});
 window.FirstHyundaiSelectionFlow={
  version:'2.0.0',_test:{reduced,buttons,chosen,measure,stop,click,stats}
 };
})();
