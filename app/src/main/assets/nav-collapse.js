/* v2.1.37 · Genuine proportional scroll-linked navigation.
 * The former 140px on/off trigger was the abrupt jump the user observed.
 * We now map scroll distance continuously to six identical button dimensions.
 * Disabling native scroll anchoring prevents layout-height feedback/jitter.
 */
(function(){
 'use strict';
 const nav=document.getElementById('nav');
 if(!nav)return;
 const RANGE=210,MIN_HEIGHT=48,MAX_HEIGHT=90;
 const BETWEEN={
  '--fhd-dock-gap':[9,4],
  '--fhd-shell-padding':[8,4],
  '--fhd-shell-margin':[13,7],
  '--fhd-shell-radius':[20,15],
  '--fhd-column-gap':[9,4],
  '--fhd-tile-height':[MAX_HEIGHT,MIN_HEIGHT],
  '--fhd-tile-padding':[8,3],
  '--fhd-tile-gap':[6,1],
  '--fhd-tile-radius':[14,10],
  '--fhd-nav-font':[15,12],
  '--fhd-nav-font-small':[14,12],
  '--fhd-nav-icon':[29,17]
 };
 let last=-1,scheduled=false;
 // Scroll anchoring would otherwise adjust scrollTop when the sticky menu
 // changes the page height. The menu must follow the gesture, not feed back.
 const scroller=document.scrollingElement||document.documentElement;
 if(scroller?.style)scroller.style.overflowAnchor='none';
 function scrollPosition(){
  return Math.max(0,Number(window.scrollY)||0,
   Number(scroller?.scrollTop)||0,
   Number(document.documentElement?.scrollTop)||0);
 }
 function reduced(){
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||
   window.FirstHyundaiUIOptions?.get?.()?.motion==='reduced';
 }
 function progress(y){
  return Math.max(0,Math.min(1,(Number(y)||0)/RANGE));
 }
 function update(force=false){
  scheduled=false;
  const position=scrollPosition();
  const density=reduced()?(position>=105?1:0):progress(position);
  if(!force&&Math.abs(density-last)<0.00015)return density;
  last=density;
  for(const [name,[full,small]] of Object.entries(BETWEEN)){
   nav.style.setProperty(name,(full+(small-full)*density).toFixed(3)+'px');
  }
  const height=(MAX_HEIGHT+(MIN_HEIGHT-MAX_HEIGHT)*density).toFixed(3)+'px';
  for(const tile of nav.querySelectorAll('.primaryNav>button,.utilityNav>button:not(.adminCenterNav)')){
   tile.style.setProperty('height',height,'important');
   tile.style.setProperty('min-height',height,'important');
   tile.style.setProperty('max-height',height,'important');
  }
  nav.dataset.navDensity=density>=.999?'compact':density<=.001?'full':'transitioning';
  return density;
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
 window.FirstHyundaiNavCollapse={update,progress,range:RANGE};
 update(true);
})();
