/* FIRST HYUNDAI · pure color transfer v5
 * The only moving element is the boundary of the two selected backgrounds.
 * Buttons, labels, icons, borders, shadows and screen layout are immobile.
 * No rotated slabs, bubbles, dust, ribbons, flying clones or animated size.
 */
(function(){
 'use strict';
 if(!document?.addEventListener||!window?.getComputedStyle)return;
 const TIME=660;
 const ROOT={key:'top-five',selector:'#nav'};
 const GROUPS=[
  {key:'property',selector:'.page:not(.hidden) .propertyTypeSwitch'},
  {key:'apartments',selector:'.page:not(.hidden) .tradeStarter.apartmentTradeNav'},
  {key:'office',selector:'.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'},
  {key:'trade-types',selector:'.page:not(.hidden) .tradeTypeBar'},
  {key:'new-types',selector:'.page:not(.hidden) .newTypeChips'},
  {key:'news',selector:'.page:not(.hidden) .newsCategoryTabs'}
 ];
 const stats={started:0,finished:0,skipped:0,topFive:0,news:0};
 let stopCurrent=null,sequence=0;
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const active=b=>!!b&&(b.classList.contains('active')||
  b.classList.contains('selected')||b.getAttribute('aria-current')==='page'||
  b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true');
 const buttons=(group,key)=>!group?[]:key==='top-five'?
  Array.from(group.querySelectorAll('.primaryNav > button, .utilityNav > button'))
   .filter(b=>b.parentElement?.classList?.contains('primaryNav')||
    b.parentElement?.classList?.contains('utilityNav')):
  Array.from(group.children).filter(e=>e.tagName==='BUTTON');
 function findGroup(button){
  const parent=button.parentElement,nav=button.closest('#nav');
  if(nav&&(parent?.classList?.contains('primaryNav')||
     parent?.classList?.contains('utilityNav')))return {spec:ROOT,group:nav};
  for(const spec of GROUPS){
   const group=button.closest(spec.selector);
   if(group&&button.parentElement===group)return {spec,group};
  }
  return null;
 }
 function paint(button){
  const s=window.getComputedStyle(button);
  return {
   background:(s.backgroundImage&&s.backgroundImage!=='none')?
    s.backgroundImage:s.backgroundColor,
   color:s.color
  };
 }
 const visible=r=>r&&r.width>0&&r.height>0&&
  r.bottom>0&&r.top<window.innerHeight&&r.right>0&&r.left<window.innerWidth;
 function direction(from,to){
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const dx=b.left+b.width/2-a.left-a.width/2;
  const dy=b.top+b.height/2-a.top-a.height/2;
  // CSS gradients: 0deg rises, 90deg travels right, 180deg travels down.
  return (Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
 }
 function mask(angle,position,isSource){
  const low=(position-5).toFixed(2)+'%';
  const high=(position+5).toFixed(2)+'%';
  return isSource?
   'linear-gradient('+angle+'deg, transparent '+low+', #000 '+high+')':
   'linear-gradient('+angle+'deg, #000 '+low+', transparent '+high+')';
 }
 function setMask(node,angle,position,isSource){
  const value=mask(angle,position,isSource);
  node.style.webkitMaskImage=value;
  node.style.maskImage=value;
 }
 function remember(el,key,value,priority,undo){
  const style=el.style;
  undo.push([style,key,style.getPropertyValue(key),style.getPropertyPriority(key)]);
  style.setProperty(key,value,priority||'');
 }
 function restore(undo){
  for(let i=undo.length-1;i>=0;i--){
   const [style,key,value,priority]=undo[i];
   if(value)style.setProperty(key,value,priority);
   else style.removeProperty(key);
  }
 }
 function stop(){
  if(!stopCurrent)return;
  const finish=stopCurrent;stopCurrent=null;finish();
 }
 function makePaint(button,color){
  const el=document.createElement('span');
  el.className='fhd-color-only-overlay';
  el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{
   position:'absolute',inset:'0',width:'100%',height:'100%',
   pointerEvents:'none',borderRadius:'inherit',background:color,
   zIndex:'-1',display:'block',margin:'0',padding:'0',border:'0',
   boxShadow:'none',transform:'none'
  });
  button.appendChild(el);
  return el;
 }
 function interpolate(t){return t*t*(3-2*t)}
 function clamp(t){return Math.max(0,Math.min(1,t))}
 function progress(t){
  const eased=interpolate(clamp(t));
  // Shared front: old color recedes just before the new color arrives.
  return {
   source:-12+124*clamp(eased/.84),
   target:-12+124*clamp((eased-.16)/.84)
  };
 }
 function flow(group,key,previous,next,beforeSource,beforeTarget){
  const peers=buttons(group,key),source=peers[previous],target=peers[next];
  if(reduced()||!source||!target||source===target||!active(target)||
   typeof window.requestAnimationFrame!=='function'){stats.skipped++;return;}
  const sr=source.getBoundingClientRect(),tr=target.getBoundingClientRect();
  if(!visible(sr)||!visible(tr)){stats.skipped++;return;}
  const angle=direction(source,target);
  const finalSource=paint(source),finalTarget=paint(target);
  const changes=[],nodes=[],animations=[];
  let rafId=null,finished=false,started=null;
  function release(){
   if(finished)return;
   finished=true;
   if(rafId!=null)window.cancelAnimationFrame?.(rafId);
   for(const a of animations){try{a.cancel()}catch(_){}}
   for(const node of nodes)node.remove();
   restore(changes);
  }
  try{
   // No classes, text, font sizes or dimensions are modified.
   // Keep the original CSS-selected borders and shadows entirely unchanged.
   for(const button of [source,target]){
    remember(button,'position','relative','',changes);
    remember(button,'isolation','isolate','',changes);
    remember(button,'z-index','0','',changes);
    remember(button,'overflow','hidden','',changes);
    remember(button,'transition','none','important',changes);
   }
   // Source already has the inactive CSS; mask its OLD active paint away.
   // Target already has active CSS; hide it temporarily behind idle paint.
   remember(target,'background',beforeTarget.background,'important',changes);
   const outgoing=makePaint(source,beforeSource.background);
   const arriving=makePaint(target,finalTarget.background);
   nodes.push(outgoing,arriving);
   // Initial frame prevents an initial all-colored target flash.
   setMask(outgoing,angle,-12,true);
   setMask(arriving,angle,-12,false);
   if(source.animate)animations.push(source.animate([
    {color:beforeSource.color,offset:0},
    {color:beforeSource.color,offset:.12},
    {color:finalSource.color,offset:.75},
    {color:finalSource.color,offset:1}
   ],{duration:TIME,easing:'ease-in-out',fill:'both'}));
   if(target.animate)animations.push(target.animate([
    {color:beforeTarget.color,offset:0},
    {color:beforeTarget.color,offset:.29},
    {color:finalTarget.color,offset:.86},
    {color:finalTarget.color,offset:1}
   ],{duration:TIME,easing:'ease-in-out',fill:'both'}));
   function tick(now){
    if(finished)return;
    if(started===null)started=now;
    const t=clamp((now-started)/TIME),p=progress(t);
    setMask(outgoing,angle,p.source,true);
    setMask(arriving,angle,p.target,false);
    if(t<1)rafId=window.requestAnimationFrame(tick);
    else {
     if(stopCurrent===release)stopCurrent=null;
     release();stats.finished++;
    }
   }
   stopCurrent=release;
   stats.started++;
   if(key==='top-five')stats.topFive++;
   if(key==='news')stats.news++;
   rafId=window.requestAnimationFrame(tick);
  }catch(err){
   if(stopCurrent===release)stopCurrent=null;
   release();stats.skipped++;
  }
 }
 function click(event){
  if(reduced()||event.defaultPrevented)return;
  const button=event.target?.closest?.('button');
  if(!button||button.disabled||button.closest('.hidden'))return;
  const result=findGroup(button);
  if(!result)return;
  stop();
  const {spec,group}=result,peers=buttons(group,spec.key);
  const next=peers.indexOf(button),previous=peers.findIndex(active);
  if(next<0||previous<0||previous===next)return;
  const from=paint(peers[previous]),to=paint(button),seq=++sequence;
  // Captured BEFORE the original onclick; the next frame sees the
  // newly rendered active state (including across all five header tabs).
  window.requestAnimationFrame?.(()=>{
   if(seq!==sequence||reduced())return;
   const fresh=document.querySelector(spec.selector);
   if(fresh)flow(fresh,spec.key,previous,next,from,to);
  });
 }
 const css=document.createElement('style');
 css.textContent=[
  '.fhd-color-only-overlay{position:absolute!important;inset:0!important;',
  'width:100%!important;height:100%!important;pointer-events:none!important;',
  'z-index:-1!important;border-radius:inherit!important;box-shadow:none!important;',
  'transform:none!important;}',
  '@media(prefers-reduced-motion:reduce){.fhd-color-only-overlay{display:none!important}}'
 ].join('');
 document.head.appendChild(css);
 document.addEventListener('click',click,{capture:true});
 window.FirstHyundaiSelectionFlow={version:'5.0.0',
  _test:{buttons,active,paint,findGroup,stop,click,mask,direction,progress,reduced,stats}};
})();
