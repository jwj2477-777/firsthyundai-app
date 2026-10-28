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
  const selectors='#nav .primaryNav>button,#nav .utilityNav>button:not(.adminCenterNav)';
  const nav=document.getElementById('nav'),api=window.FirstHyundaiNavCollapse;
  const tiles=()=>[...document.querySelectorAll(selectors)];
  check(api&&typeof api.update==='function','Scroll controller not initialized');
  check(tiles().length===6,'Six original menu destinations are required');
  check(getComputedStyle(nav).position==='sticky','Menu should remain reachable as content scrolls');
  const extra=document.createElement('div');
  extra.style.height='2500px';
  document.querySelector('main').appendChild(extra);
  await new Promise(resolve=>setTimeout(resolve,35));
  window.scrollTo(0,0);api.update();
  const buttons=tiles();
  const before=buttons.map(x=>({label:x.innerText,action:x.getAttribute('onclick'),
   selected:x.getAttribute('aria-current'),b:x.getBoundingClientRect()}));
  const original=buttons[0].getBoundingClientRect().height;
  const iconOriginal=buttons[0].querySelector('.navIcon svg').getBoundingClientRect().height;
  check(original>=80&&original<=95,'Full-size menu retains existing 80-95px visual shape');
  check(nav.dataset.navDensity==='full','Top of page must preserve original full-size dock');
  check(buttons.every((b,i)=>Math.abs(b.getBoundingClientRect().height-original)<.4),
   'Every top menu button should share one height');
  check(buttons.slice(0,3).every(b=>Math.abs(b.getBoundingClientRect().top-before[0].b.top)<.5),
   'Three upper-row buttons remain aligned');
  check(buttons.slice(3).every(b=>Math.abs(b.getBoundingClientRect().top-before[3].b.top)<.5),
   'Three lower-row buttons remain aligned');
  window.scrollTo(0,85);api.update();
  const middle=buttons[0].getBoundingClientRect().height;
  check(middle<original-3,'Partial swipe must begin shrinking smoothly');
  check(middle>60,'Partial swipe must not jump to its smallest height');
  check(nav.dataset.navDensity==='transitioning','Middle scroll must use a continuous density value');
  window.scrollTo(0,250);api.update();
  const compact=tiles(),compressed=compact[0].getBoundingClientRect().height;
  const iconCompact=compact[0].querySelector('.navIcon svg').getBoundingClientRect().height;
  check(nav.dataset.navDensity==='compact','Deep scrolling shows compact dock');
  check(compressed<=61&&compressed>=48,'Compact button remains at least 48px tap high');
  check(original-compressed>=24,'Compact dock saves meaningful vertical space');
  check(iconCompact<iconOriginal-5,'Navigation glyph scales down along with tile height');
  check(Math.abs(nav.getBoundingClientRect().top)<=1.5,'Sticky menu stays at viewport top');
  check(compact.every(b=>Math.abs(b.getBoundingClientRect().height-compressed)<.4),
   'All six buttons are equal height at compact density');
  check(compact.every((b,i)=>b.getAttribute('onclick')===before[i].action&&
   b.getAttribute('aria-current')===before[i].selected&&b.innerText===before[i].label),
   'Selection, icon/text content and original click routes are unchanged');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Compact state causes unwanted horizontal overflow');
  window.scrollTo(0,0);api.update();
  check(nav.dataset.navDensity==='full','Returning to top restores original 6 large buttons');
  check(Math.abs(buttons[0].getBoundingClientRect().height-original)<.4,
   'Top scroll restores button height reversibly');
  const normal=window.matchMedia;
  window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:normal(q);
  check(api.progress(85)===1&&api.progress(50)===0,
   'Reduced-motion mode switches directly, with no morph');
  window.matchMedia=normal;
  document.body.innerHTML='<pre id="nav-collapse-browser">PASS top normal → partial fluid → sticky compact → restored; six equal buttons and preserved actions</pre>';
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
