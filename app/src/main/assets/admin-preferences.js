/* v2.0.95: administrator-managed local UI preferences.
   No change to persisted role names, authentication or customer data. */
(function(){
 'use strict';
 const KEY='firsthyundai-ui-preferences-v1';
 const get=id=>document.getElementById(id);
 const defaults=Object.freeze({schema:1,start:'nearby',density:'standard',reading:'standard',
  motion:'full',contrast:'standard'});
 const allowed={
  start:['nearby','trades','new','complexes','news','contracts','overview','officetel'],
  density:['standard','compact'],reading:['standard','large'],
  motion:['full','reduced'],contrast:['standard','high']
 };
 const fields={start:'adminDefaultPage',density:'adminListDensity',
  reading:'adminReadingSize',motion:'adminMotionStyle',contrast:'adminContrastMode'};
 let state={...defaults},popupBackup=null;
 function readStorage(){
  try{
   const raw=localStorage.getItem(KEY);
   if(!raw||raw.length>4096)return {...defaults};
   const value=JSON.parse(raw);
   if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==1)return {...defaults};
   const normalized={...defaults};
   for(const key of Object.keys(allowed)){
    if(allowed[key].includes(value[key]))normalized[key]=value[key];
   }
   return normalized;
  }catch(e){return {...defaults}}
 }
 function writeState(value){
  try{localStorage.setItem(KEY,JSON.stringify(value));return true}
  catch(e){return false}
 }
 function allowedEditor(){return typeof role!=='undefined'&&role==='admin'}
 function apply(){
  // Data attributes change presentation only, and are safe in normal mode.
  const node=document.body;
  if(!node?.setAttribute)return;
  node.setAttribute('data-list-density',state.density);
  node.setAttribute('data-reading-size',state.reading);
  node.setAttribute('data-app-motion',state.motion);
  node.setAttribute('data-app-contrast',state.contrast);
 }
 function render(){
  if(!allowedEditor())return;
  for(const [key,id] of Object.entries(fields)){
   const input=get(id);if(input)input.value=state[key];
  }
  const alert=get('adminTradePopupEnabled');
  if(alert)alert.checked=Boolean(window.FirstHyundaiTradeAlerts?.enabled?.());
 }
 function message(text){const out=get('adminPreferencesStatus');if(out)out.textContent=text}
 function commit(next,info){
  if(!allowedEditor())return false;
  if(!writeState(next)){message('저장 공간에 접근할 수 없어 화면 설정을 저장하지 못했습니다.');return false}
  state=next;apply();render();message(info||'이 기기의 화면 설정을 저장했습니다.');return true;
 }
 function set(key,value){
  if(!allowedEditor()||!Object.prototype.hasOwnProperty.call(allowed,key)||!allowed[key].includes(value))return false;
  return commit({...state,[key]:value},'변경 사항을 바로 적용했습니다. 일반모드 시작 화면은 다음 전환 또는 앱 실행 시 적용됩니다.');
 }
 function setTradePopup(enabled){
  if(!allowedEditor()||typeof enabled!=='boolean')return;
  const alerts=window.FirstHyundaiTradeAlerts;
  if(typeof alerts?.setEnabled!=='function'){message('알림 제어 기능이 준비되지 않았습니다.');return}
  alerts.setEnabled(enabled);render();
  message('이 기기의 관심단지 팝업 알림 '+(enabled?'사용':'중지')+' 상태를 변경했습니다.');
 }
 function reset(){
  if(!allowedEditor())return false;
  if(typeof confirm==='function'&&!confirm('이 기기의 화면 표시 설정 다섯 가지만 기본값으로 복원할까요? 알림·메모·보안 설정은 그대로 유지됩니다.'))return false;
  return commit({...defaults},'화면 설정 다섯 가지를 기본값으로 복원했습니다. 알림과 자료는 변경하지 않았습니다.');
 }
 function backupValue(){
  return {schema:1,type:'firsthyundai-ui-settings',
   preferences:{...state},tradePopup:Boolean(window.FirstHyundaiTradeAlerts?.enabled?.())};
 }
 function exportSettings(){
  if(!allowedEditor())return;
  const box=get('adminSettingsExport');
  const holder=get('adminPrefBackupDetails');
  if(!box)return;
  if(holder)holder.open=true;
  box.value=JSON.stringify(backupValue(),null,2);
  box.focus?.();box.select?.();
  message('설정 JSON을 만들고 선택했습니다. 복사하여 개인 저장소에 보관할 수 있습니다.');
 }
 function validateImport(raw){
  if(typeof raw!=='string'||raw.length>4096)throw Error('설정 데이터는 4KB 이하의 JSON이어야 합니다.');
  let value;try{value=JSON.parse(raw)}catch(e){throw Error('올바른 JSON 형식이 아닙니다.')}
  if(!value||value.type!=='firsthyundai-ui-settings'||value.schema!==1||
   !value.preferences||value.preferences.schema!==1||typeof value.tradePopup!=='boolean')throw Error('퍼스트현대 설정 백업 형식이 아닙니다.');
  const p=value.preferences;
  const result={...defaults};
  for(const key of Object.keys(allowed)){
   if(!allowed[key].includes(p[key]))throw Error('지원하지 않는 설정 값: '+key);
   result[key]=p[key];
  }
  return {preferences:result,tradePopup:value.tradePopup};
 }
 function importSettings(){
  if(!allowedEditor())return false;
  let imported;
  try{imported=validateImport(get('adminSettingsImport')?.value||'')}
  catch(e){message(e.message);return false}
  if(typeof confirm==='function'&&!confirm('이 기기의 화면 설정과 팝업 알림 설정을 백업 값으로 바꿀까요?'))return false;
  if(!commit(imported.preferences,'설정 백업을 복원했습니다.'))return false;
  setTradePopup(imported.tradePopup);
  message('화면 설정과 팝업 알림 설정을 이 기기에 복원했습니다.');
  return true;
 }
 state=readStorage();apply();
 window.FirstHyundaiUIOptions={get:()=>({...state}),apply,render,set,setTradePopup,reset,
  exportSettings,importSettings,_test:{validateImport,backupValue}};
 render();
})();