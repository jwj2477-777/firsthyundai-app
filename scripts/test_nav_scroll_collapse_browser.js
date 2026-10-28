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
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const nav=document.getElementById('nav'),api=window.FirstHyundaiNavCollapse;
  const buttons=()=>[...nav.querySelectorAll('.primaryNav>button,.utilityNav>button:not(.adminCenterNav)')];
  const metrics=()=>buttons().map(b=>({
   height:b.getBoundingClientRect().height,
   icon:b.querySelector('.navIcon svg').getBoundingClientRect().height,
   font:parseFloat(getComputedStyle(b.querySelector('.navLabel')).fontSize),
   onclick:b.getAttribute('onclick'),
   label:b.innerText,
   active:b.getAttribute('aria-current')
  }));
  check(api&&api.range===210,'Scroll control must map continuously over 210px');
  check(buttons().length===6,'Six buttons are required');
  check(getComputedStyle(nav).position==='sticky','Menu remains reachable while scrolling');
  check(getComputedStyle(document.scrollingElement).overflowAnchor==='none',
   'Native scroll anchoring must not fight menu height changes');
  check(getComputedStyle(nav).transitionDuration==='0s',
   'Scroll-linked geometry must not have a second timed CSS easing');
  const filler=document.createElement('div');
  filler.style.height='2600px';document.querySelector('main').appendChild(filler);
  window.scrollTo(0,0);api.update(true);
  const beginning=metrics();
  check(beginning.every(x=>x.height>=89.8&&x.height<=90.2),
   'Original six large button sizes are preserved');
  const signatures=beginning.map(({onclick,label,active})=>({onclick,label,active}));
  const initialTileStyles=buttons().map(tile=>tile.getAttribute('style'));
  check(api.progress(0)===0&&api.progress(210)===1&&api.progress(105)===.5,
   'Keep exact top, midpoint and compact heights');
  check(api.progress(21)>0&&api.progress(21)<.1&&api.progress(189)>.9&&api.progress(189)<1,
   'Gentle easing must soften only the beginning and end of the proportional drag');
  const heights=[];
  for(const offset of [0,21,42,63,84,105,126,147,168,189,210]){
   window.scrollTo(0,offset);
   api.update();
   const fraction=api.progress(offset);
   const m=metrics();
   const expected=90-42*fraction;
   check(m.every(x=>Math.abs(x.height-expected)<1),
    'Menu does not follow proportional scroll at '+offset+'px: '+JSON.stringify(m));
   check(m.every(x=>Math.abs(x.height-m[0].height)<.3),
    'Top/bottom row heights differ at '+offset+'px');
   check(m.every(x=>Math.abs(x.icon-m[0].icon)<.3&&Math.abs(x.font-m[0].font)<.15),
    'Top/bottom SVG or font sizes differ at '+offset+'px: '+JSON.stringify(m));
   check(Math.abs(window.scrollY-offset)<2,
    'Menu reflow changed scroll position; feedback detected at '+offset+'px: '+scrollY);
   heights.push(m[0].height);
  }
  check(buttons().every((tile,i)=>tile.getAttribute('style')===initialTileStyles[i]),
   'Scroll frames must never rewrite six separate inline height constraints');
  check(heights.every((height,i)=>i===0||height<heights[i-1]-2),
   'There must be no sudden threshold jump, stall or reversed scaling: '+heights.join(','));
  check(Math.abs(heights[5]-69)<1,'Half scroll must yield half height (~69px), not an all-at-once switch');
  const compact=metrics();
  check(compact.every(x=>x.height>=47.95&&x.height<=48.15),'Minimum 48px touch target: '+JSON.stringify(compact));
  check(compact.every(x=>x.icon>=16&&x.icon<=18.5&&x.font>=11.5&&x.font<=12.5),
   'All six labels/icons must be equally compact and legible');
  check(Math.abs(nav.getBoundingClientRect().top)<=1.6,'Compact dock remains sticky');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow at compact size');
  check(compact.every((x,i)=>JSON.stringify({onclick:x.onclick,label:x.label,active:x.active})===JSON.stringify(signatures[i])),
   'Button actions and selected state must remain unchanged');
  // No additional DOM changes or layout rebinds when scroll remains steady.
  const stableStyles=buttons().map(tile=>tile.getAttribute('style'));
  // Feedback test: unchanged scroll offset must not change sizes on repeated calls.
  for(let t=0;t<10;t++)api.update();
  check(metrics().every(x=>Math.abs(x.height-48)<.15),
   'Repeated scroll callbacks cause height oscillation');
  check(buttons().every((tile,i)=>tile.getAttribute('style')===stableStyles[i]),
   'Repeated scroll callbacks do not restart tile layout changes');
  renderMainNavigation(currentPage);
  check(buttons().length===6&&metrics().every(x=>Math.abs(x.height-48)<.15),
   'Re-render retains correct compact dimensions without jumping');
  // Returning up must restore continuously, not cross a single threshold.
  const returning=[];
  for(const offset of [189,168,147,126,105,84,63,42,21,0]){
   window.scrollTo(0,offset);api.update();
   const m=metrics(),expected=90-42*api.progress(offset);
   check(m.every(x=>Math.abs(x.height-expected)<1),
    'Menu expands disproportionately during return at '+offset);
   returning.push(m[0].height);
  }
  check(returning.every((height,i)=>i===0||height>returning[i-1]+2),
   'Returning should expand gradually rather than abruptly: '+returning.join(','));
  check(nav.dataset.navDensity==='full','Top position restores original full size');
  const match=window.matchMedia;
  window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:match(q);
  window.scrollTo(0,105);api.update();
  check(metrics().every(x=>Math.abs(x.height-48)<.2),'Reduced motion permits instant compact state');
  window.matchMedia=match;
  document.body.innerHTML='<pre id="nav-collapse-browser">PASS subtle eased 11-step proportional drag, zero repeated tile rewrites, six synchronized icons/labels, 48px touch areas</pre>';
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
