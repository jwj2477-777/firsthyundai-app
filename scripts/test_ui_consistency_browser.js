'use strict';
/* v2.1.97 — same-level controls must look the same (60s parents first).
   Real-browser check: opaque sticky menu, one icon style, page-colour selections,
   equal voice/Live pair, no orphan detail tab and an even footer tool row. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const css=fs.readFileSync(path.join(assets,'ui-consistency.css'),'utf8');
const icons=fs.readFileSync(path.join(assets,'ui-icons.js'),'utf8');

// Static guards: loaded last, reversible, and never shrinking touch targets.
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
assert.equal(links.at(-2),'ui-consistency.css','Consistency sheet must load after every other look sheet');
assert.equal(links.at(-1),'ui-motion.css','Only the motion sheet may load after it');
assert(html.includes('<script src="ui-icons.js"></script>'),'Line icons module is loaded');
assert(html.includes('.complexTabBar button:last-child:nth-child(odd){grid-column:1/-1}'),'Only an odd last tab may span');
assert(!/#nav\.tabs\{background:[^}]*#[0-9A-Fa-f]{8}/.test(css),'Sticky menu surface must be opaque');
for(const m of css.matchAll(/min-height:(\d+)px/g))assert(Number(m[1])>=38,'No control below 38px: '+m[0]);
const glyphs=[...icons.matchAll(/'(.)':'([A-Za-z]+)'/gu)].map(m=>m[2].replace(/Fill$/,''));
assert(glyphs.length>=15,'Glyph map present');
for(const name of glyphs)assert(new RegExp('\\b'+name+":'<").test(icons),'Missing SVG for '+name);
assert(/CONTENT=/.test(icons)&&icons.includes('.officeBoardText')&&icons.includes('.overviewMemoEntry'),
 'User-written memo text must be excluded from icon swapping');

async function verify(){
 const out=document.createElement('pre');
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const lead=/^\s*(✎|▤|▦|▧|🎙|📌|⚙|◷|★|☆|✦|↻|＋|🔔|⌂|⌁|↶)/u;
  const alpha=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return 1;const p=m[1].split(',');return p.length>3?Number(p[3]):1};
  for(const page of ['trades','complexes','news','overview','contracts','officeBoard']){
   switchPage(page);await wait(150);
   const nav=getComputedStyle(document.getElementById('nav'));
   const stops=[...nav.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m=>m[0]);
   check(stops.length&&stops.every(c=>alpha(c)===1),'Menu surface translucent on '+page+': '+stops.join(' '));
   const accents=[...document.querySelectorAll('#nav button:not(.active):not(.adminCenterNav) .navGlyphAccent')]
    .map(e=>getComputedStyle(e).stroke);
   check(accents.length>=5&&new Set(accents).size===1,'Menu icon accents differ: '+[...new Set(accents)].join(' '));
   const left=[...document.querySelectorAll('button,summary,label,h2,h3')]
    .filter(e=>e.getClientRects().length&&lead.test(e.textContent)&&!e.closest('.overviewMemoEntry,.officeBoardText'));
   check(!left.length,'Old glyph icon still shown on '+page+': '+left.map(e=>e.textContent.trim().slice(0,20)).join(' | '));
  }
  switchPage('trades');await wait(120);
  const seg=document.querySelector('#trades .propertyTypeSwitch>button.selected');
  const tile=document.querySelector('#nav .primaryNav>button.active');
  check(seg&&getComputedStyle(seg).backgroundColor==='rgb(40, 97, 139)','Trades segment must use the trades page colour');
  check(tile,'Trades menu tile selected');
  switchPage('contracts');await wait(120);
  const pair=[...document.querySelectorAll('#contracts .contractInputModes>.btn')].map(b=>b.getBoundingClientRect());
  check(pair.length===2,'Voice and Live are one pair');
  check(Math.abs(pair[0].width-pair[1].width)<1&&Math.abs(pair[0].height-pair[1].height)<1&&Math.abs(pair[0].y-pair[1].y)<1,
   'Voice and Live buttons must be equal and aligned');
  check(pair.every(r=>r.height>=60),'Voice/Live keep a large touch target');
  const calc=document.querySelector('#contracts .fhcContractEntry').getBoundingClientRect();
  check(Math.abs(calc.height-49)<1,'Calculator header button matches the 49px refresh button');
  const step=getComputedStyle(document.querySelector('#contracts .contractFlowStep.is-current'));
  check(step.borderTopColor==='rgb(161, 87, 56)','Current contract step uses the contract page colour');
  switchPage('officeBoard');await wait(120);
  const post=getComputedStyle(document.getElementById('officeBoardPost'));
  check(post.backgroundColor==='rgb(34, 90, 101)','Main "continue" action is the shared deep teal');
  const tools=[...document.querySelectorAll('.compactAppFooter .appFooterDisplayRow>button')].map(b=>b.getBoundingClientRect());
  check(tools.length===2&&Math.abs(tools[0].width-tools[1].width)<1&&Math.abs(tools[0].height-tools[1].height)<1,
   'Footer tool buttons must be equal halves');
  check(tools.every(r=>r.height>=44),'Footer tools keep 44px targets');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow');
  out.id='ui-consistency-test';out.textContent='PASS opaque menu, one icon style, page colours, equal pairs';
 }catch(e){out.id='ui-consistency-test';out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser']
  .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'A Chrome binary is required for the consistency check');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-ui-consistency-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360,412]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=19000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-800));
  const found=r.stdout.match(/<pre id="ui-consistency-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-500));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
