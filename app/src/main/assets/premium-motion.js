/* v2.0.60 · Touch micro-interactions for the FirstHyundai Android WebView.
 * Visual-only: delegated passive pointer listener, zero navigation/contract effects.
 * CSS owns the press and ripple geometry. Respect Android reduced-motion settings.
 * v2.0.61: one-time cold-start entrance, initiated when native WebView is ready. */
(function(){
 'use strict';
 if(!document?.addEventListener||!document?.createElement)return;
 const selector='button, a.btn, a.complexQuickLink, summary, [role="button"]';
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const stats={touches:0,waves:0,entrances:0};
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
 window.FirstHyundaiMotion={version:'2.0.61',playEntrance,_test:{touch,reduced,stats}};
 // Browsers used for UI preview have no Android bridge; keep a single
 // elegant initial reveal there as well, without affecting app navigation.
 if(!window.FirstHyundaiNative)playEntrance();
})();