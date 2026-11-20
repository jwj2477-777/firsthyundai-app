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
const SCENES=[...THEMES,'newyear','christmas','night'];
const vm=require('node:vm');
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
assert(links.indexOf('theme-refresh.css')>links.indexOf('season-themes.css'),'Refresh loads after season themes');
assert(links.indexOf('theme-refresh.css')<links.indexOf('ui-consistency.css'),'Consistency/motion rules still win');
for(const t of SCENES){
 const svg=read('theme-scene-'+t+'.svg');
 assert(svg.startsWith('<svg')&&svg.includes('viewBox="0 0 360 64"')&&svg.includes('aria-hidden="true"'),t+' scene format');
 assert(!/<script|href=|xlink:|<image|on[a-z]+=/i.test(svg),t+' scene has no scripts, links or embedded images');
 assert(svg.length<12000,t+' scene stays tiny');
 assert(css.includes('theme-scene-'+t+'.svg'),t+' scene referenced');
}
// The committed art is exactly what the generator draws (one shared skyline → overlays line up).
const gen=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-scenes-'));
try{
 const run=child.spawnSync('python3',[path.resolve(__dirname,'generate_theme_scenes.py'),gen],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 for(const t of SCENES)assert.equal(fs.readFileSync(path.join(gen,'theme-scene-'+t+'.svg'),'utf8'),read('theme-scene-'+t+'.svg'),t+' scene differs from generator');
}finally{fs.rmSync(gen,{recursive:true,force:true})}
// 24 절기 on Korean calendar days (official 2026–27 dates) and the two fixed occasions.
{
 const body={setAttribute(){},style:{setProperty(){}},appendChild(){},children:[]};
 const ctx={document:{body,hidden:true,createElement:()=>({setAttribute(){},replaceChildren(){},appendChild(){},style:{setProperty(){}}}),
  getElementById:()=>null,addEventListener(){}},window:{addEventListener(){},setInterval(){}},
  localStorage:{getItem(){},setItem(){}},setTimeout,clearTimeout,Date,AbortController};
 vm.createContext(ctx);vm.runInContext(read('season-themes.js'),ctx);
 const api=ctx.window.FirstHyundaiThemes,at=d=>Date.parse(d+'T12:00:00+09:00');
 for(const [d,name,today] of [['2026-11-07','입동',true],['2026-11-20','입동',false],['2026-11-22','소설',true],
  ['2026-12-22','동지',true],['2027-01-05','소한',true],['2027-02-04','입춘',true],['2027-03-21','춘분',true],['2027-06-21','하지',true]]){
  const term=api.solarTerm(at(d));assert.equal(term.name,name,d);assert.equal(term.today,today,d+' today');
 }
 assert.equal(api.occasion(at('2027-01-01')),'newyear');assert.equal(api.occasion(at('2027-01-04')),'');
 assert.equal(api.occasion(at('2026-12-24')),'christmas');assert.equal(api.occasion(at('2026-12-26')),'');
}
const code=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/animation|transition|filter\s*:|will-change/.test(code),'Static appearance only (no motion added)');
for(const block of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
 const selector=block[1].trim(),rules=block[2];
 if(selector.includes('.seasonParticle')||selector.includes('.overviewTermChip'))continue; // inert decoration / the new 절기 chip
 assert(!/(?:^|;)\s*(?:font-size|width|height|padding|margin|display|position|order|gap|grid|transform)\b/.test(rules),
  'Appearance only: '+selector.slice(0,70));
 assert(!/\.btn|dealType|tradeType|\.active|\.selected|contractOneTap|officeBoardPost/.test(selector),
  'Business/selection colours untouched: '+selector.slice(0,70));
}
assert(code.includes('body[data-app-contrast="high"][data-season-theme]{--theme-rain-layer:var(--theme-none)'),'High contrast drops rain streaks');

