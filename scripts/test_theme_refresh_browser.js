'use strict';
/* v2.2.2 — refreshed 기본·봄·여름·가을·겨울 themes.
   Static: safe scene art, appearance-only CSS, business colours untouched, no motion.
   Browser: every theme shows its own scene in the header, header/menu geometry is the
   same in all five themes, and high contrast falls back to the plain header. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const read=f=>fs.readFileSync(path.join(assets,f),'utf8');
const html=read('index.html'),css=read('theme-refresh.css');
const THEMES=['default','spring','summer','autumn','winter'];
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
assert(links.indexOf('theme-refresh.css')>links.indexOf('season-themes.css'),'Refresh loads after season themes');
assert(links.indexOf('theme-refresh.css')<links.indexOf('ui-consistency.css'),'Consistency/motion rules still win');
for(const t of THEMES){
 const svg=read('theme-scene-'+t+'.svg');
 assert(svg.startsWith('<svg')&&svg.includes('viewBox="0 0 360 64"')&&svg.includes('aria-hidden="true"'),t+' scene format');
 assert(!/<script|href=|xlink:|<image|on[a-z]+=/i.test(svg),t+' scene has no scripts, links or embedded images');
 assert(svg.length<12000,t+' scene stays tiny');
 assert(css.includes('theme-scene-'+t+'.svg'),t+' scene referenced');
}
const code=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/animation|transition|filter\s*:|will-change/.test(code),'Static appearance only (no motion added)');
for(const block of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
 const selector=block[1].trim(),rules=block[2];
 if(selector.includes('.seasonParticle'))continue; // decoration inside the inert layer
 assert(!/(?:^|;)\s*(?:font-size|width|height|padding|margin|display|position|order|gap|grid|transform)\b/.test(rules),
  'Appearance only: '+selector.slice(0,70));
 assert(!/\.btn|dealType|tradeType|\.active|\.selected|contractOneTap|officeBoardPost/.test(selector),
  'Business/selection colours untouched: '+selector.slice(0,70));
}
assert(code.includes('body[data-app-contrast="high"][data-season-theme] header'),'High contrast keeps a plain header');

async function verify(){
 const out=document.createElement('pre');out.id='theme-refresh-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const base={themeMode:'manual',weatherEffect:'none',motion:'full',themeIntensity:'balanced',themeDecor:'full',
   themeHeader:'on',themeIntro:'on',themeLogo:'on',themeCaption:'on'};
  switchPage('trades');await wait(200);
  const shape=()=>{const h=document.querySelector('header').getBoundingClientRect(),n=document.getElementById('nav').getBoundingClientRect(),
   t=document.querySelector('#trades .sectionTitle').getBoundingClientRect();
   return [h.height,n.top,n.height,t.top].map(v=>Math.round(v)).join(',')};
  let first='';
  for(const theme of ['default','spring','summer','autumn','winter']){
   FirstHyundaiThemes.configure({...base,theme});await wait(80);
   const header=getComputedStyle(document.querySelector('header'));
   check(header.backgroundImage.includes('theme-scene-'+theme+'.svg'),theme+': header scene missing');
   const g=shape();if(!first)first=g;
   check(g===first,theme+': header/menu geometry changed '+g+' vs '+first);
   const bodyBg=getComputedStyle(document.body).backgroundImage;
   check(bodyBg.includes('gradient'),theme+': page wash missing');
  }
  FirstHyundaiThemes.configure({...base,theme:'autumn',themeHeader:'off'});await wait(60);
  check(getComputedStyle(document.querySelector('header')).backgroundImage.includes('theme-scene-autumn.svg'),'Header off keeps the scene on the base colours');
  document.body.setAttribute('data-app-contrast','high');
  check(!getComputedStyle(document.querySelector('header')).backgroundImage.includes('theme-scene'),'High contrast: plain header');
  document.body.removeAttribute('data-app-contrast');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS five scenes, unchanged geometry, page washes, high-contrast fallback';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-theme-refresh-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360,412]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="theme-refresh-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
