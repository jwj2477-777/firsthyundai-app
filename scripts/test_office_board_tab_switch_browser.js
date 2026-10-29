'use strict';
/* Real browser regression: same geometry as news, memo/calendar exclusive,
   notification status visually absent and typed draft preserved. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chromium required to verify office memo tabs');
async function verify(){
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  switchPage('news');
  switchNewsPane('articles');
  const news=document.querySelector('.newsCategoryTabs');
  const newsTab=news?.querySelector('button');
  check(newsTab,'News reference tab missing');
  const newsHeight=Math.round(newsTab.getBoundingClientRect().height);
  const newsRadius=getComputedStyle(news).borderTopLeftRadius;
  switchPage('officeBoard');
  await new Promise(resolve=>setTimeout(resolve,150));
  const bar=document.querySelector('#officeBoard .officeBoardViewToggle');
  const memo=document.getElementById('officeBoardNotesView');
  const calendar=document.getElementById('officeBoardCalendarView');
  const composer=document.querySelector('#officeBoard .officeBoardComposer');
  const draft=document.getElementById('officeBoardDraft');
  const list=document.getElementById('officeBoardList');
  const agenda=document.getElementById('officeBoardCalendar');
  const status=document.querySelector('.officeMemoNotificationTools');
  check(bar&&memo&&calendar&&composer&&draft&&status,'Missing controls');
  check(bar.classList.contains('sectionModeSwitch'),'Segmented template not reused');
  check(getComputedStyle(bar).borderTopLeftRadius===newsRadius,'Memo bar radius differs from news');
  const h=e=>Math.round(e.getBoundingClientRect().height);
  const same=e=>Math.abs(h(e)-newsHeight)<=3;
  check(same(memo)&&same(calendar),'Memo and Calendar height differs from news');
  check(h(memo)===h(calendar),'Memo and calendar unequal height');
  check(memo.classList.contains('selected')&&!calendar.classList.contains('selected'),'Initial view should be notes');
  const openComposer=document.getElementById('officeBoardComposeToggle');
  check(openComposer&&composer.classList.contains('hidden')&&list.classList.contains('officeBoardList'),
    'Memo library should be open while composer is collapsed by default');
  check(status.classList.contains('hidden'),'Healthy/pending notification banner should not display');
  openComposer.click();
  check(!composer.classList.contains('hidden')&&openComposer.getAttribute('aria-expanded')==='true',
   'New memo button should open its own composer');
  draft.value='보존할 미발송 메모 초안';
  const mustard=getComputedStyle(memo).backgroundColor;
  check(mustard!==getComputedStyle(calendar).backgroundColor,'Active memo tab needs mustard contrast');
  calendar.click();
  check(calendar.classList.contains('selected')&&!memo.classList.contains('selected'),'Calendar did not activate');
  check(composer.classList.contains('hidden'),'Calendar must hide memo composer');
  check(document.getElementById('officeBoardFeedback').classList.contains('hidden'),'Calendar must hide memo feedback');
  check(list.classList.contains('hidden')&&document.getElementById('officeBoardListHeading').classList.contains('hidden'),'Calendar must hide note list');
  check(!agenda.classList.contains('hidden'),'Calendar panel missing');
  check(h(calendar)===h(memo)&&same(calendar),'Button sizes changed when selected');
  check(draft.value==='보존할 미발송 메모 초안','Switching tabs discarded unposted text');
  await new Promise(resolve=>setTimeout(resolve,850));
  // Test the *resting* background; the real-button flow momentarily paints
  // an inline gradient over it (headless Chrome can throttle animation frames).
  window.FirstHyundaiSelectionFlow?._test?.stop?.();
  check(getComputedStyle(calendar).backgroundColor===mustard,
    'Memo/calendar active color differs: '+getComputedStyle(calendar).backgroundColor+' vs '+mustard);
  memo.click();
  check(!composer.classList.contains('hidden')&&!list.classList.contains('hidden'),'Notes controls did not return');
  openComposer.click();
  check(composer.classList.contains('hidden')&&!list.classList.contains('hidden'),
   'Closing composer must leave searchable memo library visible');
  openComposer.click();
  check(!composer.classList.contains('hidden'),'Composer must reopen with preserved draft');
  check(agenda.classList.contains('hidden'),'Calendar was not hidden');
  check(draft.value==='보존할 미발송 메모 초안','Draft lost after round trip');
  const nav=document.querySelector('#nav .officeBoardNav');
  check(nav&&nav.classList.contains('active'),'Main memo nav not selected');
  check(getComputedStyle(nav).backgroundColor===mustard,'Main shared memo uses same mustard tone');
  const y0=memo.getBoundingClientRect().y,y1=calendar.getBoundingClientRect().y;
  check(Math.abs(y0-y1)<.2,'Split buttons are misaligned');
  // Search-first memo library: rows remain short, filters work on mobile.
  const memos=Array.from({length:17},(_,i)=>({
   id:'mhad4vwu-'+i.toString(16).padStart(36,'0'),
   text:i===2?'퍼스트파크 1502동 3004호 · 내일 손님 방문':'일반 상담 메모 '+i,
   author:{id:i%2===0?'11111111-1111-1111-1111-111111111111':'22222222-2222-2222-2222-222222222222',
    name:i%2===0?'엄마':'아빠'},
   done:i%3===0,
   created_at:new Date(Date.parse('2026-10-25T00:00:00Z')+i*60000).toISOString(),
   updated_at:new Date(Date.parse('2026-10-25T00:00:00Z')+i*60000).toISOString()
  }));
  window.FirstHyundaiOfficeBoard._test.merge(memos);
  const rows=()=>document.querySelectorAll('#officeBoardList article[data-note]').length;
  check(rows()===10,'Memo library should initially show at most 10 post-it cards');
  document.getElementById('officeBoardStatusAll').click();
  document.getElementById('officeBoardMore').click();
  check(rows()===17,'Memo library Show More must reveal remaining notes');
  const search=document.getElementById('officeBoardSearch');
  search.value='1502동 3004호';search.dispatchEvent(new Event('input',{bubbles:true}));
  check(rows()===1&&document.getElementById('officeBoardList').textContent.includes('퍼스트파크'),
   'Search should find a specific apartment unit without scrolling');
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  const author=document.getElementById('officeBoardAuthorFilter');
  author.value='11111111-1111-1111-1111-111111111111';
  author.dispatchEvent(new Event('change',{bubbles:true}));
  check(rows()===9,'Author filter must isolate a family account');
  document.getElementById('officeBoardStatusDone').click();
  check(rows()===3,'Completion + author filters must combine correctly');
  document.getElementById('officeBoardClearFilters').click();
  check(rows()===10,'Reset should return to compact active list');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow');
  document.body.innerHTML='<pre id="memo-tab-test">PASS consistent news-sized memo/calendar buttons, mustard, focused calendar and preserved draft</pre>';
 }catch(e){
  document.body.innerHTML='<pre id="memo-tab-test">FAIL '+e.message+'</pre>';
 }
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-memo-tab-'));
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
  assert.equal(result.status,0,result.stderr.slice(-900));
  const found=result.stdout.match(/<pre id="memo-tab-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser never finished '+result.stdout.slice(-600));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
