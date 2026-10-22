/* v2.0.17: GitHub-verified APK, in-app download, Android installation consent. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const native=window.FirstHyundaiNative;
 const banner=$('appUpdateBanner'),text=$('appUpdateBannerText');
 const check=$('appUpdateCheck'),install=$('appUpdateInstall'),dismiss=$('appUpdateDismiss');
 const status=$('appUpdateStatus');
 if(!banner||!check||!install||!status)return;
 let ready=false,working=false;
 function request(){
  if(working)return;
  ready=false;
  if(!native?.checkForAppUpdate){status.textContent='안드로이드 앱에서 확인할 수 있습니다.';return;}
  status.textContent='새 버전 확인 중…';
  try{native.checkForAppUpdate();}
  catch(e){status.textContent='버전 확인에 실패했습니다.';}
 }
 function result(data){
  const version=String(data?.newVersion||'');
  const available=data?.available===true&&data?.state==='available'&&
    /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version);
  ready=available;banner.hidden=!available;
  if(available){
   text.textContent='새 버전 v'+version+'이 나왔습니다.';
   status.textContent='새 버전 v'+version+' 이용 가능';
  }else if(data?.state==='latest')status.textContent='현재 최신 버전입니다.';
  else status.textContent='새 버전을 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.';
  install.disabled=false;check.disabled=false;working=false;
 }
 function progress(data){
  const phase=String(data?.phase||''),message=String(data?.message||'');
  if(phase==='downloading'){
   working=true;
   const n=Number(data?.percent);
   status.textContent='APK 다운로드 중'+(Number.isFinite(n)&&n>=0&&n<=100?' · '+Math.floor(n)+'%':'');
  }else if(phase==='verifying'){
   status.textContent='APK 서명과 버전을 확인하고 있습니다…';
  }else if(phase==='installing'){
   working=false;status.textContent='안드로이드 설치 확인창에서 업데이트를 승인해 주세요.';
  }else if(phase==='permission'){
   working=false;status.textContent='설치 허용을 켠 뒤 다시 업데이트를 누르세요.';
  }else if(phase==='error'){
   working=false;status.textContent=message||'업데이트에 실패했습니다. 다시 시도해 주세요.';
  }
  install.disabled=working;check.disabled=working;
 }
 window.onFirstHyundaiAppUpdate=result;
 window.onFirstHyundaiAppUpdateProgress=progress;
 check.addEventListener('click',request);
 install.addEventListener('click',()=>{
  if(!ready||banner.hidden||working)return;
  if(!native?.downloadAndInstallVerifiedAppUpdate){
   status.textContent='현재 버전은 앱 내부 업데이트를 지원하지 않습니다.';return;
  }
  working=true;install.disabled=true;check.disabled=true;
  status.textContent='업데이트 다운로드를 준비 중입니다…';
  try{native.downloadAndInstallVerifiedAppUpdate();}
  catch(e){working=false;install.disabled=false;check.disabled=false;
   status.textContent='업데이트 요청에 실패했습니다.';}
 });
 dismiss.addEventListener('click',()=>{banner.hidden=true;});
 request();
})();
