'use strict';
/* v2.2.0 — calm, consistent motion. Real browser checks:
   · press feedback is colour/shadow only (no transform in any :active rule),
   · page content fades up, newly chosen menu tile fills in, dialogs ease in,
   · detail sheets keep their own slide (never inside the page fade),
   · Android "remove animations" and the app's 움직임 줄이기 switch everything off. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const css=fs.readFileSync(path.join(assets,'ui-motion.css'),'utf8');
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
assert.equal(links.at(-1),'ui-motion.css','Motion sheet loads last');
for(const block of css.matchAll(/([^{}]*:active[^{}]*)\{([^}]*)\}/g)){
 assert(!/transform\s*:/.test(block[2])&&!/scale|translate/.test(block[2]),'Press must not move or resize: '+block[1].trim().slice(0,80));
}
for(const m of css.matchAll(/--m-(press|state|enter):(\d+)ms/g))assert(Number(m[2])<=240,'Keep motion short: '+m[0]);
assert(/@media\(prefers-reduced-motion:reduce\)/.test(css)&&css.includes('body[data-app-motion="reduced"]'),'Both reduce-motion switches respected');
assert(!/ripple|bounce/i.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'No ripple or bounce');

async function verify(){
 const out=document.createElement('pre');out.id='ui-motion-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const names=()=>document.getAnimations().map(a=>a.animationName);
  switchPage('trades');await wait(400);
  switchPage('news');
  const pageAnims=document.getAnimations().filter(a=>a.animationName==='fhd-page-in');
  check(pageAnims.length>=2,'Page content fades in');
  check(pageAnims.every(a=>a.effect.getTiming().duration<=240),'Short page fade');
  check(pageAnims.some(a=>a.effect.target.classList.contains('sectionTitle')),'Page title is part of the same fade');
  check(names().includes('fhd-select-fill'),'Newly chosen menu tile fills in');
  await wait(400);
  switchPage('complexes');
  check(!document.getAnimations().some(a=>a.animationName==='fhd-page-in'&&a.effect.target.classList.contains('apartmentSheet')),
   'Detail sheet keeps its own slide, never the page fade');
  const sheet=getComputedStyle(document.getElementById('complexSheet'));
  check(sheet.transitionDuration.split(',')[0].trim()==='0.28s','Sheet slide 280ms decelerating');
  await wait(400);
  const dialog=document.getElementById('deviceDisplayDialog');
  dialog.showModal();
  check(names().includes('fhd-dialog-in'),'Dialog eases in');
  dialog.close();
  const btn=document.querySelector('.compactAppFooter #appUpdateCheck');
  const t=getComputedStyle(btn);
  check(t.transitionProperty.includes('filter')&&t.transitionDuration.split(',').every(x=>x.trim()==='0.2s'),'One 200ms state transition');
  // App setting: 움직임 줄이기
  document.body.setAttribute('data-app-motion','reduced');
  await wait(50);
  switchPage('trades');
  check(!names().includes('fhd-page-in')&&!names().includes('fhd-select-fill'),'Reduced motion: no page or tile animation');
  check(getComputedStyle(btn).transitionDuration.split(',').every(x=>x.trim()==='0s'),'Reduced motion: instant states');
  dialog.showModal();check(!names().includes('fhd-dialog-in'),'Reduced motion: dialog appears instantly');dialog.close();
  document.body.setAttribute('data-app-motion','full');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS colour-only press, page fade, tile fill, dialog ease, sheet slide, reduced motion';
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
 for(const width of [360,412]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=20000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="ui-motion-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
