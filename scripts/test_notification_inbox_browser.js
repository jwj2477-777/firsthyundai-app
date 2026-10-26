'use strict';
/* Real browser: bell history, six consistent icon cards and category colors. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,'app/src/main/assets');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const activity=read('app/src/main/java/kr/co/firsthyundai/app/MainActivity.java');
const history=read('app/src/main/java/kr/co/firsthyundai/app/NotificationHistory.java');
const trades=read('app/src/main/java/kr/co/firsthyundai/app/TradeNotifications.java');
const memos=read('app/src/main/java/kr/co/firsthyundai/app/OfficeMemoNotifications.java');
const inbox=read('app/src/main/assets/notification-inbox.js');
new vm.Script(inbox);
for(const expected of ['getNotificationHistory()','markNotificationHistoryRead()','clearNotificationHistory()',
 'requestInitialNotificationPermission()','Manifest.permission.POST_NOTIFICATIONS'])
 assert(activity.includes(expected),'Native startup permission or bridge missing: '+expected);
assert(activity.includes('memoTimer.postDelayed(()->requestInitialNotificationPermission(),1600L)'));
assert(history.includes('getSharedPreferences(PREF,Context.MODE_PRIVATE)'),'No public notification history storage');
assert(history.includes('MAX=80')&&history.includes('RETAIN_MS'),'History capped');
assert(history.includes('if("memo".equals(kind))'),'Memo title and body must be generic in history');
assert(trades.includes('NotificationHistory.record(activity,"trade"'));
assert(memos.includes('NotificationHistory.record(context,"memo"'));
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chromium required for UI regression');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(cond,msg)=>{if(!cond)throw Error(msg)};
  fetchRemote=async()=>null;
  let readMarked=false,cleared=false;
  let data=[{id:'native-a',kind:'trade',title:'관심 단지 새 실거래 2건',
   detail:'퍼스트파크 15블럭',when:Date.now()-60000,read:false},
   {id:'native-b',kind:'memo',title:'새 사무실 공유 메모',
   detail:'사무실 포스트잇이 도착했습니다.',when:Date.now()-90000,read:false}];
  window.FirstHyundaiNative={
   getNotificationHistory:()=>JSON.stringify(data),
   markNotificationHistoryRead:()=>{readMarked=true;data=data.map(x=>({...x,read:true}))},
   clearNotificationHistory:()=>{cleared=true;data=[]}
  };
  window.FirstHyundaiNotificationInbox.refresh();
  const bell=document.getElementById('favoriteAlertButton');
  check(bell.getAttribute('aria-label').includes('2건'),'Unread badge count');
  bell.click();
  const dialog=document.getElementById('notificationInboxDialog');
  check(dialog.open&&readMarked,'Bell opens and reads notification history');
  check(dialog.querySelectorAll('.inboxItem').length===2,'Both trade and memo delivered items shown');
  check(!bell.classList.contains('hasUnreadHistory'),'Reading clears unread marker');
  check(dialog.textContent.includes('사무실 포스트잇이 도착했습니다.'),'Memo generic no contents');
  const go=document.querySelector('.inboxItem[data-kind="memo"]');
  go.click();
  check(!dialog.open&&currentPage==='officeBoard','Memo history returns to authenticated note page');
  const colors=new Map();
  let coords=null;
  for(const page of ['trades','complexes','news','overview','contracts','officeBoard']){
   switchPage(page);
   await new Promise(r=>setTimeout(r,75));
   const buttons=[...document.querySelectorAll('#nav .primaryNav>button,#nav .utilityNav>button:not(.adminCenterNav)')];
   check(buttons.length===6,'Six common navigation cards remain');
   const rects=buttons.map(b=>b.getBoundingClientRect());
   check(rects.every(r=>Math.abs(r.height-rects[0].height)<.1),'Unequal card height '+page);
   check(rects.every(r=>Math.abs(r.width-rects[0].width)<.1),'Unequal card width '+page);
   check(buttons.every(b=>b.querySelector('svg')&&b.querySelector('.navLabel')),'Some nav cards are text-only');
   check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal scroll '+page);
   const pos=rects.map(r=>[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]);
   if(coords)check(JSON.stringify(pos)===JSON.stringify(coords),'Nav jumps when changing screens');
   coords=pos;
   const active=buttons.find(b=>b.getAttribute('aria-current')==='page');
   check(active,'Selected route not indicated');
   const bg=getComputedStyle(active).backgroundColor;
   colors.set(page,bg);
  }
  check(colors.size===6,'Category colors lost');
  window.confirm=()=>true;
  window.FirstHyundaiNotificationInbox.open();
  document.getElementById('notificationInboxClear').click();
  check(cleared&&document.querySelectorAll('.inboxItem').length===0,'Clear history action broken');
  document.body.innerHTML='<pre id="inbox-browser-test">PASS private history, first-launch permission contract, 6 consistent premium nav cards</pre>';
 }catch(e){document.body.innerHTML='<pre id="inbox-browser-test">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-inbox-browser-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,430,600]){
  const result=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr.slice(-800));
  const found=result.stdout.match(/<pre id="inbox-browser-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not return verdict '+result.stdout.slice(-700));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
