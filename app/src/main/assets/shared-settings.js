/* v2.0.96: public cross-device reads and authenticated native administrator publish. */
(function(){
 'use strict';
 const ENDPOINT='https://firsthyundai-shared-settings.jwj2477.workers.dev/settings';
 const node=id=>document.getElementById(id),native=window.FirstHyundaiNative;
 let sequence=0,requests=new Map(),revision='',lastFetch=0,publishing=false,
  pendingChanges=false,timer=null;
 function status(text,stamp){
  if(node('adminSharedSyncStatus'))node('adminSharedSyncStatus').textContent=text;
  if(stamp!==undefined&&node('adminSharedUpdatedAt'))node('adminSharedUpdatedAt').textContent=stamp;
 }
 function callNative(method,payload){
  return new Promise((resolve,reject)=>{
   const id='shared'+(++sequence);
   const timeout=setTimeout(()=>{if(!requests.has(id))return;requests.delete(id);reject(Error('서버 응답 시간 초과'))},20000);
   requests.set(id,{resolve:x=>{clearTimeout(timeout);resolve(x)},
    reject:e=>{clearTimeout(timeout);reject(e)}});
   try{
    if(method==='read')native.fetchSharedSettings(id);
    else native.publishSharedSettings(JSON.stringify(payload),id);
   }catch(e){clearTimeout(timeout);requests.delete(id);reject(e)}
  });
 }
 function delivered(result){
  const found=requests.get(result?.requestId);if(!found)return;
  requests.delete(result.requestId);
  if(result.ok)found.resolve(result.payload);
  else found.reject(new Error(result.error||'공통 설정 서버 연결 오류'));
 }
 window.onFirstHyundaiSharedSettingsFetched=delivered;
 window.onFirstHyundaiSharedSettingsPublished=delivered;
 function valid(doc){
  if(!doc||doc.schema!==1||doc.status!=='ok'||typeof doc.revision!=='string'||
   typeof doc.updated_at!=='string')return false;
  try{
   window.FirstHyundaiUIOptions?._test?.validateImport(JSON.stringify(doc.settings));
   return doc.settings?.type==='firsthyundai-ui-settings';
  }catch(e){return false}
 }
 function applied(doc){
  if(!valid(doc))return false;
  if(doc.revision===revision)return true;
  if(!window.FirstHyundaiUIOptions?.applyShared?.(doc.settings))return false;
  revision=doc.revision;
  return true;
 }
 async function refresh(){
  if(publishing||pendingChanges)return false;
  try{
   let doc;
   if(native?.fetchSharedSettings)doc=await callNative('read');
   else {
    const r=await fetch(ENDPOINT+'?check='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    doc=await r.json();
   }
   lastFetch=Date.now();
   if(doc?.status==='not_configured'){
    status('서버에 공통 설정이 아직 없습니다. 관리자에서 한번 게시해 주세요.');
    return false;
   }
   if(!applied(doc))throw Error('원격 설정 유효성 검사 실패');
   status('사무실 공통 설정 연결됨','최근 게시: '+doc.updated_at.slice(0,19).replace('T',' ')+' UTC');
   return true;
  }catch(e){
   status('공통 설정 서버 연결 실패 · 마지막으로 저장된 기기 설정을 유지합니다.');
   return false;
  }
 }
 function authReady(ready){
  if(ready===false)status('관리자 게시 인증을 받지 못했습니다. 서버를 확인하거나 관리자모드에 다시 로그인해 주세요.');
  else status('관리자 공통 설정 게시 인증 완료');
 }
 function changed(){
  if(typeof role==='undefined'||role!=='admin')return;
  pendingChanges=true;
  status('설정이 이 휴대폰에 적용됐습니다. 공통 서버에 게시 중…');
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;publishNow()},500);
 }
 async function publishNow(){
  if(typeof role==='undefined'||role!=='admin')return false;
  if(publishing){pendingChanges=true;return false;}
  if(!native?.publishSharedSettings){
   status('일반 브라우저에서는 공유 게시 불가 · 안드로이드 관리자 앱에서 이용하세요.');
   return false;
  }
  const value=window.FirstHyundaiUIOptions?._test?.backupValue?.();
  if(!value)return false;
  publishing=true;pendingChanges=false;
  status('사무실 공통 서버에 설정을 게시하고 있습니다…');
  try{
   const record=await callNative('write',value);
   if(!valid(record))throw Error('게시 검증 실패');
   revision=record.revision;
   status('공통 설정 게시 성공 · 부모님 휴대폰의 다음 동기화 때 적용됩니다.',
    '최근 게시: '+record.updated_at.slice(0,19).replace('T',' ')+' UTC');
   return true;
  }catch(e){
   pendingChanges=true;
   status('공통 설정 게시 실패 · 부모님 휴대폰에는 아직 적용되지 않았습니다. 게시 버튼으로 재시도해 주세요.');
   return false;
  }finally{
   publishing=false;
   if(pendingChanges&&timer===null&&!node('adminSharedSyncStatus')?.textContent?.includes('실패')){
    timer=setTimeout(()=>{timer=null;publishNow()},500);
   }
  }
 }
 window.FirstHyundaiSharedSettings={refresh,changed,publishNow,authReady,_test:{valid,applied}};
 if(typeof window.addEventListener==='function'){
  window.addEventListener('focus',()=>{if(Date.now()-lastFetch>20000)refresh()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastFetch>20000)refresh()});
  window.setInterval?.(()=>{if(!document.hidden)refresh()},120000);
 }
 refresh();
})();