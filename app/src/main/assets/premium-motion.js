/* v2.0.59 · Touch micro-interactions for the FirstHyundai Android WebView.
 * Visual-only: delegated passive pointer listener, zero navigation/contract effects.
 * CSS owns the press and ripple geometry. Respect Android reduced-motion settings. */
(function(){
 'use strict';
 if(!document?.addEventListener||!document?.createElement)return;
 const selector='button, a.btn, a.complexQuickLink, summary, [role="button"]';
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const stats={touches:0,waves:0};
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
  wave.addEventListener('animationend',()=>wave.remove(),{once:true});
  target.classList.add('fhd-touch-feedback');
  target.appendChild(wave);
  stats.waves++;
 }
 document.addEventListener('pointerdown',touch,{passive:true});
 window.FirstHyundaiMotion={version:'2.0.59',_test:{touch,reduced,stats}};
})();