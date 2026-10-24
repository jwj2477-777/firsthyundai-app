'use strict';
/* Full shipped app: actual onclick handlers, styles, selection-flow and DOM.
 * Deterministic RAF samples test visible backgrounds, not CSS variable values.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(x=>child.spawnSync('which',[x],{encoding:'utf8'}).status===0);
assert(binary,'Chrome or Chromium required for full-app color-flow browser test');
async function runBrowserTests(){
 const checks=[];
 const check=(label,condition)=>{checks.push(label);if(!condition)throw Error(label)};
 const api=window.FirstHyundaiSelectionFlow._test;
 const bg=b=>getComputedStyle(b).backgroundImage;
 const rect=b=>JSON.stringify([b.offsetLeft,b.offsetTop,b.offsetWidth,b.offsetHeight]);
 const raf=new Map();let next=0;
 window.requestAnimationFrame=fn=>{raf.set(++next,fn);return next};
 window.cancelAnimationFrame=id=>raf.delete(id);
 const frame=t=>{const jobs=[...raf.values()];raf.clear();jobs.forEach(f=>f(t))};
 // No external data or customer data is used. Real empty-state renderers run.
 remote.trades={state:'verified',records:[],checked_at:'2026-10-25T00:00:00+09:00'};
 let clock=0;
 async function click(row,index){
  const bs=[...row.children].filter(b=>b.tagName==='BUTTON');
  const old=bs.findIndex(api.chosen),source=bs[old],target=bs[index];
  row.scrollIntoView({block:'center',behavior:'instant'});
  const labels=bs.map(b=>b.textContent),rects=bs.map(rect),n=api.stats.started;
  const rest=bs.map(bg);
  target.click();await Promise.resolve();await Promise.resolve();
  check(row.className+' real click starts '+old+'→'+index,api.stats.started===n+1);
  check('real selected state follows handler',api.chosen(target)&&!api.chosen(source));
  check('paint begins before first animation frame',target.style.background.includes('linear-gradient'));
  frame(clock);
  const a=bg(source),b=bg(target);
  frame(clock+315);
  check('source background visibly changes',bg(source)!==a);
  check('target background visibly changes',bg(target)!==b);
  const angle=index<old?'270deg':'90deg';
  check('both painted in actual travel direction',bg(source).includes(angle)&&bg(target).includes(angle));
  for(let i=0;i<bs.length;i++)if(i!==old&&i!==index)
   check('unrelated type '+i+' untouched',bg(bs[i])===rest[i]&&!bs[i].style.background);
  check('no button geometry or text movement',JSON.stringify(bs.map(rect))===JSON.stringify(rects)&&
   JSON.stringify(bs.map(b=>b.textContent))===JSON.stringify(labels));
  frame(clock+630);clock+=1000;
  check('all temporary backgrounds removed',bs.every(b=>!b.style.background));
  check('filter/selection remains after cleanup',api.chosen(target)&&!api.chosen(source));
 }
 try{
  switchPage('news');
  const news=document.querySelector('.newsCategoryTabs');
  await click(news,1);await click(news,0);
  for(const [page,id,open] of [['trades','tradeTypeBar'],['officetel','officeTypeBar'],['nearby','nearbyTypeBar',true]]){
   switchPage(page);if(open){chooseNearby('all');await new Promise(r=>setTimeout(r,400));}
   const row=document.getElementById(id);
   for(let source=0;source<4;source++)for(let target=0;target<4;target++)if(source!==target){
    const current=[...row.children].findIndex(api.chosen);
    if(current!==source)await click(row,source);
    await click(row,target);
   }
   // Rapid reverse: canceled frames cannot overwrite the newest selection.
   const bs=[...row.children];
   bs[0].click();await Promise.resolve();frame(clock);
   bs[3].click();await Promise.resolve();frame(clock+100);
   bs[1].click();await Promise.resolve();frame(clock+200);frame(clock+830);clock+=1500;
   check(id+' rapid reverse finishes on latest click',api.chosen(bs[1])&&bs.every(b=>!b.style.background));
   bs[1].click();await Promise.resolve();check('same selected button has no leftover paint',bs.every(b=>!b.style.background));
  }
  const nativeMatch=window.matchMedia;
  window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:nativeMatch(q);
  switchPage('news');const before=api.stats.started;
  document.getElementById('newsTabSubscriptions').click();await Promise.resolve();
  check('reduced motion applies selection immediately without paint',api.stats.started===before&&
   document.getElementById('newsTabSubscriptions').getAttribute('aria-selected')==='true');
  window.matchMedia=nativeMatch;
  document.body.innerHTML='<pre id="actual-browser-flow-test">PASS '+checks.length+' full-app assertions</pre>';
 }catch(e){document.body.innerHTML='<pre id="actual-browser-flow-test">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-full-app-flow-'));
try{
 fs.cpSync(path.join(root,'app/src/main/assets'),dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+runBrowserTests.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--disable-background-timer-throttling','--no-proxy-server',
  '--window-size=430,1000','--virtual-time-budget=3000','--dump-dom','file://'+file],
  {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
 if(r.error)throw r.error;
 assert.equal(r.status,0,'Chrome failed: '+r.stderr.slice(-1400));
 const m=r.stdout.match(/<pre id="actual-browser-flow-test">([\s\S]*?)<\/pre>/);
 assert(m,'Full app test did not execute: '+r.stdout.slice(-1200));
 const report=m[1].replaceAll('&gt;','>').replaceAll('&amp;','&');
 assert(report.startsWith('PASS '),report);console.log(report);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