async function verify(){
 const out=document.createElement('pre');out.id='theme-refresh-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const base={themeMode:'manual',weatherEffect:'none',motion:'full',themeIntensity:'balanced',themeDecor:'full',
   themeHeader:'on',themeIntro:'on',themeLogo:'on',themeCaption:'on'};
  switchPage('trades');await wait(200);
  // Some CI browsers report a system high-contrast preference; check the themed look explicitly.
  const contrastBefore=document.body.getAttribute('data-app-contrast');
  document.body.setAttribute('data-app-contrast','standard');
  const shape=()=>{const h=document.querySelector('header').getBoundingClientRect(),n=document.getElementById('nav').getBoundingClientRect(),
   t=document.querySelector('#trades .sectionTitle').getBoundingClientRect();
   return [h.height,n.top,n.height,t.top].map(v=>Math.round(v)).join(',')};
  let first='';
  for(const theme of ['default','spring','summer','autumn','winter']){
   FirstHyundaiThemes.configure({...base,theme});await wait(80);
   const header=getComputedStyle(document.querySelector('header'));
   check(header.backgroundImage.includes('theme-scene-'+theme+'.svg'),theme+': header scene missing · '+
    header.backgroundImage.slice(0,160)+' · attrs '+['data-season-theme','data-theme-header','data-theme-time','data-theme-occasion','data-app-contrast']
     .map(k=>k.replace('data-','')+'='+document.body.getAttribute(k)).join(' ')+' · '+navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]);
   const g=shape();if(!first)first=g;
   check(g===first,theme+': header/menu geometry changed '+g+' vs '+first);
   const bodyBg=getComputedStyle(document.body).backgroundImage;
   check(bodyBg.includes('gradient'),theme+': page wash missing');
  }
  // Hour, rain and occasion layers (attributes normally set by the theme clock).
  FirstHyundaiThemes.configure({...base,theme:'winter'});await wait(40);
  const hdr=()=>getComputedStyle(document.querySelector('header')).backgroundImage;
  document.body.setAttribute('data-theme-time','night');check(hdr().includes('theme-scene-night.svg'),'Night: lit windows');
  document.body.setAttribute('data-weather-effect','rain');check(hdr().includes('repeating-linear-gradient'),'Rain: fine streaks');
  document.body.setAttribute('data-theme-occasion','christmas');check(hdr().includes('theme-scene-christmas.svg')&&!hdr().includes('theme-scene-winter.svg'),'Christmas replaces the winter motif');
  document.body.setAttribute('data-theme-occasion','newyear');check(hdr().includes('theme-scene-newyear.svg'),'New Year sunrise');
  check(shape()===first,'Layers never change geometry');
  switchPage('overview');window.FirstHyundaiWeatherBriefing?.render?.();await wait(60);
  const chip=document.querySelector('#overviewWeatherDate .overviewTermChip');
  check(chip&&/^(오늘 )?(입춘|우수|경칩|춘분|청명|곡우|입하|소만|망종|하지|소서|대서|입추|처서|백로|추분|한로|상강|입동|소설|대설|동지|소한|대한)$/.test(chip.textContent),'절기 beside the date');
  check((document.querySelectorAll('#overviewWeatherDate .overviewTermChip').length)===1,'One 절기 chip, never duplicated');
  switchPage('trades');await wait(40);
  FirstHyundaiThemes.configure({...base,theme:'autumn',themeHeader:'off'});await wait(60);
  check(getComputedStyle(document.querySelector('header')).backgroundImage.includes('theme-scene-autumn.svg'),'Header off keeps the scene on the base colours');
  document.body.setAttribute('data-app-contrast','high');
  FirstHyundaiThemes.configure({...base,theme:'autumn',weatherEffect:'rain'});await wait(40);
  document.body.setAttribute('data-app-contrast','high');
  const hc=getComputedStyle(document.querySelector('header')).backgroundImage;
  check(hc.includes('theme-scene-autumn.svg')&&!hc.includes('repeating-linear-gradient'),'High contrast: scene kept, rain streaks removed');
  if(contrastBefore===null)document.body.removeAttribute('data-app-contrast');else document.body.setAttribute('data-app-contrast',contrastBefore);
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS five scenes, hour/rain/occasion layers, 절기 chip, unchanged geometry, high-contrast streak removal';
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
  // Own profile: file:// localStorage from other browser tests must not leak in (e.g. high contrast).
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--user-data-dir='+path.join(tmp,'profile-'+width),'--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="theme-refresh-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
