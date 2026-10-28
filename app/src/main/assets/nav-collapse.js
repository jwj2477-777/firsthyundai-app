/* v2.1.35 · A calm, scroll-linked morph of the existing six-menu grid.
 * No DOM replacement, page navigation hooks, transform effects or extra timers.
 * Natural vertical scrolling controls density; reduced-motion uses a direct step.
 */
(function(){
 'use strict';
 const nav=document.getElementById('nav');
 if(!nav)return;
 const RANGE=170;
 let scheduled=false,last=-1;
 const position=()=>Math.max(0,Number(window.scrollY)||0,
  Number(document.scrollingElement?.scrollTop)||0,
  Number(document.documentElement?.scrollTop)||0);
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||
  window.FirstHyundaiUIOptions?.get?.()?.motion==='reduced';
 function progress(y){
  const fraction=Math.max(0,Math.min(1,y/RANGE));
  if(reduced())return y>80?1:0;
  return fraction*fraction*(3-2*fraction);
 }
 function update(){
  scheduled=false;
  const density=progress(position());
  const rounded=Math.round(density*1000)/1000;
  // Navigation buttons are recreated on page changes; even at the same scroll
  // position, reapply their native height to the new elements.
  last=rounded;
  nav.style.setProperty('--fhd-nav-factor',String(rounded));
  // Older Android WebViews reject multiplication within CSS calc().
  // Supply actual CSS lengths so both rows always retain identical geometry.
  const lengths={
   '--fhd-dock-gap':9-5*rounded,
   '--fhd-shell-padding':8-4*rounded,
   '--fhd-shell-margin':13-6*rounded,
   '--fhd-shell-radius':20-5*rounded,
   '--fhd-column-gap':9-5*rounded,
   '--fhd-tile-height':90-42*rounded,
   '--fhd-tile-padding':8-5*rounded,
   '--fhd-tile-gap':6-5*rounded,
   '--fhd-tile-radius':14-4*rounded,
   '--fhd-nav-font':15-3*rounded,
   '--fhd-nav-font-small':14-2*rounded,
   '--fhd-nav-icon':29-12*rounded
  };
  for(const [name,value] of Object.entries(lengths))
   nav.style.setProperty(name,value.toFixed(2)+'px');
  // Legacy theme rules impose a larger intrinsic button size on narrow phones.
  // Explicit important inline bounds win over those inherited rules, while
  // the visual icons and labels still use the shared CSS variables above.
  const tileHeight=lengths['--fhd-tile-height'].toFixed(2)+'px';
  for(const button of nav.querySelectorAll('.primaryNav>button, .utilityNav>button:not(.adminCenterNav)')){
   button.style.setProperty('height',tileHeight,'important');
   button.style.setProperty('min-height',tileHeight,'important');
   button.style.setProperty('max-height',tileHeight,'important');
  }
  nav.dataset.navDensity=rounded>=.98?'compact':rounded<=.02?'full':'transitioning';
  return rounded;
 }
 function request(){
  if(scheduled)return;
  scheduled=true;
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(update);
  else update();
 }
 window.addEventListener('scroll',request,{passive:true});
 window.addEventListener('resize',request,{passive:true});
 window.addEventListener('pageshow',request,{passive:true});
 window.FirstHyundaiNavCollapse={update,progress};
 update();
})();
