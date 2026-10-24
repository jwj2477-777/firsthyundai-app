/* FIRST HYUNDAI · premium liquid selection v3
 * Only backgrounds move. Text and icons remain in the REAL button.
 * The original selected paints are reinstated after every animation.
 */
(function(){
 'use strict';
 if(!document?.addEventListener||!document?.createElement||!window?.getComputedStyle)return;
 const DURATION=860,EASE='cubic-bezier(.28,.72,.16,1)';
 const GROUPS=[
  ['main','#nav .primaryNav'],
  ['shortcuts','#nav .utilityNav'],
  ['property','.page:not(.hidden) .propertyTypeSwitch'],
  ['apartments','.page:not(.hidden) .tradeStarter.apartmentTradeNav'],
  ['office','.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'],
  ['trade-types','.page:not(.hidden) .tradeTypeBar'],
  ['new-types','.page:not(.hidden) .newTypeChips'],
  ['news','.page:not(.hidden) .newsCategoryTabs']
 ];
 const combined=GROUPS.map(g=>g[1]).join(',');
 const stats={started:0,finished:0,skipped:0};
 let cleanup=null,sequence=0;
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const buttons=g=>g?Array.from(g.children).filter(x=>x.tagName==='BUTTON'):[];
 const chosen=b=>!!b&&(b.classList.contains('active')||
  b.classList.contains('selected')||b.getAttribute('aria-current')==='page'||
  b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true');
 function paint(b){
  const s=window.getComputedStyle(b);
  const bg=s.backgroundImage&&s.backgroundImage!=='none'?s.backgroundImage:s.backgroundColor;
  const backgroundColor=s.backgroundColor||'';
  const tint=backgroundColor&&!/^(?:transparent|rgba\(0,\s*0,\s*0,\s*0\))$/.test(backgroundColor)?
   backgroundColor:(bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/)||['#1A6870'])[0];
  return {background:bg,color:s.color,borderRadius:s.borderRadius,tint};
 }
 const onScreen=r=>r&&r.width>0&&r.height>0&&
   r.bottom>0&&r.top<window.innerHeight&&r.right>0&&r.left<window.innerWidth;
 function restoreLater(el,changes,saved){
  const style=el.style;
  for(const [name,value,priority] of changes){
   saved.push([style,name,style.getPropertyValue(name),style.getPropertyPriority(name)]);
   style.setProperty(name,value,priority||'');
  }
 }
 function resetRecords(saved){
  for(let i=saved.length-1;i>=0;i--){
   const [style,name,value,priority]=saved[i];
   if(value)style.setProperty(name,value,priority);
   else style.removeProperty(name);
  }
 }
 function stop(){
  if(!cleanup)return;
  const finish=cleanup;cleanup=null;finish();
 }
 function panel(parent,klass,x,y,width,height,background,radius,z){
  const el=document.createElement('span');
  el.className=klass;
  el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{
   position:'absolute',left:x+'px',top:y+'px',width:width+'px',height:height+'px',
   boxSizing:'border-box',borderRadius:radius,background,
   zIndex:String(z),pointerEvents:'none',willChange:'transform,opacity'
  });
  parent.appendChild(el);
  return el;
 }
 function frame(el,steps){
  if(typeof el.animate!=='function')return null;
  return el.animate(steps,{duration:DURATION,easing:EASE,fill:'both'});
 }
 function flow(group,sourceIndex,targetIndex,oldSelection,oldTarget){
  if(reduced()||typeof group.animate!=='function'){stats.skipped++;return;}
  const peers=buttons(group),source=peers[sourceIndex],target=peers[targetIndex];
  if(!source||!target||source===target||!chosen(target)){stats.skipped++;return;}
  const g=group.getBoundingClientRect(),a=source.getBoundingClientRect(),
   b=target.getBoundingClientRect();
  if(!onScreen(a)||!onScreen(b)){stats.skipped++;return;}
  const dx=(b.left+b.width/2)-(a.left+a.width/2);
  const dy=(b.top+b.height/2)-(a.top+a.height/2);
  if(Math.abs(dx)>window.innerWidth*1.12||Math.abs(dy)>window.innerHeight*.55){
   stats.skipped++;return;
  }
  const afterSource=paint(source),afterTarget=paint(target);
  // Both screens already have the correct states. Only the selected color
  // is masked temporarily; the actual content, layout and fonts are untouched.
  const all=peers.map(b=>({button:b,rect:b.getBoundingClientRect(),ink:paint(b)}));
  const origin={x:a.left-g.left+group.scrollLeft,
   y:a.top-g.top+group.scrollTop,w:a.width,h:a.height};
  const dest={x:b.left-g.left+group.scrollLeft,
   y:b.top-g.top+group.scrollTop,w:b.width,h:b.height};
  const saved=[],nodes=[],animations=[];
  const done=()=>{
   animations.forEach(anim=>{try{anim.cancel()}catch(e){}});
   // At completion the real button background already owns the final color.
   resetRecords(saved);nodes.forEach(node=>node.remove());
  };
  try {
   restoreLater(group,[['position','relative'],['isolation','isolate']],saved);
   // A quiet, real-sized idle surface beneath each button avoids color jumps.
   // Selected destination starts as its pre-click inactive surface.
   all.forEach(({button,rect,ink},idx)=>{
    const base=idx===targetIndex?oldTarget.background:ink.background;
    const p=panel(group,'fhd-liquid-base',
     rect.left-g.left+group.scrollLeft,
     rect.top-g.top+group.scrollTop,
     rect.width,rect.height,base,ink.borderRadius,0);
    nodes.push(p);
    restoreLater(button,[
     ['position','relative'],['z-index','2'],['background','transparent','important'],
     ['transition','none','important']
    ],saved);
   });
   const slug=panel(group,'fhd-liquid-color',
    origin.x,origin.y,origin.w,origin.h,'transparent',oldSelection.borderRadius,1);
   const outgoing=panel(slug,'fhd-liquid-outgoing',0,0,origin.w,origin.h,
    oldSelection.background,'inherit',0);
   const arriving=panel(slug,'fhd-liquid-arriving',0,0,origin.w,origin.h,
    afterTarget.background,'inherit',1);
   arriving.style.opacity='0';
   slug.style.overflow='hidden';
   nodes.push(slug);
   // A light, narrow ribbon makes the pigment appear continuous in the gap.
   // It has no text, no outline and does not affect surrounding layout.
   const length=Math.hypot(dx,dy);
   const trail=panel(group,'fhd-liquid-trail',
    origin.x+origin.w/2,origin.y+origin.h/2,
    length,Math.max(11,Math.min(21,origin.h*.21)),
    'linear-gradient(90deg,'+oldSelection.tint+','+afterTarget.tint+')',
    '999px',1);
   trail.style.transform='translateY(-50%) rotate('+Math.atan2(dy,dx)+'rad)';
   trail.style.transformOrigin='left center';
   trail.style.filter='blur(6px)';
   trail.style.opacity='0';
   nodes.push(trail);
   // Travel is a rounded, narrowing stream, not a moving button/card.
   const sx=dest.w/origin.w,sy=dest.h/origin.h;
   const anim=frame(slug,[
    {transform:'translate3d(0,0,0) scale(1,1)',borderRadius:oldSelection.borderRadius,offset:0},
    {transform:'translate3d('+(dx*.16)+'px,'+(dy*.16)+'px,0) scale(.78,.70)',
      borderRadius:'42%',offset:.23},
    {transform:'translate3d('+(dx*.51)+'px,'+(dy*.51)+'px,0) scale(.47,.24)',
      borderRadius:'48%',offset:.49},
    {transform:'translate3d('+(dx*.83)+'px,'+(dy*.83)+'px,0) scale('+(sx*.83)+','+(sy*.72)+')',
      borderRadius:'36%',offset:.76},
    {transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+sx+','+sy+')',
      borderRadius:afterTarget.borderRadius,offset:1}
   ]);
   if(!anim)throw new Error('No Web Animations support');
   animations.push(anim);
   animations.push(frame(arriving,[
    {opacity:0,offset:0},{opacity:0,offset:.23},
    {opacity:.50,offset:.58},{opacity:1,offset:.91}
   ]));
   animations.push(frame(trail,[
    {opacity:0,clipPath:'inset(0 100% 0 0)',offset:0},
    {opacity:.24,clipPath:'inset(0 58% 0 0)',offset:.27},
    {opacity:.29,clipPath:'inset(0 4% 0 22%)',offset:.53},
    {opacity:0,clipPath:'inset(0 0 0 100%)',offset:.92},
    {opacity:0,clipPath:'inset(0 0 0 100%)',offset:1}
   ]));
   // Letterforms stay pixel-stable; only their paint color eases in.
   const startColor=oldSelection.color,endSource=afterSource.color;
   const endTarget=afterTarget.color,startTarget=oldTarget.color;
   if(source.animate)animations.push(source.animate([
    {color:startColor,offset:0},{color:startColor,offset:.12},
    {color:endSource,offset:.52},{color:endSource,offset:1}
   ],{duration:DURATION,easing:EASE}));
   if(target.animate)animations.push(target.animate([
    {color:startTarget,offset:0},{color:startTarget,offset:.38},
    {color:endTarget,offset:.77},{color:endTarget,offset:1}
   ],{duration:DURATION,easing:EASE}));
   let finished=false;
   const settle=()=>{
    if(finished)return;
    finished=true;
    if(cleanup===stopThis)cleanup=null;
    done();stats.finished++;
   };
   function stopThis(){finished=true;done();}
   cleanup=stopThis;
   anim.addEventListener('finish',settle,{once:true});
   anim.addEventListener('cancel',settle,{once:true});
   stats.started++;
  }catch(e){
   done();stats.skipped++;
  }
 }
 function click(e){
  if(reduced()||e.defaultPrevented)return;
  const button=e.target?.closest?.('button');
  if(!button||button.disabled||button.closest('.hidden'))return;
  const group=button.closest(combined);
  if(!group||button.parentElement!==group)return;
  const entry=GROUPS.find(x=>group.matches(x[1]));
  if(!entry)return;
  stop();
  const children=buttons(group),index=children.indexOf(button);
  const oldIndex=children.findIndex(chosen);
  if(index<0||oldIndex<0||index===oldIndex)return;
  const oldSelection=paint(children[oldIndex]),oldTarget=paint(button);
  const id=++sequence;
  // Click capture reads OLD colors. Onclick handlers replace selected markup.
  // The next animation frame observes the NEW group; no font/element clone.
  const start=()=>{
   if(id!==sequence||reduced())return;
   const fresh=document.querySelector(entry[1]);
   if(fresh)flow(fresh,oldIndex,index,oldSelection,oldTarget);
  };
  if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(start);
  else window.setTimeout?.(start,0);
 }
 const css=document.createElement('style');
 css.textContent=[
  '.fhd-liquid-base,.fhd-liquid-color,.fhd-liquid-trail{pointer-events:none!important}',
  '.fhd-liquid-color{transform-origin:center center;contain:paint}',
  '.fhd-liquid-outgoing,.fhd-liquid-arriving{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important}',
  '@media(prefers-reduced-motion:reduce){.fhd-liquid-base,.fhd-liquid-color,.fhd-liquid-trail{display:none!important}}'
 ].join('');
 document.head.appendChild(css);
 document.addEventListener('click',click,{capture:true});
 window.FirstHyundaiSelectionFlow={version:'3.0.0',
  _test:{buttons,chosen,paint,stop,click,reduced,stats}};
})();
