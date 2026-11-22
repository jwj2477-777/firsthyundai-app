'use strict';
/* v2.2.10 real-browser regression for shared memos without internet (fictional data only).
   A fake native bridge stands in for the Android app: it answers like the app does
   when DNS fails ({network:'offline'}) and keeps an in-memory "encrypted" copy.
   - The phone copy is shown read-only, with a banner above the 메모작성/메모함/달력 tabs.
   - A memo written offline is kept and NOT sent; when the connection returns a
     "지금 보내기" button sends it once.
   - A connection that drops while the list is open keeps the notes on screen.
   - English exception text from older app builds is still recognised.
   - 오늘 요약 says it shows the stored copy.
   - Searching on "진행 중" points to matches in 완료. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
function fakeBridge(){
 const member='11111111-2222-3333-4444-555555555555',other='99999999-2222-3333-4444-555555555555';
 const iso=(d,h)=>{const t=new Date(Date.now()+d*864e5);t.setUTCHours(h-9,0,0,0);return t.toISOString()};
 let k=0;
 const note=(text,extra)=>Object.assign({id:'n'+String(++k).padStart(9,'0')+'-'+member,text,done:false,
  created_at:iso(-1,9),updated_at:iso(-1,9),author:{id:member,name:'가상직원'},scheduled_at:null,all_day:false,pinned:false,images:[]},extra||{});
 const notes=[note('가상단지 손님 내일 오후 2시 방문',{scheduled_at:iso(1,14)}),note('오늘 오후 4시 가상 계약서 준비',{scheduled_at:iso(0,16)}),
  note('가상실장 메모 가상단지 매물',{author:{id:other,name:'가상실장'}}),note('가상고객 잔금 끝',{done:true}),
  note('가상 휴무',{scheduled_at:'2026-11-29T15:00:00.000Z',all_day:true})];
 let saved={schema:1,cachedAt:Date.now()-3*3600e3,notes:notes.slice()};
 window.__fake={online:false,legacy:false,calls:[],posts:0};
 window.FirstHyundaiNative={
  getMode:()=>'family',getOfficeMemberId:()=>member,getOfficeMemberName:()=>'가상직원',
  getOfficeMemoOfflineSnapshot:()=>JSON.stringify(saved),
  saveOfficeMemoOfflineSnapshot:x=>{saved={schema:1,cachedAt:Date.now(),notes:JSON.parse(x).notes};return true},
  getOfficeMemoDraft:()=>'{}',saveOfficeMemoDraft:()=>{},clearOfficeMemoDraft:()=>{},
  getOfficeMemoNotificationStatus:()=>'enabled',getOfficeMemoPushStatus:()=>'push_ready',
  officeBoardAction:(action,payload,id)=>{window.__fake.calls.push(action);setTimeout(()=>{
   const f=window.__fake,reply=window.onFirstHyundaiOfficeBoardResult;
   if(!f.online)return reply(f.legacy?{requestId:id,ok:false,needsAuth:false,error:'Unable to resolve host "x.workers.dev": No address associated with hostname'}:
    {requestId:id,ok:false,needsAuth:false,network:'offline',error:'인터넷에 연결되어 있지 않습니다.'});
   if(action==='post'){f.posts++;const d=JSON.parse(payload);const n=note(d.text,{scheduled_at:d.scheduled_at,all_day:d.all_day,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    notes.unshift(n);return reply({requestId:id,ok:true,data:{note:n}})}
   reply({requestId:id,ok:true,data:{notes:notes.slice(),has_more:false}});
  },40)}
 };
}
async function verify(){
 const out=document.createElement('pre');out.id='memo-offline-test';
 try{
  await document.fonts.ready;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const $=id=>document.getElementById(id);
  const api=FirstHyundaiOfficeBoard,t=api._test,f=window.__fake;
  const english=()=>/[A-Za-z]{6,}/.test($('officeBoardFeedback').textContent);
  const cards=()=>document.querySelectorAll('#officeBoardList .officeBoardNote').length;
  // 1) Opened without internet: the phone copy, read-only, banner above the tabs.
  switchPage('officeBoard');await wait(400);
  const banner=$('officeBoardOfflineBanner');
  check(!banner.classList.contains('hidden'),'Offline banner is shown');
  check(banner.compareDocumentPosition(document.querySelector('.officeBoardViewToggle'))&Node.DOCUMENT_POSITION_FOLLOWING,'Banner sits above the tabs');
  check($('officeBoardOfflineTitle').textContent.includes('저장된 메모 보는 중'),'Banner title: '+$('officeBoardOfflineTitle').textContent);
  check(/저장 \(3시간 전\)/.test($('officeBoardOfflineDetail').textContent),'Banner says how old the copy is: '+$('officeBoardOfflineDetail').textContent);
  api.setView('notes');await wait(60);
  check(cards()===4,'Stored active memos are listed: '+cards());
  const labels=[...document.querySelectorAll('.officeBoardReadOnly')].map(x=>x.textContent);
  check(labels.includes('인터넷 연결 후 수정 가능')&&labels.includes('작성자·관리자만 수정 가능'),'Read-only reasons: '+labels.join('|'));
  check(!document.querySelector('#officeBoardList [data-action="done"]'),'No 완료 buttons offline');
  {const sch=[...document.querySelectorAll('.officeBoardNoteSchedule')].map(x=>x.textContent.trim());check(sch.some(x=>/^11\. 30\. \(월\) 종일/.test(x)),'All-day date reads like timed dates: '+sch.join('|'));}
  // 2) A memo written offline is kept, not sent.
  api.setView('compose');$('officeBoardDraft').value='가상 메모 내일 오후 3시 가상단지';
  await api.post();await wait(80);
  check(!f.calls.includes('post'),'Nothing is sent while offline');
  check($('officeBoardDraft').value.includes('가상 메모'),'Draft stays');
  check($('officeBoardFeedback').textContent.includes('지금 보내기')&&!english(),'Offline send explains the wait: '+$('officeBoardFeedback').textContent);
  // 3) 오늘 요약 marks the stored copy.
  switchPage('overview');await wait(120);
  check(($('overviewMemoEntries').textContent||'').includes('휴대폰에 저장된 일정'),'오늘 요약 says it is the stored copy');
  // 4) The connection returns: one tap sends it once.
  switchPage('officeBoard');api.setView('compose');await wait(80);
  f.online=true;window.dispatchEvent(new Event('online'));await wait(1600);
  check(banner.classList.contains('hidden'),'Banner hides once connected');
  const send=document.querySelector('#officeBoardFeedback .officeBoardSendNow');
  check(send&&send.textContent==='지금 보내기','지금 보내기 button appears');
  send.click();await wait(400);
  check(f.posts===1&&$('officeBoardDraft').value==='','Sent once and the draft cleared');
  // 5) The connection drops while the list is open: notes stay, nothing is lost.
  api.setView('notes');await wait(60);
  const before=cards();check(before>=5,'Live list loaded');
  f.online=false;
  api.setView('compose');$('officeBoardDraft').value='가상 두 번째 메모';
  await api.post();await wait(120);
  api.setView('notes');await wait(60);
  check(cards()===before,'Notes stay on screen after the drop ('+cards()+'/'+before+')');
  check(!banner.classList.contains('hidden')&&/방금|분 전/.test($('officeBoardOfflineDetail').textContent),'Banner shows the live list time');
  check($('officeBoardFeedback').textContent.includes('아직 보내지 않았어요')&&f.posts===1,'Second memo held, not sent');
  // 6) Older app builds report only English text.
  check(t.networkKindOf(Error('Unable to resolve host "x": No address associated with hostname'))==='offline','DNS text = offline');
  check(t.networkKindOf(Error('timeout'))==='timeout','timeout text');
  check(t.networkKindOf(Error('게시판 서버에 연결할 수 없습니다. HTTP 302'))==='server','Wi-Fi sign-in redirect');
  const answered=Error('요청 권한이 없습니다.');answered.network='';
  check(t.networkKindOf(answered)==='','A board answer is not a network failure');
  check(t.ageWords(Date.now()-90*60000)==='1시간 전'&&t.ageWords(Date.now()-3*864e5)==='3일 전','Age words');
  // 7) Search on 진행 중 points to 완료 matches.
  f.online=true;await api.refresh();await wait(200);
  api.setView('notes');api.setStatus('active');api.setQuery('잔금');await wait(60);
  const hint=$('officeBoardSearchElsewhere');
  check(!hint.hidden&&hint.textContent.includes('완료된 메모에도 1건'),'Search hint: '+hint.textContent);
  hint.click();await wait(60);
  check(cards()===1&&hint.hidden,'전체 보기 shows the finished memo');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS offline copy, banner, held memo, 지금 보내기, drop keeps list, legacy text, 오늘 요약, search hint';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-memo-offline-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('<head>','<head><script>('+fakeBridge.toString()+')();</script>');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--user-data-dir='+path.join(tmp,'profile-'+width),'--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=20000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="memo-offline-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
