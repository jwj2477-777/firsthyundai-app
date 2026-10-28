/* v2.1.38 · Gently eased proportional scroll-linked navigation.
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
 let boundTiles=[];
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
  const t=Math.max(0,Math.min(1,(Number(y)||0)/RANGE));
  // 72% direct finger-following + 28% smoothstep. Unlike an on/off
  // animation there is no threshold, no spring and no delayed catch-up.
  // Ease at both ends is subtle, so the content remains responsive.
  const eased=t*t*(3-2*t);
  return t*.72+eased*.28;
 }
 function bindTiles(){
  const tiles=[...nav.querySelectorAll('.primaryNav>button,.utilityNav>button:not(.adminCenterNav)')];
  if(tiles.length===boundTiles.length&&tiles.every((tile,i)=>tile===boundTiles[i]))return;
  // Bind these three CSS expressions only when the navigation DOM is
  // re-rendered. Each animation frame then updates shared CSS variables,
  // not 18 individual height/min/max styles, avoiding repeated layout work.
  const variable='var(--fhd-tile-height,90px)';
  for(const tile of tiles){
   tile.style.setProperty('height',variable,'important');
   tile.style.setProperty('min-height',variable,'important');
   tile.style.setProperty('max-height',variable,'important');
  }
  boundTiles=tiles;
 }
 function update(force=false){
  scheduled=false;
  const position=scrollPosition();
  const density=reduced()?(position>=105?1:0):progress(position);
  if(force||!boundTiles.length)bindTiles();
  if(!force&&Math.abs(density-last)<0.0008)return density;
  last=density;
  for(const [name,[full,small]] of Object.entries(BETWEEN)){
   const value=(full+(small-full)*density).toFixed(2)+'px';
   if(nav.style.getPropertyValue(name)!==value)nav.style.setProperty(name,value);
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
