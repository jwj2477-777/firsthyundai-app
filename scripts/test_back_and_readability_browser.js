'use strict';
/* v2.2.13 real-browser regression (no customer data).
   Android Back used to close the whole app from any screen, even with 알림함 or a
   photo open. Now: an open dialog closes first, then Back walks through the visited
   screens to the home screen, shows "한 번 더 누르면 앱이 닫혀요", and only the next
   press leaves. Also checks the readability floor measured on every screen. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
async function verify(){
 const out=document.createElement('pre');out.id='back-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const back=()=>window.firstHyundaiGoBack();
  const home=appHomePage();
  switchPage(home);pageTrail.length=0;await wait(30);
  // 1) Screens walk back in the order they were opened.
  switchPage('trades');switchPage('news');switchPage('calculators');await wait(30);
  check(back()===true&&currentPage==='news','Back → 뉴스 ('+currentPage+')');
  check(back()===true&&currentPage==='trades','Back → 실거래 ('+currentPage+')');
  check(back()===true&&currentPage===home,'Back → home ('+currentPage+')');
  // 2) Home: first press only warns.
  check(back()===true,'First Back on home is kept');
  const toast=document.getElementById('fhdBackToast');
  check(toast&&!toast.hidden&&toast.textContent.includes('한 번 더 누르면'),'Exit warning shown');
  check(back()===false,'Second Back leaves the app');
  // 3) An open dialog closes first and the screen stays.
  await wait(2600);
  switchPage('trades');await wait(30);
  const inbox=document.getElementById('notificationInboxDialog');
  inbox.showModal();check(inbox.open,'Inbox opened');
  check(back()===true&&!inbox.open&&currentPage==='trades','Back closes 알림함 and stays on 실거래');
  const photo=document.getElementById('ct_imageDialog');
  photo.showModal();
  check(back()===true&&!photo.open&&currentPage==='trades','Back closes a photo preview');
  // A dialog that refuses to close (cancel prevented) keeps the app open too.
  const stubborn=document.getElementById('noteDialog');
  const keep=e=>e.preventDefault();stubborn.addEventListener('cancel',keep);stubborn.showModal();
  check(back()===true&&stubborn.open,'A dialog that must stay open is respected');
  stubborn.removeEventListener('cancel',keep);stubborn.close();
  // 4) Readability floor.
  const size=el=>parseFloat(getComputedStyle(el).fontSize);
  const lum=c=>{const v=c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  switchPage('trades');await wait(40);
  for(const count of document.querySelectorAll('#tradeTypeBar .typeCount'))
   check(size(count)>=11,'Trade count text is at least 11px ('+size(count)+')');
  const idle=document.querySelector('#tradeTypeBar>button:not(.active) .typeCount');
  if(idle)check(ratio(getComputedStyle(idle).color,'rgb(255,255,255)')>=4.5,'Trade count contrast ≥ 4.5');
  check(getComputedStyle(document.querySelector('#tradeTypeBar>button')).height==='50px','Type buttons keep their fixed height');
  const probe=document.createElement('span');probe.className='summaryMetaLabel';
  const card=document.createElement('span');card.className='complexSummaryMeta';card.appendChild(probe);
  const host=document.getElementById('complexCards');host.appendChild(card);
  check(size(probe)>=12&&ratio(getComputedStyle(probe).color,'rgb(255,255,255)')>=4.5,'아파트정보 "주소" label readable');
  card.remove();
  // 5) First start without internet: no endless "확인 중".
  const savedTrades=remote.trades;remote.trades=null;issues.trades='Failed to fetch';
  showNotLoaded('trades');
  check(dataNotLoaded('trades')&&document.getElementById('tradesMeta').textContent.includes('받지 못함'),'Not-loaded wording on 실거래');
  issues.trades='';remote.trades=savedTrades;
  // 6) Korean sentences wrap between words.
  check(getComputedStyle(document.body).wordBreak==='keep-all','Korean keep-all wrapping');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS back walks screens, home double-press, dialogs first, readability floor';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-back-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--user-data-dir='+path.join(tmp,'profile-'+width),'--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="back-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
