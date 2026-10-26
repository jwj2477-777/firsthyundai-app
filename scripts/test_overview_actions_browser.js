'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chrome required for briefing-card readability regression');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const box=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
  const once=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return e.scrollWidth<=e.clientWidth+1&&r.height<=parseFloat(s.lineHeight)+1};
  fetchRemote=async()=>null;
  switchPage('overview');await new Promise(r=>setTimeout(r,700));scrollTo(0,0);
  const buttons=[...document.querySelectorAll('.overviewActionCard')];
  check(buttons.length===2,'Two familiar task tiles');
  check(buttons[0].getBoundingClientRect().top===buttons[1].getBoundingClientRect().top,'Same row');
  const original=JSON.stringify(buttons.map(box));
  let count=0;
  for(const theme of ['default','spring','summer','autumn','winter']){
   FirstHyundaiThemes.configure({theme,weatherEffect:'none'});
   for(const text of ['0건','1건','999건','10,000건','999,999건','확인 전']){
    document.getElementById('overviewNewQuickCount').textContent=text;
    for(const b of buttons){
     check(once(b.querySelector('strong')),'Task title must be one complete line: '+b.textContent);
     check(b.scrollWidth<=b.clientWidth+1,'No clipped/overflowing tile content');
     check(b.getBoundingClientRect().height>=44,'Touch target preserved');
    }
    const amount=document.getElementById('overviewNewQuickCount');
    check(amount.getBoundingClientRect().height<=parseFloat(getComputedStyle(amount).lineHeight)+1,'Amount stays one line');
    check(amount.scrollWidth<=amount.parentElement.clientWidth+1,'Amount fits tile');
    check(JSON.stringify(buttons.map(box))===original,'Count changes cannot resize/move either tile');count++;
   }
  }
  check(buttons[1].querySelector('strong').textContent==='관심 14개 단지','Full title retained');
  buttons[0].click();check(currentPage==='new','New trades tile retains real navigation');
  switchPage('overview');buttons[1].click();check(currentPage==='nearby','Favorite tile retains real navigation');
  check(document.documentElement.scrollWidth<=innerWidth,'No horizontal page overflow');
  document.body.innerHTML='<pre id="overview-actions-test">PASS '+count+' title/count layouts and both real navigation actions</pre>';
 }catch(e){document.body.innerHTML='<pre id="overview-actions-test">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-overview-actions-'));
try{
 fs.cpSync(assets,dir,{recursive:true});let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,430,600]){
  const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars',
   '--window-size='+width+',1100','--virtual-time-budget=20000','--dump-dom','file://'+file],{encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1000));const m=r.stdout.match(/<pre id="overview-actions-test">([\s\S]*?)<\/pre>/);
  assert(m,'Briefing-card browser did not finish: '+r.stdout.slice(-700));assert(m[1].startsWith('PASS'),width+'px '+m[1]);console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
