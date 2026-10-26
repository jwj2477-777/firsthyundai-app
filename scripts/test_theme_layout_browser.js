'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chrome required for theme geometry regression');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(x,msg)=>{if(!x)throw Error(msg)};
  // Freeze only unrelated data loading; the full original DOM, handlers and CSS run.
  fetchRemote=async()=>null;
  const themes=['default','spring','summer','autumn','winter'];
  const controlBox=()=>[...document.querySelectorAll('button,input,select,textarea,summary,h1,h2')]
   .filter(e=>!e.closest('#adminCenter')&&e.getClientRects().length)
   .map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return [e.id,e.textContent,b.x,b.y,b.width,b.height,s.fontSize,s.color]});
  let total=0;
  for(const page of ['overview','trades','nearby','new','officetel','complexes','news','contracts','officeBoard']){
   switchPage(page);scrollTo(0,0);
   await new Promise(r=>setTimeout(r,500));
   FirstHyundaiThemes.configure({theme:'default',weatherEffect:'none'});
   const original=JSON.stringify(controlBox());
   const bg=getComputedStyle(document.body).backgroundImage;
   for(const theme of themes)for(const effect of ['none','rain','snow']){
    FirstHyundaiThemes.configure({theme,weatherEffect:effect});
    check(JSON.stringify(controlBox())===original,page+' geometry/text/functional colors changed '+theme+'/'+effect);
    check(getComputedStyle(document.getElementById('seasonAtmosphere')).pointerEvents==='none','decoration intercepts input');
    if(theme!=='default')check(getComputedStyle(document.body).backgroundImage!==bg,'theme has no visible color');
    check(document.documentElement.scrollWidth<=innerWidth,page+' horizontal overflow');total++;
   }
   FirstHyundaiThemes.configure({theme:'default',weatherEffect:'none'});
   check(getComputedStyle(document.body).backgroundImage===bg,'default not restored');
  }
  document.body.innerHTML='<pre id="theme-layout">PASS '+total+' combinations preserve all original visible controls</pre>';
 }catch(e){document.body.innerHTML='<pre id="theme-layout">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-theme-layout-'));
try{
 fs.cpSync(assets,dir,{recursive:true});let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,393,600]){
  const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars',
   '--window-size='+width+',1100','--virtual-time-budget=45000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1000));const m=r.stdout.match(/<pre id="theme-layout">([\s\S]*?)<\/pre>/);
  assert(m,'Theme browser did not finish: '+r.stdout.slice(-800));assert(m[1].startsWith('PASS'),width+'px '+m[1]);console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
