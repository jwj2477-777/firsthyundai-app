'use strict';
/* Browser geometry for the one-card, conditional briefing; optional notices are not empty boxes. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
 child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>
  child.spawnSync('which',[x]).status===0);
assert(binary,'Chrome required for daily briefing visual regression');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  fetchRemote=async()=>null;
  switchPage('overview');
  await new Promise(r=>setTimeout(r,700));
  scrollTo(0,0);
  const root=document.getElementById('overview');
  const panel=document.getElementById('overviewUnified');
  const weather=document.getElementById('overviewWeatherMessage');
  const source=document.getElementById('overviewWeatherSource');
  check(root&&panel&&weather&&source,'Always-visible weather controls');
  check(panel.getBoundingClientRect().width>150,'Briefing panel visible');
  check(weather.textContent.length>0,'Weather observation or honest loading state');
  check(root.querySelectorAll('#overviewUnified').length===1,'One unified panel only');
  check(!root.querySelector('.overviewActionGrid,.overviewStats,.overviewStatusPanel'),
   'Obsolete overview blocks must not return');
  const optional=['overviewPrecipitation','overviewMapAlert','overviewSongdoNews',
   'overviewMemoBriefing','overviewTodayNewTrade'];
  for(const id of optional)check(document.getElementById(id),'Missing conditional section '+id);
  for(const id of optional)document.getElementById(id).hidden=true;
  const reduced=panel.getBoundingClientRect().height;
  check(getComputedStyle(document.getElementById('overviewMemoBriefing')).display==='none',
   'No blank agenda panel on a day without appointments');
  check(getComputedStyle(document.getElementById('overviewTodayNewTrade')).display==='none',
   'No blank new-trades notice');
  document.getElementById('overviewMapAlert').textContent='퇴근 전에 지도함을 실내로 들여놓으세요.';
  document.getElementById('overviewMapAlert').hidden=false;
  check(panel.getBoundingClientRect().height>reduced,'Rain alert expands only when useful');
  document.getElementById('overviewMapAlert').hidden=true;
  const trade=document.getElementById('overviewTodayNewTrade');
  trade.hidden=false;
  document.getElementById('overviewNewQuickCount').textContent='2건';
  check(trade.getBoundingClientRect().height>=36,'Tap target for newly reported trades');
  trade.click();
  check(currentPage==='new','One-tap link to newly reported trades');
  switchPage('overview');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No sideways scrolling');
  document.body.innerHTML='<pre id="overview-actions-test">PASS single card and conditional notices</pre>';
 }catch(e){
  document.body.innerHTML='<pre id="overview-actions-test">FAIL '+e.message+'</pre>';
 }
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-briefing-layout-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');
 fs.writeFileSync(file,html);
 for(const width of [320,360,393,430,600]){
  const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=20000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-900));
  const m=r.stdout.match(/<pre id="overview-actions-test">([\s\S]*?)<\/pre>/);
  assert(m,'Briefing browser did not finish '+r.stdout.slice(-900));
  assert(m[1].startsWith('PASS'),width+'px '+m[1]);
  console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
