'use strict';
/* v2.2.1 — light, smooth motion. Real browser checks:
   · press feedback is an instant shade only (no transform, no filter anywhere in motion),
   · a screen change is a short opacity fade (no movement, no stagger), sheets excluded,
   · dialogs ease in, long news lists skip off-screen layout,
   · Android "remove animations" (forced flag) and the app's 움직임 줄이기 turn it all off,
   · list rendering no longer rebuilds the catalog per row (speed guard). */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const css=fs.readFileSync(path.join(assets,'ui-motion.css'),'utf8');
const code=css.replace(/\/\*[\s\S]*?\*\//g,'');
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
assert.equal(links.at(-1),'ui-motion.css','Motion sheet loads last');
for(const block of code.matchAll(/([^{}]*:active[^{}]*)\{([^}]*)\}/g)){
 assert(!/transform\s*:|scale|translate|filter/.test(block[2]),'Press must not move, resize or filter: '+block[1].trim().slice(0,80));
}
assert(!/filter\s*:/.test(code),'No filter effects (extra layers/repaints)');
assert(!/animation-delay/.test(code),'No staggered delays');
const page=code.match(/@keyframes fhd-fade-in\{([^}]*\}[^}]*)\}/)?.[1]||'';
assert(page&&!/transform/.test(page),'Screen change is opacity only');
for(const m of code.matchAll(/(\d+)ms/g))assert(Number(m[1])<=180,'Keep motion short: '+m[0]);
assert(/@media\(prefers-reduced-motion:reduce\)/.test(code)&&code.includes('body[data-app-motion="reduced"]'),'Both reduce-motion switches respected');
assert(!/ripple|bounce/i.test(code),'No ripple or bounce');
// Speed guard: the catalog is cached and the name lookup is memoized.
assert(html.includes('function catalogBaseRows()')&&html.includes('catalogCache.complexes===remote.complexes'),'Catalog cached per download');
assert(html.includes('APT_NAME_CACHE')&&html.includes('catalogCache.byName'),'Name normalization/lookup memoized');

async function verify(){
 const out=document.createElement('pre');out.id='ui-motion-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const names=()=>document.getAnimations().map(a=>a.animationName);
  const osReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  switchPage('trades');await wait(400);
  switchPage('news');
  const fades=document.getAnimations().filter(a=>a.animationName==='fhd-fade-in');
  if(osReduced){
   check(!fades.length&&!names().includes('fhd-dialog-in'),'OS reduced motion: no screen fade');
  }else{
   check(fades.length>=2,'Screen content fades in');
   check(fades.every(a=>a.effect.getTiming().duration<=180&&!a.effect.getTiming().delay),'Short fade, no stagger');
   check(fades.some(a=>a.effect.target.classList.contains('sectionTitle')),'Title fades with the rest');
  }
  await wait(400);
  switchPage('complexes');
  check(!document.getAnimations().some(a=>a.effect?.target?.classList?.contains('apartmentSheet')),'Detail sheet keeps its own slide');
  await wait(400);
  const dialog=document.getElementById('deviceDisplayDialog');
  dialog.showModal();
  check(osReduced?!names().includes('fhd-dialog-in'):names().includes('fhd-dialog-in'),'Dialog motion follows the OS setting');
  dialog.close();
  // App setting: 움직임 줄이기
  document.body.setAttribute('data-app-motion','reduced');await wait(30);
  switchPage('trades');
  check(!names().includes('fhd-fade-in'),'App reduced motion: no screen fade');
  dialog.showModal();check(!names().includes('fhd-dialog-in'),'App reduced motion: dialog instant');dialog.close();
  document.body.setAttribute('data-app-motion','full');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS shade-only press, opacity-only screen fade, dialog ease, sheet slide, reduced motion'+(osReduced?' (OS reduce)':'');
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-ui-motion-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const [width,flags] of [[360,[]],[412,[]],[360,['--force-prefers-reduced-motion']]]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',...flags,
   '--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=20000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="ui-motion-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  if(flags.length)assert(found[1].includes('OS reduce'),'Forced OS reduced-motion was not detected');
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
