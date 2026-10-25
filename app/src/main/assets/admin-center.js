/* FirstHyundai v2.0.94 · Local administrator operations & diagnostics.
   Read public snapshots only. Never store secrets, contract details or customer records.
   A healthy published snapshot is NOT proof the upstream API is reachable. */
(function(){
 'use strict';
 const get=id=>document.getElementById(id);
 const PREF='firsthyundai-admin-freshness-v1';
 const EVENTS='firsthyundai-admin-audit-v1';
 const LEVELS={strict:0.6,normal:1,relaxed:2};
 const SOURCES=[
  {key:'trades',name:'아파트 실거래',group:'core',page:'trades',hours:48},
  {key:'new_trades',name:'신규 공개 실거래',group:'core',page:'new',hours:48},
  {key:'complexes',name:'아파트 정보',group:'core',page:'complexes',hours:720},
  {key:'news',name:'송도 뉴스',group:'core',page:'news',hours:9},
  {key:'office_sales',name:'오피스텔 매매',group:'public',page:'officetel',hours:72},
  {key:'office_rents',name:'오피스텔 전월세',group:'public',page:'officetel',hours:72},
  {key:'subscriptions',name:'청약·분양',group:'public',page:'news',hours:72},
  {key:'schools',name:'학교 기본정보',group:'public',page:'complexes',hours:336}
 ];
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const storage=()=>{try{return localStorage}catch(e){return null}};
 const read=k=>{try{return storage()?.getItem(k)||''}catch(e){return ''}};
 const write=(k,v)=>{try{storage()?.setItem(k,v);return true}catch(e){return false}};
 let level=LEVELS[read(PREF)]?read(PREF):'normal';
 let publicIssue='',checkNote='',busy=false;
 let audit=[],openDetails=new Set(),lastReport='';
 try{
  const parsed=JSON.parse(read(EVENTS)||'[]');
  if(Array.isArray(parsed))audit=parsed.filter(e=>e&&SOURCES.some(s=>s.key===e.key)||e&&e.key==='all')
   .filter(e=>['check','retry','settings'].includes(e.action)&&['done','failed','changed'].includes(e.result))
   .slice(0,24).map(e=>({time:String(e.time||'').slice(0,30),key:e.key,action:e.action,result:e.result}));
 }catch(e){}
 function permitted(){return role==='admin'}
 function log(action,key,result){
  if(!permitted())return;
  audit.unshift({time:new Date().toISOString(),key,action,result});
  audit=audit.slice(0,24);write(EVENTS,JSON.stringify(audit));
 }
 function payloadFor(def){return def.group==='core'?remote?.[def.key]:publicServices?.[def.key]}
 function issueFor(def){return def.group==='core'?(issues?.[def.key]||''):publicIssue}
 function ageHours(timestamp,now=Date.now()){
  if(!timestamp)return null;
  const parsed=Date.parse(String(timestamp));
  if(!Number.isFinite(parsed))return null;
  return (now-parsed)/3600000;
 }
 function qualityIssues(rows,key){
  if(!Array.isArray(rows))return 0;
  const count=Math.min(rows.length,500);
  let invalid=0,seen=new Set();
  for(let i=0;i<count;i++){
   const row=rows[i];
   if(!row||typeof row!=='object'){invalid++;continue}
   if((key==='trades'||key==='new_trades')&&
    (!['매매','전세','월세'].includes(row.type)||!row.building||!row.contract_date))invalid++;
   else if(key==='news'&&!row.title)invalid++;
   else if(key==='complexes'&&(!row.id||!row.label))invalid++;
   if(key==='complexes'&&row.id){
    if(seen.has(row.id))invalid++;seen.add(row.id);
   }
  }
  return invalid;
 }
 function classify(payload,issue,kind,now=Date.now()){
  const def=SOURCES.find(x=>x.key===kind)||{key:kind,hours:72};
  const rows=kind==='news'?payload?.briefs:payload?.records;
  const count=Array.isArray(rows)?rows.length:null;
  const time=payload?.checked_at||payload?.updated_at||payload?.last_verified||'';
  const age=ageHours(time,now);
  const base={count,time,age,threshold:Math.round(def.hours*LEVELS[level]*10)/10,quality:qualityIssues(rows,kind),
   errorCount:Array.isArray(payload?.errors)?payload.errors.length:0,
   missingCount:Array.isArray(payload?.missing_buckets)?payload.missing_buckets.length:0};
  if(issue)return {...base,tone:'warn',label:'조회 오류',desc:'게시자료 재확인 실패',action:'자료 다시 확인'};
  if(!payload)return {...base,tone:'pending',label:'미확인',desc:'아직 자료를 읽지 못함',action:'자료 다시 확인'};
  if(payload.state==='not_started')return {...base,tone:'pending',label:'수집 전',desc:'초기 수집 대기',action:'수집 실행 기록 확인'};
  if(payload.state==='partial'||base.errorCount||base.missingCount)
   return {...base,tone:'warn',label:'일부 오류',desc:'수집 결과에 오류 또는 누락 기록이 있습니다',action:'수집 실행 기록 확인'};
  if(payload.state&&!['ok','verified','ready','verified_partial'].includes(payload.state))
   return {...base,tone:'pending',label:'연동 대기',desc:'게시 상태: '+String(payload.state).slice(0,34),action:'연결 설정 확인'};
  if(count===null)return {...base,tone:'pending',label:'목록 확인',desc:'게시 데이터 목록 형식 확인 필요',action:'원본 수집 확인'};
  if(payload.schema_version!==undefined&&payload.schema_version!==1)
   return {...base,tone:'warn',label:'형식 오류',desc:'지원하지 않는 데이터 형식',action:'원본 수집 확인'};
  if(base.quality)return {...base,tone:'warn',label:'자료 점검',desc:'필수 필드 또는 식별자 검사에 '+base.quality+'건 확인 필요',action:'원본 수집 확인'};
  if(age!==null&&age< -3)return {...base,tone:'warn',label:'시각 점검',desc:'게시 시각이 기기보다 미래입니다',action:'기기 시간 확인'};
  if(age!==null&&age>base.threshold)
   return {...base,tone:'warn',label:'갱신 지연',desc:'게시 시각이 설정된 기준보다 오래됐습니다',action:'수집 실행 기록 확인'};
  if(payload.state==='verified_partial')
   return {...base,tone:'pending',label:'부분 검증',desc:'검증된 일부 자료만 게시됐습니다',action:'출처 검증 상태 확인'};
  return {...base,tone:'ok',label:'게시 확인',desc:count+'건 게시 · 원천 API 상태는 별도',action:'자료 화면 열기'};
 }
 function rows(now=Date.now()){
  return SOURCES.map(d=>({...d,...classify(payloadFor(d),issueFor(d),d.key,now)}));
 }
 function timeText(t){
  if(!t)return '게시 시각 미표시';
  try{return compactTradeCollectedAt(t)}catch(e){return String(t).slice(0,22)}
 }
 function ageText(age){
  if(age===null)return '시각 미확인';
  if(age<0)return '기기 시간보다 미래';
  if(age<1)return Math.round(age*60)+'분 전';
  if(age<48)return Math.floor(age)+'시간 전';
  return Math.floor(age/24)+'일 전';
 }
 function reason(row){
  if(row.tone==='ok')return '현재 조건에서는 게시자료가 확인됩니다. 원천 API 실시간 연결 상태는 알 수 없습니다.';
  if(row.label==='갱신 지연')return '기준 '+row.threshold+'시간을 초과했습니다. 자동 수집 작업의 실행 기록과 최근 성공 시점을 확인하세요.';
  if(row.label==='부분 검증')return '일부만 검증된 데이터입니다. 전체 자료 확보와 공식 출처 확인이 필요합니다.';
  if(row.label==='연동 대기')return 'API 승인·연동 대기일 수 있습니다. 현재 상태에서 0건으로 처리하지 않습니다.';
  if(row.label==='조회 오류')return '게시자료 다운로드/형식 검사에 문제가 있었습니다. 앱은 기존 자료를 유지합니다.';
  return row.desc;
 }
 function render(){
  if(!permitted()||!get('adminCenter'))return;
  const items=rows(),ok=items.filter(x=>x.tone==='ok').length,
   bad=items.filter(x=>x.tone==='warn').length,pending=items.length-ok-bad;
  const status=get('adminSystemStatus');
  status.textContent=bad?'점검 필요':pending?'일부 확인 전':'게시자료 확인';
  status.className='adminStateBadge '+(bad?'warn':pending?'pending':'ok');
  get('adminSummary').innerHTML=[['게시 확인',ok],['점검 필요',bad],['미수집·대기',pending]].map(([text,n])=>
   '<div class="adminMetric"><strong>'+n+'</strong><small>'+text+'</small></div>').join('');
  get('adminInstalledVersion').textContent=installedAppVersionLabel(window.FirstHyundaiNative);
  get('adminCheckNote').textContent=checkNote||
   '게시자료 기록 기준입니다. 게시 확인이 공공 API 실시간 정상 작동을 의미하지는 않습니다.';
  window.FirstHyundaiUIOptions?.render?.();
  const levelSelect=get('adminFreshnessLevel');
  if(levelSelect&&levelSelect.value!==level)levelSelect.value=level;
  const net=get('adminConnectionState');
  if(net){
   const connected=typeof navigator!=='undefined'&&typeof navigator.onLine==='boolean'?navigator.onLine:null;
   net.textContent='기기 네트워크 표시: '+(connected===true?'온라인':connected===false?'오프라인':'확인 불가')+
    ' · API 연결 테스트가 아닙니다.';
  }
  const attention=items.filter(x=>x.tone!=='ok');
  get('adminAttention').innerHTML=attention.length?attention.slice(0,5).map(x=>
   '<button type="button" class="adminAttentionItem" onclick="FirstHyundaiAdminCenter.expand(\''+x.key+'\')">'+
   '<span class="adminStateBadge '+x.tone+'">'+safe(x.label)+'</span><span>'+safe(x.name)+
   ' · '+safe(x.desc)+'</span><span aria-hidden="true">›</span></button>').join(''):
   '<p class="tiny">현재 게시자료 기준으로 별도 점검 항목이 없습니다.</p>';
  get('adminFeeds').innerHTML=items.map(x=>
   '<details class="adminFeedDetail" '+(openDetails.has(x.key)?'open ':'')+
   'ontoggle="FirstHyundaiAdminCenter.detailToggled(\''+x.key+'\',this.open)">'+
   '<summary><span class="adminFeedCopy"><strong>'+safe(x.name)+'</strong><small>'+
    safe(x.count===null?'집계 미확인':Number(x.count).toLocaleString('ko-KR')+'건 게시')+
    ' · '+safe(ageText(x.age))+'</small></span><span class="adminStateBadge '+x.tone+'">'+safe(x.label)+'</span></summary>'+
   '<div class="adminFeedMore"><p>'+safe(reason(x))+'</p>'+
   '<p>게시 시각: '+safe(timeText(x.time))+' · 감시 기준: '+x.threshold+'시간</p>'+
   (x.quality?'<p>최대 500건 샘플 필수 항목 확인: '+x.quality+'건</p>':'')+
   (x.errorCount||x.missingCount?'<p>원본 오류 표기 '+x.errorCount+'개 · 수집 누락 표기 '+x.missingCount+'개</p>':'')+
   '<div class="adminFeedActions"><button type="button" onclick="FirstHyundaiAdminCenter.retry(\''+x.key+'\')">게시자료 재확인</button>'+
   '<button type="button" onclick="FirstHyundaiAdminCenter.go(\''+x.key+'\')">해당 화면 열기</button></div></div></details>').join('');
  get('adminDiagnosticDetails').innerHTML=
   '<p>진단은 읽기 전용이며 공개 데이터의 건수·상태·시각만 사용합니다.</p>'+
   items.map(x=>'<p>'+safe(x.name)+' · '+safe(x.label)+' · '+safe(ageText(x.age))+
   ' · '+safe(x.count===null?'미집계':x.count+'건')+'</p>').join('');
  get('adminAuditHistory').innerHTML=audit.length?audit.slice(0,12).map(x=>
   '<div class="adminAuditItem"><time>'+safe(x.time.replace('T',' ').slice(0,19))+'</time>'+
   '<span>'+safe((SOURCES.find(s=>s.key===x.key)?.name)||'전체 게시자료')+
   ' · '+safe(x.action==='retry'?'개별 점검':x.action==='settings'?'감시 기준 변경':'전체 점검')+
   ' · '+safe(x.result==='failed'?'실패':x.result==='changed'?'변경':'완료')+'</span></div>').join(''):
   '<p class="tiny">아직 저장된 관리자 점검 기록이 없습니다.</p>';
 }
 function detailToggled(key,open){
  if(!SOURCES.some(x=>x.key===key)||!permitted())return;
  if(open)openDetails.add(key);else openDetails.delete(key);
 }
 function expand(key){
  if(!permitted()||!SOURCES.some(x=>x.key===key))return;
  openDetails.add(key);render();
  const node=get('adminFeeds')?.querySelector('details[open]');
  node?.scrollIntoView?.({behavior:'smooth',block:'center'});
 }
 function go(key){
  if(!permitted())return;
  const def=SOURCES.find(s=>s.key===key);
  if(!def)return;
  if(key==='subscriptions')switchPage('news');
  else switchPage(def.page);
 }
 async function retry(key){
  if(!permitted()||busy)return;
  const def=SOURCES.find(x=>x.key===key);if(!def)return;
  busy=true;checkNote=def.name+' 게시자료 재확인 중…';render();
  let success=false;
  try{
   if(def.group==='core'){const result=await refreshOne(key,true);success=Boolean(result?.ok);}
   else{await refreshPublicServices(true);success=!publicIssue&&Boolean(payloadFor(def));}
  }catch(e){success=false}
  busy=false;log('retry',key,success?'done':'failed');
  checkNote=def.name+(success?' 게시자료 재확인 완료 · 신규 원천 수집은 실행하지 않았습니다.':' 게시자료 확인 실패. 이전 자료는 유지됩니다.');
  render();
 }
 async function refresh(){
  if(!permitted()||busy)return;
  busy=true;checkNote='전체 게시자료를 재확인하는 중…';render();
  let success=false;
  try{
   const [main]=await Promise.all([refreshAll(true),refreshPublicServices(true)]);
   success=Array.isArray(main)&&main.every(x=>x.ok||x.pending)&&!publicIssue;
  }catch(e){success=false}
  busy=false;log('check','all',success?'done':'failed');
  checkNote=(success?'전체 게시자료 확인 작업 완료':'일부 게시자료 재확인 실패')+
   ' · '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
  render();
 }
 function checkUpdate(){
  if(!permitted())return;
  get('appUpdateCheck')?.click?.();
  get('appUpdateStatus')?.scrollIntoView?.({block:'center',behavior:'smooth'});
 }
 function openAlerts(){
  if(!permitted())return;
  window.FirstHyundaiTradeAlerts?.openSettings?.();
 }
 function levelChanged(value){
  if(!permitted()||!LEVELS[value])return;
  level=value;write(PREF,level);log('settings','all','changed');render();
 }
 function resetLevel(){
  if(!permitted())return;
  if(typeof confirm==='function'&&!confirm('관리센터의 자료 갱신 경고 기준만 기본값으로 되돌릴까요? 다른 앱 설정이나 자료는 변경하지 않습니다.'))return;
  level='normal';try{storage()?.removeItem(PREF)}catch(e){}
  log('settings','all','changed');render();
 }
 function detailsChanged(open){
  if(!permitted())return;
  write('firsthyundai-admin-developer-expanded',open?'1':'0');
 }
 function selfTest(){
  if(!permitted())return;
  const ids=['nav','overview','trades','officetel','complexes','new','news','contracts','appUpdateCheck','adminCenter'];
  const missing=ids.filter(id=>!get(id));
  get('adminSelfTestResult').textContent=missing.length?'화면 요소 확인 필요: '+missing.join(', '):
   '기본 화면 10곳 확인 · API 접속 또는 원천 데이터 정확성 검증은 아닙니다.';
 }
 function reportText(){
  if(!permitted())return '';
  const data=rows();
  // Do not include raw errors, repository URL, keys, user records or contract data.
  const report=[
   '퍼스트현대 시스템 진단 요약 (공개 자료의 상태 정보만)',
   '생성 시각: '+new Date().toISOString(),
   '버전: '+installedAppVersionLabel(window.FirstHyundaiNative),
   '신선도 설정: '+({strict:'민감',normal:'기본',relaxed:'여유'}[level]),
   '원천 API 실시간 연결은 확인하지 않음',
   ...data.map(r=>r.name+' | '+r.label+' | '+(r.count===null?'집계 불가':r.count+'건')+
    ' | 게시 '+(r.time?String(r.time).slice(0,25):'시각 미확인')+
    ' | 오류표기 '+r.errorCount+'개/누락표기 '+r.missingCount+'개')
  ];
  return report.join('\n');
 }
 function showReportFallback(report){
  const box=get('adminReportFallback');
  if(!box)return;
  box.hidden=false;box.value=report;box.focus?.();box.select?.();
  get('adminCopyStatus').textContent='자동 복사를 지원하지 않아 진단 텍스트를 선택했습니다. 길게 눌러 복사할 수 있습니다.';
 }
 async function copyReport(){
  if(!permitted())return;
  const report=reportText();lastReport=report;
  try{
   if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(report);
    get('adminCopyStatus').textContent='민감한 원본 데이터 없이 진단 요약을 복사했습니다.';
    return;
   }
  }catch(e){}
  showReportFallback(report);
 }
 function clearAudit(){
  if(!permitted())return;
  if(typeof confirm==='function'&&!confirm('관리센터의 로컬 점검 이력만 삭제할까요? 실제 자료와 백업 파일은 삭제하지 않습니다.'))return;
  audit=[];try{storage()?.removeItem(EVENTS)}catch(e){}
  render();
 }
 function publicError(text){publicIssue=String(text||'').slice(0,90);render();}
 window.FirstHyundaiAdminCenter={
  render,refresh,retry,expand,go,detailToggled,checkUpdate,openAlerts,
  levelChanged,resetLevel,detailsChanged,selfTest,copyReport,clearAudit,publicError,
  _test:{classify,rows,ageHours,qualityIssues,reportText}
 };
 if(permitted()){
  render();
  try{if(read('firsthyundai-admin-developer-expanded')==='1')get('adminDeveloperDetails').open=true}catch(e){}
 }
})();