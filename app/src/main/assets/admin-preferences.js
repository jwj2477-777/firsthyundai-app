/* v2.1.02: administrator-managed office-wide UI preferences.
   No change to persisted role names, authentication or customer data. */
(function(){
 'use strict';
 const KEY='firsthyundai-ui-preferences-v1';
 const get=id=>document.getElementById(id);
 const defaults=Object.freeze({schema:1,start:'nearby',density:'standard',reading:'standard',
  motion:'full',contrast:'standard',quickOrder:'standard',accent:'brand',
  tradeAmount:'standard',cancelled:'standard',memoOrder:'newest',
  memoCompleted:'hide',memoRefresh:'45',memoClock:'12',memoPhones:'on',
  tapSize:'standard',memoLayout:'standard',memoAlerts:'on',
  theme:'default',themeMode:'manual',weatherEffect:'none'});
 const allowed={
  start:['nearby','trades','new','complexes','news','contracts','overview','officetel','officeBoard'],
  density:['standard','compact','roomy'],reading:['standard','large','xlarge'],
  motion:['full','reduced'],contrast:['standard','high'],
  quickOrder:['standard','contractsFirst','memoFirst'],accent:['brand','teal','bronze'],
  tradeAmount:['standard','bold'],cancelled:['standard','subtle'],
  memoOrder:['newest','oldest'],memoCompleted:['hide','show'],
  memoRefresh:['30','45','120'],memoClock:['12','24'],memoPhones:['on','off'],
  tapSize:['standard','large'],memoLayout:['standard','compact','roomy'],memoAlerts:['on','off'],
  theme:['default','spring','summer','autumn','winter'],themeMode:['manual','season'],
  weatherEffect:['none','rain','snow','auto']
 };
 const fields={start:'adminDefaultPage',density:'adminListDensity',
  reading:'adminReadingSize',motion:'adminMotionStyle',contrast:'adminContrastMode',
  quickOrder:'adminQuickOrder',accent:'adminAccentStyle',tradeAmount:'adminTradeAmountStyle',
  cancelled:'adminCancelledStyle',memoOrder:'adminMemoOrder',memoCompleted:'adminMemoCompleted',
  memoRefresh:'adminMemoRefresh',memoClock:'adminMemoClock',memoPhones:'adminMemoPhones',
  tapSize:'adminTapSize',memoLayout:'adminMemoLayout',memoAlerts:'adminMemoAlerts',
  theme:'adminTheme',themeMode:'adminThemeMode',weatherEffect:'adminWeatherEffect'};
 const LEGACY_FIELDS=new Set(['start','density','reading','motion','contrast']);
 let state={...defaults},popupBackup=null,undoSnapshot=null,lastChangeText='';
 function popupState(){return Boolean(window.FirstHyundaiTradeAlerts?.enabled?.())}
 function noteChange(label){
  const result=get('adminLastChange'),button=get('adminUndoLast');
  if(label)lastChangeText=label;
  if(result)result.textContent=lastChangeText||'변경된 설정이 여기에 표시됩니다.';
  if(button)button.disabled=!undoSnapshot;
 }
 function rememberUndo(){
  undoSnapshot={preferences:{...state},tradePopup:popupState()};
 }
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
  node.setAttribute('data-shortcut-order',state.quickOrder);
  node.setAttribute('data-ui-accent',state.accent);
  node.setAttribute('data-trade-amount',state.tradeAmount);
  node.setAttribute('data-cancelled-style',state.cancelled);
  node.setAttribute('data-touch-size',state.tapSize);
  node.setAttribute('data-memo-layout',state.memoLayout);
  try{window.FirstHyundaiNative?.setOfficeMemoNotificationsEnabled?.(state.memoAlerts==='on')}catch(e){}
  window.FirstHyundaiOfficeBoard?.settingsChanged?.();
  window.FirstHyundaiThemes?.configure?.(state);
 }
 function render(){
  if(!allowedEditor())return;
  for(const [key,id] of Object.entries(fields)){
   const input=get(id);if(input)input.value=state[key];
  }
  const alert=get('adminTradePopupEnabled');
  if(alert)alert.checked=popupState();
  noteChange();
 }
 function message(text){const out=get('adminPreferencesStatus');if(out)out.textContent=text}
 function commit(next,info){
  if(!allowedEditor())return false;
  if(!writeState(next)){message('저장 공간에 접근할 수 없어 화면 설정을 저장하지 못했습니다.');return false}
  rememberUndo();state=next;apply();render();noteChange(info||'화면 설정 변경됨');message(info||'변경 사항을 이 기기에 적용하고 공통 서버에 게시합니다.');
  window.FirstHyundaiSharedSettings?.changed?.();return true;
 }
 function set(key,value){
  if(!allowedEditor()||!Object.prototype.hasOwnProperty.call(allowed,key)||!allowed[key].includes(value))return false;
  if(state[key]===value&&!(key==='theme'&&state.themeMode==='season'))return true;
  return commit({...state,[key]:value,...(key==='theme'?{themeMode:'manual'}:{})},'설정 변경: '+key+' · 이 휴대폰 적용 후 공통 서버 게시 요청');
 }
 function setTradePopup(enabled){
  if(!allowedEditor()||typeof enabled!=='boolean')return;
  const alerts=window.FirstHyundaiTradeAlerts;
  if(typeof alerts?.setEnabled!=='function'){message('알림 제어 기능이 준비되지 않았습니다.');return}
  if(popupState()===enabled)return;
  rememberUndo();alerts.setEnabled(enabled);render();noteChange('관심단지 팝업 '+(enabled?'사용':'중지'));
  message('관심단지 팝업 알림 '+(enabled?'사용':'중지')+' 상태를 공통 서버에 게시합니다.');
  window.FirstHyundaiSharedSettings?.changed?.();
 }
 function preset(which){
  if(!allowedEditor())return false;
  const sets={
   comfortable:{density:'roomy',reading:'xlarge',contrast:'high',tapSize:'large'},
   compact:{density:'compact',reading:'standard',contrast:'standard',tapSize:'standard'},
   default:{density:'standard',reading:'standard',contrast:'standard',tapSize:'standard'}
  };
  if(!Object.prototype.hasOwnProperty.call(sets,which))return false;
  const title={comfortable:'편하게 보기',compact:'한눈에 보기',default:'화면 기본형'}[which];
  return commit({...state,...sets[which]},title+' 프리셋 적용 · 공통 서버에 게시합니다.');
 }
 function undo(){
  if(!allowedEditor()||!undoSnapshot)return false;
  const previous=undoSnapshot;
  if(!writeState(previous.preferences)){message('이전 화면 설정을 저장하지 못했습니다.');return false}
  undoSnapshot=null;
  state={...previous.preferences};apply();
  const alerts=window.FirstHyundaiTradeAlerts;
  if(typeof alerts?.setEnabled==='function'&&popupState()!==previous.tradePopup)
   alerts.setEnabled(previous.tradePopup);
  lastChangeText='';render();noteChange('직전 변경 취소 완료');message('직전 변경을 취소했습니다. 이전 공통 설정을 게시합니다.');
  window.FirstHyundaiSharedSettings?.changed?.();return true;
 }
 function reset(){
  if(!allowedEditor())return false;
  if(typeof confirm==='function'&&!confirm('공통 화면·메모 표시 설정을 기본값으로 복원할까요? 실제 메모·거래자료·보안코드와 알림 권한은 유지됩니다.'))return false;
  return commit({...defaults},'공통 표시 설정이 기본값으로 복원됐습니다. 업무 자료는 변경하지 않았습니다.');
 }
 function applyShared(settings){
  let validated;
  try{validated=validateImport(JSON.stringify(settings))}catch(e){return false}
  // Remote updates are permitted in normal mode, but local writes stay admin-only.
  if(!writeState(validated.preferences))return false;
  undoSnapshot=null;lastChangeText='서버의 최신 공통 설정을 적용했습니다.';
  state=validated.preferences;apply();render();
  const alerts=window.FirstHyundaiTradeAlerts;
  if(typeof alerts?.enabled==='function'&&typeof alerts?.setEnabled==='function'&&
   alerts.enabled()!==validated.tradePopup)alerts.setEnabled(validated.tradePopup);
  return true;
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
   if(p[key]===undefined&&!LEGACY_FIELDS.has(key))continue;
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
 window.FirstHyundaiUIOptions={get:()=>({...state}),apply,render,set,setTradePopup,reset,preset,undo,
  exportSettings,importSettings,applyShared,_test:{validateImport,backupValue}};
 render();
})();
