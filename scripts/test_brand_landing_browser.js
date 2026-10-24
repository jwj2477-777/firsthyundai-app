'use strict';
/* Actual bundled fonts, glyph baselines, narrow-screen behavior and end-driven reveal. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Real Chrome required for native/header landing validation');
async function checkLanding(){
 const checks=[];
 const check=(label,ok)=>{checks.push(label);if(!ok)throw Error(label)};
 try{
  await document.fonts.ready;
  const api=FirstHyundaiMotion,logo=document.querySelector('.officeMarkDisplay');
  const title=document.querySelector('.brandWordmark h1'),sub=document.querySelector('.brandSubtitle');
  check('same real bundled bold face loaded',document.fonts.check('700 30px "FHD Brand"'));
  check('same real bundled regular face loaded',document.fonts.check('400 11px "FHD Brand"'));
  check('title uses bundled family',getComputedStyle(title).fontFamily.includes('FHD Brand'));
  check('subtitle uses bundled family',getComputedStyle(sub).fontFamily.includes('FHD Brand'));
  check('same native vector palette is loaded',logo.complete&&logo.naturalWidth>0);
  const n=title.childNodes.length;
  const data=api.nativeHeaderRects();
  check('native receives geometry plus glyph metrics',data&&data.length===17&&data.every(Number.isFinite));
  check('baseline marker leaves original DOM unchanged',title.childNodes.length===n);
  check('actual logo rect, not its padded wrapper',Math.abs(data[2]-logo.getBoundingClientRect().width)<.01);
  check('actual CSS font size transmitted',Math.abs(data[13]-parseFloat(getComputedStyle(title).fontSize))<.01);
  check('title baseline lies inside its line box',data[14]>data[5]&&data[14]<data[5]+data[7]);
  const hidden=getComputedStyle(sub).display==='none';
  check('shared subtitle outline uses its real image rectangle',data[15]===0&&(hidden?data[10]===0:data[10]>0));
  const english=document.querySelector('.brandSubtitleMark');
  check('English vector is decoded and has accessible wording',english.complete&&english.naturalWidth>0&&english.alt==='FIRST HYUNDAI · REAL ESTATE');
  const header=document.querySelector('.brandHeaderText');
  check('moving identity has no duplicate visible destination',getComputedStyle(header).opacity==='0');
  await new Promise(r=>setTimeout(r,1100));
  check('no independent timer reveals header while native still moves',getComputedStyle(header).opacity==='0');
  api.beginNativeHandoffLanding();
  check('actual arrival reveals fully drawn underlay',getComputedStyle(header).opacity==='1');
  api.finishNativeHandoff();
  check('cleanup leaves brand fully visible',getComputedStyle(header).opacity==='1'&&!document.body.classList.contains('fhd-native-handoff'));
  document.body.innerHTML='<pre id="landing-test">PASS '+checks.length+' landing assertions</pre>';
 }catch(e){document.body.innerHTML='<pre id="landing-test">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-brand-landing-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('<head>','<head><script>window.FirstHyundaiNative={};</script>');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+checkLanding.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,340,360,393,430]){
  const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=2500','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1600));
  const m=r.stdout.match(/<pre id="landing-test">([\s\S]*?)<\/pre>/);
  assert(m,'Landing browser did not finish: '+r.stdout.slice(-800));
  assert(m[1].startsWith('PASS '),width+'px '+m[1]);console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
