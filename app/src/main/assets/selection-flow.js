/* FIRST HYUNDAI · direct background-color flow v6
 * No overlays, masks, moving shapes, transforms, resized buttons or clones.
 * The ACTUAL button backgrounds are painted in place, behind original text.
 * Intermediate top-menu buttons show a brief passing band, never become active.
 */
(function(){
 'use strict';
 if(!document?.addEventListener||!window?.getComputedStyle)return;
 const DURATION=720;
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
 const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const chosen=b=>!!b&&(b.classList.contains('active')||
  b.classList.contains('selected')||b.getAttribute('aria-current')==='page'||
  b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true');
 const buttons=(group,key)=>!group?[]:key==='top-five'?
  Array.from(group.querySelectorAll('.primaryNav > button, .utilityNav > button'))
   .filter(el=>el.tagName==='BUTTON'&&
    (el.parentElement?.classList?.contains('primaryNav')||
     el.parentElement?.classList?.contains('utilityNav'))):
  Array.from(group.children).filter(el=>el.tagName==='BUTTON');
 function findGroup(button){
  const parent=button.parentElement,nav=button.closest('#nav');
  if(nav&&(parent?.classList?.contains('primaryNav')||
   parent?.classList?.contains('utilityNav')))return {group:nav,spec:MAIN};
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
   idle+' '+pct(position-5)+', '+selected+' '+pct(position+5)+')';
 }
 function toPaint(angle,idle,selected,position){
  return 'linear-gradient('+angle+'deg, '+
   selected+' '+pct(position-5)+', '+idle+' '+pct(position+5)+')';
 }
 function passPaint(angle,idle,selected,position){
  // A small wave of the SAME source pigment briefly crosses a button that
  // lies between endpoints. It does not change that button's selected state.
  return 'linear-gradient('+angle+'deg, '+
   idle+' '+pct(position-33)+', '+selected+' '+pct(position-24)+', '+
   selected+' '+pct(position+9)+', '+idle+' '+pct(position+18)+')';
 }
 function intermediates(peers,from,to){
  const r1=peers[from].getBoundingClientRect();
  const r2=peers[to].getBoundingClientRect();
  const A=center(r1),v=vector(r1,r2);
  return peers.map((button,index)=>{
   if(index===from||index===to)return null;
   const r=button.getBoundingClientRect(),p=center(r);
   const vx=p.x-A.x,vy=p.y-A.y;
   const progress=(vx*v.ux+vy*v.uy)/v.len;
   const off=Math.abs(vx*v.uy-vy*v.ux);
   // Only actual between-points, close-to-the-segment tabs glow on passage.
   const corridor=Math.min(128,Math.max(r.width,r.height)*.68);
   return progress>.05&&progress<.95&&off<corridor?
    {index,progress,button}:null;
  }).filter(Boolean).sort((a,b)=>a.progress-b.progress);
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
  if(!source||!target||source===target||!chosen(target)||reduceMotion()||
   !window.requestAnimationFrame){stats.skipped++;return;}
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(!visible(a)||!visible(b)){stats.skipped++;return;}
  const v=vector(a,b),afterSource=getPaint(source),afterTarget=getPaint(target);
  const mids=key==='top-five'?intermediates(peers,previous,next):[];
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
  stats.lastPath=[previous,...mids.map(m=>m.index),next];
  const angle=v.angle;
  const oldColor=originalSelected.color;
  const newColor=afterTarget.color;
  function paintFrame(time){
   if(finished)return;
   if(initial==null)initial=time;
   const t=clamp((time-initial)/DURATION);
   const oldFront=112*ease(clamp((t+.06)/.89))-6;
   const newFront=112*ease(clamp((t-.11)/.89))-6;
   useBackground(source,fromPaint(angle,afterSource.color,oldColor,oldFront),saved);
   useBackground(target,toPaint(angle,originalIdle.color,newColor,newFront),saved);
   for(const {button,progress} of mids){
    // Passing color pulse tracks actual distance along the route. The 5
    // actual states and all onclick handlers remain completely unchanged.
    const at=.12+progress*.75;
    const local=(t-(at-.155))/.31;
    if(local<0||local>1){
     if(saved.has(button)){
      const prior=saved.get(button);
      if(prior.value)button.style.setProperty('background',prior.value,prior.priority);
      else button.style.removeProperty('background');
     }
    }else{
     useBackground(button,passPaint(angle,getPaintBase(button),oldColor,
      -24+148*ease(local)),saved);
    }
   }
   if(t<1)raf=window.requestAnimationFrame(paintFrame);
   else{
    if(running?.cleanup===cleanup)running=null;
    cleanup();
    stats.finished++;
   }
  }
  const idleColors=new Map(mids.map(m=>[m.button,getPaint(m.button).color]));
  function getPaintBase(button){return idleColors.get(button)||'#FFFFFF'}
  // Immediate first paint. No RAF delays between new selected DOM and effect.
  useBackground(source,fromPaint(angle,afterSource.color,oldColor,-6),saved);
  useBackground(target,toPaint(angle,originalIdle.color,newColor,-6),saved);
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
  // Native onclick runs after this capture listener, replacing #nav as needed.
  window.requestAnimationFrame?.(()=>{
   if(id!==sequence||reduceMotion())return;
   const nextGroup=document.querySelector(spec.selector);
   if(nextGroup)animate(nextGroup,spec.key,previous,next,selected,idle);
  });
 }
 document.addEventListener('click',onClick,{capture:true});
 window.FirstHyundaiSelectionFlow={version:'6.0.0',
  _test:{buttons,chosen,findGroup,getPaint,fromPaint,toPaint,passPaint,
   vector,intermediates,stop,onClick,stats}};
})();
