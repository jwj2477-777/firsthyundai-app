/* v2.1.36 · Smooth, stable, two-state navigation.
 * Layout-driven scroll animation caused feedback: changing the dock height
 * shifted scrollY, which then changed the dock height again every frame.
 * Only change size ONCE after crossing a wide hysteresis threshold; let CSS
 * interpolate all six tiles together. Never rebuild DOM or animate positions.
 */
(function(){
 'use strict';
 const nav=document.getElementById('nav');
 if(!nav)return;
 // The gap between thresholds exceeds the dock's entire height reduction.
 // Scroll anchoring cannot immediately reverse a collapse.
 const COLLAPSE_AT=140, RESTORE_AT=8;
 const EASED_PROPERTIES={
  '--fhd-dock-gap':[9,4],
  '--fhd-shell-padding':[8,4],
  '--fhd-shell-margin':[13,7],
  '--fhd-shell-radius':[20,15],
  '--fhd-column-gap':[9,4],
  '--fhd-tile-height':[90,48],
  '--fhd-tile-padding':[8,3],
  '--fhd-tile-gap':[6,1],
  '--fhd-tile-radius':[14,10],
  '--fhd-nav-font':[15,12],
  '--fhd-nav-font-small':[14,12],
  '--fhd-nav-icon':[29,17]
 };
 let compact=false,initialized=false,scheduled=false;
 function scrollPosition(){
  return Math.max(0,Number(window.scrollY)||0,
   Number(document.scrollingElement?.scrollTop)||0,
   Number(document.documentElement?.scrollTop)||0);
 }
 function reduced(){
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||
   window.FirstHyundaiUIOptions?.get?.()?.motion==='reduced';
 }
 // Exposed for deterministic regression checks (not an animation frame counter).
 function progress(y){
  return y>=COLLAPSE_AT?1:0;
 }
 function update(force=false){
  scheduled=false;
  const pos=scrollPosition();
  const next=compact?(pos>RESTORE_AT):(pos>=COLLAPSE_AT);
  // Rendering a different page recreates the six buttons. Reapply dimensions
  // to those NEW elements but do not restart CSS transitions on every scroll.
  if(initialized&&next===compact&&!force)return compact?1:0;
  compact=next;initialized=true;
  nav.classList.toggle('fhdNavReduced',reduced());
  for(const [name,values] of Object.entries(EASED_PROPERTIES))
   nav.style.setProperty(name,values[compact?1:0]+'px');
  const height=(compact?48:90)+'px';
  for(const button of nav.querySelectorAll('.primaryNav>button, .utilityNav>button:not(.adminCenterNav)')){
   button.style.setProperty('height',height,'important');
   button.style.setProperty('min-height',height,'important');
   button.style.setProperty('max-height',height,'important');
  }
  nav.dataset.navDensity=compact?'compact':'full';
  return compact?1:0;
 }
 function request(){
  if(scheduled)return;
  scheduled=true;
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>update());
  else update();
 }
 window.addEventListener('scroll',request,{passive:true});
 window.addEventListener('resize',request,{passive:true});
 window.addEventListener('pageshow',request,{passive:true});
 window.FirstHyundaiNavCollapse={update,progress};
 // Initial presentation must not animate into place.
 nav.classList.add('fhdNavInitializing');
 update(true);
 if(typeof requestAnimationFrame==='function')
  requestAnimationFrame(()=>nav.classList.remove('fhdNavInitializing'));
 else nav.classList.remove('fhdNavInitializing');
})();
