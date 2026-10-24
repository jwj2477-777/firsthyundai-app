/* v2.0.62 · Touch micro-interactions for the FirstHyundai Android WebView.
 * Visual-only: delegated passive pointer listener, zero navigation/contract effects.
 * CSS owns the press and ripple geometry. Respect Android reduced-motion settings.
 * v2.0.61: one-time cold-start entrance, initiated when native WebView is ready. */
(function(){
 'use strict';
 if(!document?.addEventListener||!document?.createElement)return;
 const selector='button, a.btn, a.complexQuickLink, summary, [role="button"]';
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const stats={touches:0,waves:0,entrances:0,handoffs:0};
 let entrancePlayed=false;
 function playEntrance(){
  if(entrancePlayed||reduced())return false;
  const body=document.body,nav=document.querySelector?.('#nav .primaryNav button:last-child');
  if(!body?.classList||!nav)return false;
  entrancePlayed=true;stats.entrances++;
  body.classList.add('fhd-first-render');
  // Remove the one-time class after the last nav card finishes, so later
  // nav re-renders do not re-run the cold-start sequence.
  nav.addEventListener?.('animationend',()=>{
   body.classList.remove('fhd-first-render');
  },{once:true});
  return true;
 }
 // Bridge identical branded elements between the native intro and the live header.
 // Destinations are MEASURED after layout, never based on screen-width guesses.
 let handoff=null,handoffDone=false;
 const headerTargets=()=>{
  const els=['header .officeMark','header .brandWordmark h1','header .brandSubtitle']
   .map(selector=>document.querySelector?.(selector));
  if(els.some(x=>!x))return null;
  const boxes=els.map(x=>x.getBoundingClientRect());
  return boxes.some(x=>!x||x.width<=0||x.height<=0)?null:{els,boxes};
 };
 function finishBrandHandoff(){
  if(handoffDone)return;
  handoffDone=true;
  const scene=handoff?.scene;handoff=null;
  document.body?.classList?.remove('fhd-brand-handoff');
  scene?.remove?.();
  stats.handoffs++;
 }
 function prepareBrandHandoff(){
  if(handoffDone||handoff||reduced()||!window.FirstHyundaiNative)return false;
  const dest=headerTargets();
  if(!dest||!document.body?.appendChild)return false;
  const make=(tag,cls)=>{
   const node=document.createElement(tag);node.className=cls;return node;
  };
  const scene=make('div','fhd-brand-bridge');scene.setAttribute('aria-hidden','true');
  const backdrop=make('div','fhd-bridge-backdrop');
  const identity=make('div','fhd-bridge-identity');
  const badgeStage=make('div','fhd-bridge-badge-stage');
  const ring=make('span','fhd-bridge-ring');
  const badge=dest.els[0].cloneNode(true);badge.className='fhd-bridge-logo';
  const title=make('div','fhd-bridge-title');title.textContent=dest.els[1].textContent;
  const rule=make('span','fhd-bridge-rule');
  const subtitle=make('div','fhd-bridge-subtitle');subtitle.textContent=dest.els[2].textContent;
  badgeStage.appendChild(ring);badgeStage.appendChild(badge);
  identity.appendChild(badgeStage);identity.appendChild(title);
  identity.appendChild(rule);identity.appendChild(subtitle);
  scene.appendChild(backdrop);scene.appendChild(identity);
  document.body.classList.add('fhd-brand-handoff');
  document.body.appendChild(scene);
  handoff={scene,backdrop,badge,title,subtitle,ring,rule,dest};
  return true;
 }
 function animateTo(element,rect,duration){
  const start=element.getBoundingClientRect();
  const dx=(rect.left+rect.width/2)-(start.left+start.width/2);
  const dy=(rect.top+rect.height/2)-(start.top+start.height/2);
  const sx=rect.width/start.width,sy=rect.height/start.height;
  if(![dx,dy,sx,sy].every(Number.isFinite)||sx<=0||sy<=0)return null;
  return element.animate([
   {transform:'translate3d(0,0,0) scale(1,1)',opacity:1},
   {transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+sx+','+sy+')',opacity:1}
  ],{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
 }
 function startBrandHandoff(){
  if(!handoff||handoffDone)return false;
  const h=handoff,dests=h.dest.els.map(el=>el.getBoundingClientRect());
  if(dests.some(x=>!x||x.width<=0)||typeof h.badge.animate!=='function'){
   finishBrandHandoff();playEntrance();return false;
  }
  try{
   const duration=620;
   const motions=[animateTo(h.badge,dests[0],duration),
    animateTo(h.title,dests[1],duration),
    animateTo(h.subtitle,dests[2],duration)];
   if(motions.some(a=>!a))throw new Error('Invalid header geometry');
   playEntrance();
   h.backdrop.animate([{opacity:1},{opacity:1,offset:.22},{opacity:0}],
    {duration,fill:'forwards',easing:'ease-out'});
   h.ring.animate([{opacity:1},{opacity:0}],{duration:390,fill:'forwards'});
   h.rule.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'});
   Promise.all(motions.map(a=>a.finished)).then(finishBrandHandoff,finishBrandHandoff);
   window.setTimeout?.(finishBrandHandoff,duration+400);
   h.scene.addEventListener?.('click',finishBrandHandoff,{once:true});
   return true;
  }catch(e){finishBrandHandoff();return false;}
 }
 // Android main activity draws the SAME native badge/text that the opening
 // screen used. Measure the real DOM header only; do not draw a second CSS
 // lookalike in front of the original artwork.
 function nativeHeaderRects(){
  const target=headerTargets();
  if(reduced()||!target)return null;
  const viewport=document.documentElement?.clientWidth||window.innerWidth||0;
  if(!(viewport>0))return null;
  const values=target.boxes.flatMap(r=>[r.left,r.top,r.width,r.height]);
  if(values.some(v=>!Number.isFinite(v)))return null;
  document.body.classList.add('fhd-native-handoff');
  return [...values,viewport];
 }
 function finishNativeHandoff(){
  document.body?.classList?.remove('fhd-native-handoff');
  document.body?.classList?.add('fhd-native-arrived');
 }
 function touch(event){
  if(reduced()||event?.isPrimary===false||event?.pointerType==='mouse'&&event?.button!==0)return;
  const origin=event?.target;
  const target=origin?.closest?.(selector);
  if(!target||target.disabled||target.getAttribute?.('aria-disabled')==='true'||
    target.classList?.contains?.('hidden')||target.closest?.('.hidden')||
    !target.getBoundingClientRect)return;
  const box=target.getBoundingClientRect();
  if(!(box.width>0&&box.height>0))return;
  // Avoid visual effects on noninteractive content, hidden tabs and form inputs.
  const wave=document.createElement('span');
  wave.className='fhd-tap-wave';
  wave.setAttribute('aria-hidden','true');
  const size=Math.min(720,Math.max(60,Math.hypot(box.width,box.height)*2));
  const x=Number.isFinite(event.clientX)?event.clientX-box.left:box.width/2;
  const y=Number.isFinite(event.clientY)?event.clientY-box.top:box.height/2;
  wave.style.width=size+'px';wave.style.height=size+'px';
  wave.style.left=x+'px';wave.style.top=y+'px';
  // Don't pile up overlays when a parent double-taps or quickly switches tabs.
  target.querySelectorAll?.('.fhd-tap-wave')?.forEach(n=>n.remove?.());
  wave.addEventListener('animationend',()=>{
   wave.remove();
   if(!target.querySelector?.('.fhd-tap-wave'))target.classList.remove?.('fhd-touch-feedback');
  },{once:true});
  target.classList.add('fhd-touch-feedback');
  target.appendChild(wave);
  stats.waves++;
 }
 document.addEventListener('pointerdown',touch,{passive:true});
 window.FirstHyundaiMotion={version:'2.0.64',playEntrance,prepareBrandHandoff,startBrandHandoff,nativeHeaderRects,finishNativeHandoff,_test:{touch,reduced,stats,headerTargets,finishBrandHandoff}};
 // Browsers used for UI preview have no Android bridge; keep a single
 // elegant initial reveal there as well, without affecting app navigation.
 if(!window.FirstHyundaiNative)playEntrance();
})();