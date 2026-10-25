/* System operations console. Read-only monitoring except explicitly wired existing actions. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let publicIssue='',checkNote='';
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function classify(payload,issue,kind){
  const records=kind==='news'?payload?.briefs:payload?.records;
  const count=Array.isArray(records)?records.length:null;
  if(issue)return {tone:'warn',label:'조회 오류',desc:'기존 게시자료 유지'};
  if(!payload)return {tone:'pending',label:'미확인',desc:'아직 자료가 없습니다'};
  if(payload.state==='not_started')return {tone:'pending',label:'수집 전',desc:'첫 수집 대기'};
  if(payload.state==='partial')return {tone:'warn',label:'일부 오류',desc:count===null?'목록 확인 필요':number(count)+'건 게시'};
  if(payload.state&&!['ok','verified','ready','verified_partial'].includes(payload.state))
   return {tone:'pending',label:'연동 대기',desc:'게시 상태: '+String(payload.state).slice(0,36)};
  if(count===null)return {tone:'pending',label:'자료 확인',desc:'게시 목록 확인 필요'};
  return {tone:'ok',label:'게시 확인',desc:number(count)+'건 게시'};
 }
 function rows(){
  const feeds=[
   ['아파트 실거래',remote.trades,issues.trades,'trades'],
   ['신규 공개 실거래',remote.new_trades,issues.new_trades,'new_trades'],
   ['아파트 정보',remote.complexes,issues.complexes,'complexes'],
   ['송도 뉴스',remote.news,issues.news,'news'],
   ['오피스텔 매매',publicServices?.office_sales,publicIssue,'office_sales'],
   ['오피스텔 전월세',publicServices?.office_rents,publicIssue,'office_rents'],
   ['청약·분양',publicServices?.subscriptions,publicIssue,'subscriptions'],
   ['학교 정보',publicServices?.schools,publicIssue,'schools']
  ];
  return feeds.map(([name,payload,issue,kind])=>({
   ...classify(payload,issue,kind),name,issue:issue||'',
   time:payload?.checked_at||payload?.updated_at||payload?.last_verified||''
  }));
 }
 function render(){
  if(role!=='admin'||!$('adminCenter'))return;
  const data=rows(),ok=data.filter(x=>x.tone==='ok').length,bad=data.filter(x=>x.tone==='warn').length;
  const pending=data.length-ok-bad,overall=$('adminSystemStatus');
  overall.textContent=bad?'점검 필요':pending?'일부 확인 전':'게시자료 확인';
  overall.className='adminStateBadge '+(bad?'warn':pending?'pending':'ok');
  $('adminSummary').innerHTML=[['게시 확인',ok],['오류',bad],['미수집·대기',pending]].map(([label,n])=>
   '<div class="adminMetric"><strong>'+n+'</strong><small>'+label+'</small></div>').join('');
  $('adminInstalledVersion').textContent=installedAppVersionLabel(window.FirstHyundaiNative);
  $('adminCheckNote').textContent=checkNote||'마지막 게시자료 기록 기준이며 원천 API 실시간 정상 상태를 보장하지 않습니다.';
  $('adminFeeds').innerHTML=data.map(x=>
   '<div class="adminFeed"><div><strong>'+safe(x.name)+'</strong><small>'+safe(x.desc)+' · '+safe(x.time?compactTradeCollectedAt(x.time):'수집 시각 확인 전')+'</small></div>'+
   '<span class="adminStateBadge '+x.tone+'">'+safe(x.label)+'</span></div>').join('');
  $('adminDiagnosticDetails').innerHTML='<p>게시 저장소: '+safe(repository)+'</p>'+
   data.map(x=>'<p>'+safe(x.name)+' · '+safe(x.label)+(x.issue?' · '+safe(String(x.issue).slice(0,140)):'')+'</p>').join('');
 }
 async function refresh(){
  if(role!=='admin')return;
  checkNote='게시자료를 다시 확인하고 있습니다…';render();
  try{
   await Promise.all([refreshAll(true),refreshPublicServices(true)]);
   checkNote='마지막 게시자료 확인 '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
  }catch(e){checkNote='일부 게시자료 확인 실패. 자료별 상태를 확인해 주세요.';}
  render();
 }
 function checkUpdate(){
  if(role!=='admin')return;
  $('appUpdateCheck')?.click?.();
  $('appUpdateStatus')?.scrollIntoView?.({block:'center',behavior:'smooth'});
 }
 function detailsChanged(isOpen){
  if(role!=='admin')return;
  try{localStorage.setItem('firsthyundai-admin-developer-expanded',isOpen?'1':'0');}catch(e){}
 }
 function selfTest(){
  if(role!=='admin')return;
  const ids=['nav','overview','trades','officetel','complexes','new','news','contracts','appUpdateCheck','adminCenter'];
  const missing=ids.filter(id=>!$(id));
  $('adminSelfTestResult').textContent=missing.length?'화면 요소 확인 필요: '+missing.join(', '):
   '기본 화면 10곳 확인 · API 접속이나 게시자료 정확성 검사와는 별개입니다.';
 }
 function publicError(text){publicIssue=String(text||'').slice(0,100);render();}
 window.FirstHyundaiAdminCenter={render,refresh,checkUpdate,detailsChanged,selfTest,publicError,
  _test:{classify,rows}};
 if(role==='admin'){
  render();
  try{if(localStorage.getItem('firsthyundai-admin-developer-expanded')==='1')$('adminDeveloperDetails').open=true;}catch(e){}
 }
})();