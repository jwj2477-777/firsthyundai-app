'use strict';
/* Real Android-WebView-like Chromium rendering of fluid scroll-linked six-tile dock. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chromium is required for actual scroll-density geometry checks');
async function verify(){
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(valid,msg)=>{if(!valid)throw Error(msg)};
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // Headless Chromium's --virtual-time-budget can advance JS timers without
  // advancing compositor frames. Finish transitions before checking terminal
  // geometry; we separately assert that easing was actually configured.
  const finishAnimations=()=>{
   for(const element of [nav,...nav.querySelectorAll('*')]){
    for(const animation of element.getAnimations?.()||[]){
     if(animation.playState==='running'||animation.playState==='pending')
      try{animation.finish()}catch(e){}
    }
   }
  };
  const nav=document.getElementById('nav'),controller=window.FirstHyundaiNavCollapse;
  const tiles=()=>[...document.querySelectorAll('#nav .primaryNav>button,#nav .utilityNav>button:not(.adminCenterNav)')];
  const icon=button=>button.querySelector('.navIcon svg').getBoundingClientRect();
  const font=button=>parseFloat(getComputedStyle(button.querySelector('.navLabel')).fontSize);
  check(controller&&typeof controller.update==='function','Scroll controller is unavailable');
  check(tiles().length===6,'All 6 original destinations must stay visible');
  check(getComputedStyle(nav).position==='sticky','Dock must remain sticky');
  const spacer=document.createElement('div');
  spacer.style.height='2500px';document.querySelector('main').appendChild(spacer);
  window.scrollTo(0,0);controller.update();
  await pause(30);
  const initial=tiles();
  const before=initial.map(button=>({
   label:button.innerText,action:button.getAttribute('onclick'),
   active:button.getAttribute('aria-current')
  }));
  const fullHeight=initial[0].getBoundingClientRect().height;
  const fullIcon=icon(initial[0]).height;
  check(fullHeight>=80&&fullHeight<=95,'Full-sized navigation must stay close to original: '+fullHeight);
  check(nav.dataset.navDensity==='full','At top menu is full size');
  check(initial.every(b=>Math.abs(b.getBoundingClientRect().height-fullHeight)<.3),
   'Both rows must start at exactly the same height');
  const transition=getComputedStyle(initial[0]).transitionDuration;
  check(transition.includes('0.32s'),'Tile resize must use a finite CSS easing, not instant frame-by-frame resizing: '+transition);

  // A normal small scroll must not repeatedly reflow button dimensions.
  window.scrollTo(0,85);controller.update();
  check(nav.dataset.navDensity==='full','Short scroll does not repeatedly resize the document');
  check(initial.every(b=>Math.abs(b.getBoundingClientRect().height-fullHeight)<.4),
   'Small scroll must not induce pixel-by-pixel layout jitter');

  // Trigger exactly one CSS transition. It must not bounce between states,
  // even if the browser adjusts scrollY while the dock reduces its height.
  window.scrollTo(0,185);controller.update();
  check(nav.dataset.navDensity==='compact','Scrolling past trigger starts smooth collapse');
  await pause(110);
  const halfway=tiles().map(b=>({height:b.getBoundingClientRect().height,
   icon:icon(b).height,font:font(b)}));
  check(halfway.every(x=>Math.abs(x.height-halfway[0].height)<.5),
   'All six tile heights animate in lockstep: '+JSON.stringify(halfway));
  check(halfway.every(x=>Math.abs(x.icon-halfway[0].icon)<.5&&
   Math.abs(x.font-halfway[0].font)<.2),
   'Both rows share the same easing during animation: '+JSON.stringify(halfway));
  for(let frame=0;frame<6;frame++){
   await pause(30);controller.update();
   check(nav.dataset.navDensity==='compact',
    'Scroll anchoring must not cause compact/full state oscillation: '+scrollY);
  }
  await pause(300);
  finishAnimations();
  const compact=tiles(),short=compact[0].getBoundingClientRect().height;
  const metrics=compact.map(b=>({
   height:b.getBoundingClientRect().height,
   width:icon(b).width,icon:icon(b).height,font:font(b)
  }));
  check(short>=47.95&&short<=48.1,'At rest all tiles must be 48px: '+JSON.stringify(metrics));
  check(metrics.every(m=>Math.abs(m.height-short)<.2&&
   Math.abs(m.icon-metrics[0].icon)<.3&&Math.abs(m.width-metrics[0].width)<.3&&
   Math.abs(m.font-metrics[0].font)<.15),
   'Six buttons, both rows, use identical compact size: '+JSON.stringify(metrics));
  check(metrics.every(m=>m.icon>=16&&m.icon<=18.5&&m.font>=11.5&&m.font<=12.5),
   'Compact graphics and labels are 17px and 12px: '+JSON.stringify(metrics));
  check(fullHeight-short>38&&fullIcon-metrics[0].icon>=10,
   'Compact reduces menu content footprint without losing touch size');
  check(Math.abs(nav.getBoundingClientRect().top)<1.6,'Dock must remain sticky when compressed');
  check(document.documentElement.scrollWidth<=innerWidth+1,
   'No sideways scrolling during collapsed state');
  check(compact.every((b,i)=>b.getAttribute('onclick')===before[i].action&&
   b.getAttribute('aria-current')===before[i].active&&b.innerText===before[i].label),
   'Selection styles and six original click routes remain intact');
  controller.update();controller.update();
  check(compact.every(b=>Math.abs(b.getBoundingClientRect().height-48)<.15),
   'Repeated scroll updates never restart a completed transition');
  // Re-render replaces elements; controller must only restore sizes once.
  renderMainNavigation(currentPage);
  finishAnimations(); // New DOM may start inherited CSS transitions in headless Chromium.
  check(tiles().length===6&&tiles().every(b=>Math.abs(b.getBoundingClientRect().height-48)<.2),
   'Newly rendered buttons preserve compact state without size mismatch');

  window.scrollTo(0,0);controller.update();
  check(nav.dataset.navDensity==='full','At top, the six original tiles return');
  await pause(450);
  finishAnimations();
  check(tiles().every(b=>Math.abs(b.getBoundingClientRect().height-fullHeight)<.3),
   'Full tile height restores smoothly after scrolling to top');
  const originalMatch=window.matchMedia;
  window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:originalMatch(q);
  window.scrollTo(0,190);controller.update();
  check(nav.classList.contains('fhdNavReduced'),'System reduced motion disables menu transitions');
  window.matchMedia=originalMatch;
  document.body.innerHTML='<pre id="nav-collapse-browser">PASS stable hysteresis, eased synchronized 6-button collapse/expand, 48px touch targets and reduced motion</pre>';
 }catch(e){document.body.innerHTML='<pre id="nav-collapse-browser">FAIL '+e.message+'</pre>'}
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-nav-collapse-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const filename=path.join(tmp,'index.html');fs.writeFileSync(filename,html);
 for(const width of [320,360,393,430]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=19000','--dump-dom','file://'+filename],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1200));
  const result=r.stdout.match(/<pre id="nav-collapse-browser">([\s\S]*?)<\/pre>/);
  assert(result,'Browser test did not execute: '+r.stdout.slice(-900));
  assert(result[1].startsWith('PASS'),width+'px '+result[1]);
  console.log(width+'px '+result[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
