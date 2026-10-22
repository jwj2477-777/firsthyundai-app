/* v2.0.13: shared scroll-to-top button. Uses the currently visible scroll root. */
(function(){
 'use strict';
 const button=document.getElementById('scrollToTop');
 if(!button)return;
 const sheets=['complexSheet','nearbyDetails'].map(id=>document.getElementById(id)).filter(Boolean);
 const THRESHOLD=240;
 function activeSheet(){
  return sheets.find(el=>el.classList?.contains('detailOpen')&&
   el.getAttribute?.('aria-hidden')!=='true')||null;
 }
 function position(el){
  if(el)return Math.max(0,Number(el.scrollTop)||0);
  return Math.max(0,Number(window.scrollY)||0,
   Number(document.scrollingElement?.scrollTop)||0,
   Number(document.documentElement?.scrollTop)||0,
   Number(document.body?.scrollTop)||0);
 }
 function update(){
  const show=position(activeSheet())>THRESHOLD;
  button.hidden=!show;
  button.setAttribute?.('aria-hidden',show?'false':'true');
 }
 function go(){
  const target=activeSheet();
  const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth';
  if(target){
   if(typeof target.scrollTo==='function'){
    try{target.scrollTo({top:0,behavior});}
    catch(e){target.scrollTop=0;}
   }else target.scrollTop=0;
  }else if(typeof window.scrollTo==='function'){
   try{window.scrollTo({top:0,behavior});}
   catch(e){
    if(document.scrollingElement)document.scrollingElement.scrollTop=0;
    if(document.documentElement)document.documentElement.scrollTop=0;
   }
  }else{
   if(document.scrollingElement)document.scrollingElement.scrollTop=0;
   if(document.documentElement)document.documentElement.scrollTop=0;
   if(document.body)document.body.scrollTop=0;
  }
  update();
 }
 button.addEventListener?.('click',go);
 window.addEventListener?.('scroll',update,{passive:true});
 window.addEventListener?.('resize',update,{passive:true});
 sheets.forEach(el=>el.addEventListener?.('scroll',update,{passive:true}));
 window.FirstHyundaiScrollTop={update,go};
 update();
})();
