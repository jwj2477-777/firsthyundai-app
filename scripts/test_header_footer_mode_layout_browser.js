'use strict';
/* Visible browser dimensions: notification replaces header mode control; the
   role switch keeps the native security handler and sits beside update check. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const chrome=process.env.FHD_CHROME||['google-chrome','chromium','google-chrome-stable','chromium-browser']
 .find(x=>child.spawnSync('which',[x]).status===0);
assert(chrome,'Chrome/Chromium required');
async function verify(){
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(v,msg)=>{if(!v)throw Error(msg)};
  const header=document.querySelector('header');
  const bell=document.getElementById('favoriteAlertButton');
  const mode=document.getElementById('roleButton');
  const update=document.getElementById('appUpdateCheck');
  const controls=document.querySelector('.compactAppFooter .appFooterControls');
  const brand=document.querySelector('header .brandHeaderText');
  const b=b=>b.getBoundingClientRect();
  check(bell&&mode&&update&&controls,'Essential header/footer controls');
  check(bell.closest('#modeBar'),'Bell should occupy former mode-switch slot');
  check(!mode.closest('header'),'Mode switch must leave main header');
  check(mode.closest('.appFooterControls')===controls,'Mode switch grouped with update');
  check(update.closest('.appFooterControls')===controls,'Update check remains beside mode control');
  check(b(mode).width>115&&b(update).width>115,'Footer controls need readable touch width');
  check(Math.abs(b(mode).height-b(update).height)<.2,'Different footer button heights');
  check(Math.abs(b(mode).y-b(update).y)<.2,'Footer controls must align on one line');
  check(b(bell).height>=40&&b(bell).width>=65,'Accessible inbox target size');
  check(b(bell).left>=b(brand).right-3,'Notification inbox must occupy header right slot');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Overflow in header or footer');
  check(mode.getAttribute('onclick')==='toggleAdminMode()','Original protected mode action preserved');
  check(bell.getAttribute('onclick')==='FirstHyundaiNotificationInbox.open()','Notification history action preserved');
  check(update.id==='appUpdateCheck'&&!update.disabled,'Update control unchanged');
  check(document.querySelectorAll('#roleButton').length===1,'Never duplicate mode switch');
  check(document.querySelectorAll('#favoriteAlertButton').length===1,'Never duplicate inbox');
  document.body.innerHTML='<pre id="mode-dock-layout">PASS top inbox and grouped footer mode/update controls</pre>';
 }catch(e){document.body.innerHTML='<pre id="mode-dock-layout">FAIL '+e.message+'</pre>'}
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-mode-dock-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,430,600]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-800));
  const hit=r.stdout.match(/<pre id="mode-dock-layout">([\s\S]*?)<\/pre>/);
  assert(hit,'Browser test did not finish '+r.stdout.slice(-600));
  assert(hit[1].startsWith('PASS'),width+'px '+hit[1]);
  console.log(width+'px '+hit[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
