/* v2.0.14: native-verified release check; never installs without Android's approval. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const native=window.FirstHyundaiNative;
 const banner=$('appUpdateBanner'),text=$('appUpdateBannerText');
 const check=$('appUpdateCheck'),install=$('appUpdateInstall'),dismiss=$('appUpdateDismiss');
 const status=$('appUpdateStatus');
 if(!banner||!check||!install||!status)return;
 let checked=false;
 function request(){
  if(!native?.checkForAppUpdate){status.textContent='안드로이드 앱에서 확인할 수 있습니다.';return;}
  status.textContent='새 버전 확인 중…';
  try{native.checkForAppUpdate();}
  catch(error){status.textContent='버전 확인에 실패했습니다.';}
 }
 function result(data){
  const version=String(data?.newVersion||'');
  const validVersion=/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version);
  const available=data?.available===true&&data?.state==='available'&&validVersion;
  banner.hidden=!available;
  if(available){
   text.textContent='새 버전 v'+version+'이 나왔습니다.';
   status.textContent='새 버전 v'+version+' 이용 가능';
  }else if(data?.state==='latest'){
   status.textContent='현재 최신 버전입니다.';
  }else{
   status.textContent='새 버전을 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.';
  }
  checked=true;
 }
 window.onFirstHyundaiAppUpdate=result;
 check.addEventListener('click',request);
 install.addEventListener('click',()=>{
  if(!checked||banner.hidden)return;
  try{native?.openVerifiedAppUpdate?.();}
  catch(error){status.textContent='다운로드를 시작하지 못했습니다.';}
 });
 dismiss.addEventListener('click',()=>{banner.hidden=true;});
 request();
})();
