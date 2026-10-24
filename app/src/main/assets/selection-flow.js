/* FIRST HYUNDAI · wind-drift tab selection v4.1
 * Real text and button geometry never move.  A flat color front withdraws
 * from the source and fills the target, accompanied by faint windblown wisps.
 * The five top destinations are ONE logical group across both navigation rows.
 */
(function(){
 'use strict';
 if(!document?.addEventListener || !document?.createElement || !window?.getComputedStyle)return;
 const TIME=760, EASE='cubic-bezier(.26,.76,.21,1)';
 const ROOT={key:'top-five',selector:'#nav'};
 const GROUPS=[
  {key:'property',selector:'.page:not(.hidden) .propertyTypeSwitch'},
  {key:'apartments',selector:'.page:not(.hidden) .tradeStarter.apartmentTradeNav'},
  {key:'office',selector:'.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'},
  {key:'trade-types',selector:'.page:not(.hidden) .tradeTypeBar'},
  {key:'new-types',selector:'.page:not(.hidden) .newTypeChips'},
  {key:'news',selector:'.page:not(.hidden) .newsCategoryTabs'}
 ];
 const stats={started:0,finished:0,skipped:0,topFive:0};
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
  const row=button.parentElement;
  const nav=button.closest('#nav');
  if(nav&&(row?.classList?.contains('primaryNav')||row?.classList?.contains('utilityNav')))
   return {spec:ROOT,group:nav};
  for(const spec of GROUPS){
   const group=button.closest(spec.selector);
   if(group&&button.parentElement===group)return {spec,group};
  }
  return null;
 }
 function paint(button){
  const s=window.getComputedStyle(button);
  const background=s.backgroundImage&&s.backgroundImage!=='none'?
   s.backgroundImage:s.backgroundColor;
  const found=(background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/)||[])[0];
  return {
   background,color:s.color,borderRadius:s.borderRadius||'12px',
   tint:(s.backgroundColor&&s.backgroundColor!=='transparent'&&
    !/^rgba\(0,\s*0,\s*0,\s*0\)$/.test(s.backgroundColor))?
    s.backgroundColor:(found||'#35666d')
  };
 }
 function visible(rect){
  return rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&
   rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
 }
 function edits(element,pairs,history){
  for(const [key,value,priority=''] of pairs){
   history.push([element.style,key,element.style.getPropertyValue(key),
    element.style.getPropertyPriority(key)]);
   element.style.setProperty(key,value,priority);
  }
 }
 function undo(history){
  for(let i=history.length-1;i>=0;i--){
   const [style,key,value,priority]=history[i];
   if(value)style.setProperty(key,value,priority);else style.removeProperty(key);
  }
 }
 function stop(){
  if(!stopCurrent)return;
  const fn=stopCurrent;stopCurrent=null;fn();
 }
 function layer(parent,kind,rect,background,radius,z){
  const node=document.createElement('span');
  node.className='fhd-wind-'+kind;node.setAttribute('aria-hidden','true');
  Object.assign(node.style,{
   position:'absolute',left:rect.x+'px',top:rect.y+'px',
   width:rect.w+'px',height:rect.h+'px',background,
   borderRadius:radius,pointerEvents:'none',zIndex:String(z),
   boxSizing:'border-box'
  });
  parent.appendChild(node);
  return node;
 }
 function animate(el,frames){
  const motion=el.animate(frames,{duration:TIME,easing:EASE,fill:'both'});
  return motion;
 }
 // A wide, straight color sheet moves along the ACTUAL two-dimensional
 // path between buttons, including diagonals between both upper rows.
 function windVector(a,b){
  const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;
  const length=Math.max(1,Math.hypot(dx,dy));
  return {dx,dy,ux:dx/length,uy:dy/length,
   angle:Math.atan2(dy,dx)*180/Math.PI};
 }
 function sweep(parent,rect,color,vector,nodes,animations){
  const diagonal=Math.hypot(rect.w,rect.h);
  const across=diagonal*2.2,along=diagonal*1.16;
  const slab=layer(parent,'sweep',{
   x:rect.w/2-across/2,y:rect.h/2-along/2,w:across,h:along
  },color,'0px',0);
  slab.style.transformOrigin='center center';
  nodes.push(slab);
  const offset=diagonal*1.26,angle=vector.angle-90;
  const move=d=>'translate3d('+(vector.ux*d)+'px,'+
   (vector.uy*d)+'px,0) rotate('+angle+'deg)';
  animations.push(animate(slab,[
   {transform:move(-offset),offset:0},
   {transform:move(-offset*.79),offset:.15},
   {transform:move(offset*.63),offset:.81},
   {transform:move(offset),offset:1}
  ]));
  return slab;
 }
 function wind(group,from,to,a,b,nodes,animations,oldTone,newTone){
  const cx=a.x+a.w/2,cy=a.y+a.h/2,ex=b.x+b.w/2,ey=b.y+b.h/2;
  const dx=ex-cx,dy=ey-cy,dist=Math.max(1,Math.hypot(dx,dy));
  const ux=dx/dist,uy=dy/dist,nx=-uy,ny=ux;
  const launch={x:cx+ux*Math.min(a.w*.41,64),y:cy+uy*Math.min(a.h*.41,37)};
  const landing={x:ex-ux*Math.min(b.w*.41,64),y:ey-uy*Math.min(b.h*.41,37)};
  const travelX=landing.x-launch.x,travelY=landing.y-launch.y;
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  // Low-opacity wisps and 8 dust grains — never a large colored blob or circle.
  for(let i=0;i<11;i++){
   const wisp=i<3;
   const size=wisp?32+i*11:2+(i%3)*1.4;
   const thickness=wisp?2.0+(i%2):1.6+(i%2);
   const drift=(i%5-2)*(wisp?8:11);
   const node=layer(group,wisp?'wisp':'grain',{
    x:launch.x+nx*drift-size/2,
    y:launch.y+ny*drift-thickness/2,
    w:size,h:thickness
   },wisp?'linear-gradient(90deg,transparent,'+
    (i%2?oldTone:newTone)+',transparent)':
    (i%2?oldTone:newTone),wisp?'12px':'2px',3);
   node.style.opacity='0';
   if(wisp)node.style.filter='blur(3px)';
   else node.style.filter='blur(.75px)';
   node.style.transformOrigin='center center';
   nodes.push(node);
   const sway=(i%4-1.5)*(wisp?3.5:7);
   const lead=0.04+(i%4)*.045;
   animations.push(animate(node,[
    {transform:'translate3d(0,0,0) rotate('+angle+'deg) scaleX(.55)',
     opacity:0,offset:0},
    {transform:'translate3d('+(travelX*.22+nx*sway)+'px,'+
     (travelY*.22+ny*sway)+'px,0) rotate('+angle+'deg) scaleX(1)',
     opacity:wisp?.17:.22,offset:lead+.22},
    {transform:'translate3d('+(travelX*.71-nx*sway)+'px,'+
     (travelY*.71-ny*sway)+'px,0) rotate('+angle+'deg) scaleX(1.08)',
     opacity:wisp?.13:.16,offset:.64+(i%3)*.035},
    {transform:'translate3d('+travelX+'px,'+travelY+
     'px,0) rotate('+angle+'deg) scaleX(.65)',
     opacity:0,offset:1}
   ]));
  }
 }
 function flow(group,key,oldIndex,nextIndex,oldSelection,oldTarget){
  if(reduced()){stats.skipped++;return;}
  const peers=buttons(group,key),source=peers[oldIndex],target=peers[nextIndex];
  if(!source||!target||source===target||!active(target)||
     typeof source.animate!=='function'){stats.skipped++;return;}
  const container=group.getBoundingClientRect(),
    src=source.getBoundingClientRect(),dst=target.getBoundingClientRect();
  if(!visible(src)||!visible(dst)){stats.skipped++;return;}
  const distanceX=(dst.left+dst.width/2)-(src.left+src.width/2);
  const distanceY=(dst.top+dst.height/2)-(src.top+src.height/2);
  if(Math.abs(distanceX)>window.innerWidth*1.5||
     Math.abs(distanceY)>window.innerHeight*.76){stats.skipped++;return;}
  const sx=group.scrollLeft||0,sy=group.scrollTop||0;
  const a={x:src.left-container.left+sx,y:src.top-container.top+sy,w:src.width,h:src.height};
  const b={x:dst.left-container.left+sx,y:dst.top-container.top+sy,w:dst.width,h:dst.height};
  const afterSource=paint(source),afterTarget=paint(target);
  const nodes=[],animations=[],history=[];
  let settled=false;
  function release(){
   if(settled)return;
   settled=true;
   for(const a of animations){try{a.cancel()}catch(e){}}
   undo(history);
   for(const n of nodes)n.remove();
  }
  try{
   edits(group,[['position','relative'],['isolation','isolate']],history);
   edits(source,[['position','relative'],['z-index','2'],
    ['background','transparent','important'],['transition','none','important']],history);
   edits(target,[['position','relative'],['z-index','2'],
    ['background','transparent','important'],['transition','none','important']],history);
   nodes.push(layer(group,'source-base',a,afterSource.background,
    afterSource.borderRadius,0));
   nodes.push(layer(group,'target-base',b,oldTarget.background,
    oldTarget.borderRadius,0));
   const vector=windVector(a,b);
   // Rounded card-size paint boxes stay fixed. Only their *internal*
   // straight-edged color sheets drift across. No layout or text motion.
   const out=layer(group,'source-color',a,oldSelection.background,
    oldSelection.borderRadius,1);
   const incoming=layer(group,'target-color',b,oldTarget.background,
    oldTarget.borderRadius,1);
   out.style.overflow='hidden';
   incoming.style.overflow='hidden';
   nodes.push(out,incoming);
   sweep(out,a,afterSource.background,vector,nodes,animations);
   sweep(incoming,b,afterTarget.background,vector,nodes,animations);
   const main=animations[0];
   wind(group,source,target,a,b,nodes,animations,oldSelection.tint,afterTarget.tint);
   animations.push(animate(source,[
    {color:oldSelection.color,offset:0},
    {color:afterSource.color,offset:.62},
    {color:afterSource.color,offset:1}
   ]));
   animations.push(animate(target,[
    {color:oldTarget.color,offset:0},
    {color:oldTarget.color,offset:.26},
    {color:afterTarget.color,offset:.90},
    {color:afterTarget.color,offset:1}
   ]));
   const finish=()=>{
    if(settled)return;
    if(stopCurrent===release)stopCurrent=null;
    release();stats.finished++;
   };
   stopCurrent=release;
   main.addEventListener('finish',finish,{once:true});
   main.addEventListener('cancel',finish,{once:true});
   stats.started++;
   if(key==='top-five')stats.topFive++;
  }catch(err){release();stats.skipped++;}
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
  if(next<0||previous<0||next===previous)return;
  const oldSelected=paint(peers[previous]),oldTarget=paint(button);
  const id=++sequence;
  // Rendered on next animation frame AFTER click navigation synchronously
  // rebuilds #nav; the same 5 logical destinations retain stable ordering.
  const start=()=>{
   if(id!==sequence||reduced())return;
   const fresh=document.querySelector(spec.selector);
   if(fresh)flow(fresh,spec.key,previous,next,oldSelected,oldTarget);
  };
  if(window.requestAnimationFrame)window.requestAnimationFrame(start);
  else window.setTimeout?.(start,0);
 }
 const css=document.createElement('style');
 css.textContent=[
  '.fhd-wind-source-base,.fhd-wind-target-base,.fhd-wind-source-color,.fhd-wind-target-color,.fhd-wind-wisp,.fhd-wind-grain{pointer-events:none!important}',
  '.fhd-wind-wisp,.fhd-wind-grain{will-change:transform,opacity}',
  '@media(prefers-reduced-motion:reduce){[class^="fhd-wind-"]{display:none!important}}'
 ].join('');
 document.head.appendChild(css);
 document.addEventListener('click',click,{capture:true});
 window.FirstHyundaiSelectionFlow={version:'4.1.0',
  _test:{buttons,active,paint,findGroup,stop,click,reduced,windVector,stats}};
})();