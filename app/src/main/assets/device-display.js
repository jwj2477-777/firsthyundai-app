/* Per-device display settings. Never synchronize this with administrator settings. */
(function(){
 'use strict';
 const modes=['standard','large','xlarge'];
 const names={standard:'표준 화면',large:'큰 글씨 화면',xlarge:'매우 큰 글씨 화면'};
 const KEY='firsthyundai-device-display-v1';
 const by=id=>document.getElementById(id);
 const native=window.FirstHyundaiNative;
 const safe=value=>modes.includes(value)?value:'standard';
 function saved(){
  try{
   if(typeof native?.getDeviceDisplayMode==='function')return safe(native.getDeviceDisplayMode());
   return safe(localStorage.getItem(KEY)||'standard');
  }catch(e){return 'standard'}
 }
 let current=saved();
 function render(){
  for(const button of document.querySelectorAll('[data-device-choice]'))
   button.setAttribute('aria-pressed',String(button.getAttribute('data-device-choice')===current));
  const message=by('deviceDisplayFeedback');
  if(message)message.textContent='이 휴대전화: '+names[current]+' 사용 중';
 }
 function choose(value,persist=true){
  value=safe(value);
  if(persist){
   try{
    if(typeof native?.setDeviceDisplayMode==='function'){
     if(native.setDeviceDisplayMode(value)!==true)throw Error('cannot save');
    }else localStorage.setItem(KEY,value);
   }catch(e){
    const status=by('deviceDisplayFeedback');
    if(status)status.textContent='화면 설정 저장에 실패했습니다. 다시 시도해 주세요.';
    return false;
   }
  }
  current=value;
  document.body?.setAttribute('data-device-display',value);
  render();
  window.FirstHyundaiNavCollapse?.update?.(true);
  return true;
 }
 function open(){
  render();
  try{by('deviceDisplayDialog')?.showModal?.()}catch(e){}
 }
 function close(){try{by('deviceDisplayDialog')?.close?.()}catch(e){}}
 for(const button of document.querySelectorAll('[data-device-choice]'))
  button.addEventListener('click',()=>choose(button.getAttribute('data-device-choice')));
 by('deviceDisplayClose')?.addEventListener('click',close);
 by('deviceDisplayDone')?.addEventListener('click',close);
 window.FirstHyundaiDeviceDisplay={open,close,choose,get:()=>current};
 choose(current,false);
})();