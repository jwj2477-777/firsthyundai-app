/* One-tap correction of an approved office contract notice.
 * Sensitive snapshot: ONE Android Keystore-encrypted, member-local record.
 * No localStorage, network, browser cache or automatic cross-device sync. */
(function(){
'use strict';
const core=window.FirstHyundaiContracts;
if(!core)return;
const $=id=>document.getElementById('ct_'+id);
const text=id=>String($(id)?.value||'');
const FIELDS=['dealType','property','address','unit','price','monthlyRent','contractDeposit',
 'advance','interim','interimDate','interim2','interimDate2','contractDate','balanceDate',
 'balanceTime','exclusiveArea','supplyInfo','leaseStart','leaseEnd','leaseDuration',
 'bank','account','accountHolder','terms','cancellation','brokerFee','rough','specialMemo'];
const DATE_FIELDS=new Set(['contractDate','balanceDate','interimDate','interimDate2','leaseStart','leaseEnd']);
const MONEY_FIELDS=new Set(['price','contractDeposit','advance','interim','interim2','monthlyRent']);
const LABELS={balanceDate:'잔금일',contractDate:'계약일',interimDate:'1차 중도금 지급일',
 interimDate2:'2차 중도금 지급일',balanceTime:'잔금 시간',leaseStart:'입주일',
 leaseEnd:'임대차 종료일',price:'매매대금 / 보증금',contractDeposit:'계약금',
 interim:'1차 중도금',interim2:'2차 중도금',advance:'이번 송금액',
 monthlyRent:'월세',unit:'동·호수',property:'아파트·단지명',address:'소재지 주소',
 bank:'송금 은행',account:'송금 계좌번호',accountHolder:'예금주',leaseDuration:'임대차 기간',
 terms:'특약 문구',cancellation:'별도 해제·위약 합의',brokerFee:'별도 중개보수 합의'};
const NOTICE_LINES={balanceDate:['잔금일'],contractDate:['계약일'],
 interimDate:['1차 중도금 지급일','중도금 지급일'],interimDate2:['2차 중도금 지급일'],
 leaseStart:['입주일']};
const banner=n=>'※ 계약 안내 수정본 ('+n+'차 확인)\n이전에 전달한 계약 안내가 있다면 본 수정본을 기준으로 다시 확인해 주세요.\n\n';
let latest=null,revising=false,revision=1,modifications=[],loadedOnce=false;
const host=()=>window.FirstHyundaiNative||null;
const isApproved=()=>!$('imagePrimary')?.disabled&&!!text('preview').trim();
function safeSnapshot(input){
 try{
  const obj=typeof input==='string'?JSON.parse(input):input;
  if(!obj||obj.schema!==1||!Number.isInteger(obj.revision)||obj.revision<1||
    obj.revision>999||!obj.fields||typeof obj.fields!=='object'||
    typeof obj.preview!=='string'||!obj.preview.trim()||obj.preview.length>20000)return null;
  const keys=Object.keys(obj.fields);
  if(keys.some(k=>!FIELDS.includes(k)||typeof obj.fields[k]!=='string'||
    obj.fields[k].length>(k==='rough'?12000:k==='terms'?8000:k==='specialMemo'?6000:2600)))
   return null;
  return obj;
 }catch(e){return null;}
}
function createSnapshot(){
 const fields={};
 for(const key of FIELDS)fields[key]=text(key);
 return {schema:1,revision,approvedAt:Date.now(),fields,preview:text('preview')};
}
function refreshSaved(){
 const panel=$('resumePanel');
 if(!panel)return;
 const available=!!latest&&typeof host()?.getLastApprovedContract==='function';
 panel.classList?.toggle?.('hidden',!available);
}
function refreshControls(){
 const panel=$('revisionPanel');
 if(panel)panel.classList?.toggle?.('hidden',!(isApproved()||revising));
 const open=$('revisionStart');
 if(open)open.textContent=revising?'✎ 다른 항목도 수정하기':'✎ 확정된 계약내용 수정하기';
 const editor=$('revisionEditor');
 if(editor)editor.classList?.toggle?.('hidden',!revising);
}
function readLocal(){
 if(typeof host()?.getLastApprovedContract!=='function')return null;
 try{return safeSnapshot(host().getLastApprovedContract());}catch(e){return null;}
}
function onOpen(){
 // Never load a customer's private contract into the screen without a tap.
 if(!loadedOnce){latest=readLocal();loadedOnce=true;}
 refreshSaved();refreshControls();
}
function saveApproved(){
 const snapshot=safeSnapshot(createSnapshot());
 if(!snapshot)return false;
 latest=snapshot;
 const native=host();
 let saved=false;
 if(typeof native?.saveLastApprovedContract==='function'){
  try{saved=!!native.saveLastApprovedContract(JSON.stringify(snapshot));}catch(e){}
 }
 refreshSaved();
 const msg=$('revisionStatus');
 if(msg&&revising)msg.textContent='수정본의 내용을 확인했습니다. 이전 안내 대신 새 이미지를 확인·공유해 주세요.'+
  (saved?' 최근 확인본은 이 휴대전화에 암호화 보관됩니다.':' 저장이 불가능하므로 앱을 닫기 전에 새 이미지를 공유해 주세요.');
 return saved;
}
function putBanner(source){
 const notice=String(source||'').replace(/^※ 계약 안내 수정본 \(\d+차 확인\)\n이전에 전달한 계약 안내가 있다면 본 수정본을 기준으로 다시 확인해 주세요\.\n\n/,'');
 return revising?banner(revision)+notice:notice;
}
function start(){
 if(revising){refreshControls();select();$('revisionEditor')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});return true;}
 if(!isApproved()&&!latest)return false;
 // The current approved notice is always the immutable source for a revision.
 const prior=isApproved()?createSnapshot():latest;
 const checked=safeSnapshot(prior);
 if(!checked)return false;
 latest=checked;
 revision=Math.min(999,checked.revision+1);
 revising=true;
 modifications=[];
 const priorText=$('previousNotice');
 if(priorText)priorText.value=checked.preview;
 $('previousNoticeWrap')?.classList?.remove?.('hidden');
 const original=text('preview')||checked.preview;
 if($('preview'))$('preview').value=putBanner(original);
 core.edited(); // Immediately revoke share permission for the earlier image.
 window.FirstHyundaiContractImage?.close?.();
 if($('revisionStatus'))$('revisionStatus').textContent='기존 내용은 유지합니다. 바꿀 항목을 선택하고 새 내용을 입력하세요.';
 refreshControls();select();
 $('revisionPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
 return true;
}
function select(){
 const key=$('revisionField')?.value||'balanceDate';
 const current=text(key);
 const before=$('revisionBefore'),editor=$('revisionValue');
 if(before)before.textContent=(LABELS[key]||key)+' · 현재: '+(current||'미입력');
 if(editor){
  editor.value=current;
  editor.rows=key==='terms'?5:2;
  editor.setAttribute?.('inputmode',MONEY_FIELDS.has(key)?'decimal':'text');
  editor.placeholder=DATE_FIELDS.has(key)?'예: 2027.07.30':key==='terms'?'특약을 한 줄씩 입력하세요.':'바뀐 내용을 입력하세요.';
 }
 return key;
}
function normalizeField(key,raw){
 const s=String(raw||'').normalize('NFKC').trim();
 if(!s)return null;
 if(DATE_FIELDS.has(key)){
  const normal=window.FirstHyundaiEasy?._test?.normalizeQuickField;
  const candidate=key==='leaseEnd'?window.FirstHyundaiLanguage?._test?.dateIn?.(s)?.value:
   typeof normal==='function'?normal(key,s):null;
  if(!candidate)return null;
  // HTML date fields reject flexible phrases. Reject, don't silently erase.
  if(['balanceDate','leaseStart','leaseEnd'].includes(key)&&!/^\d{4}-\d{2}-\d{2}$/.test(candidate))return null;
  return candidate;
 }
 if(MONEY_FIELDS.has(key)){
  const n=window.FirstHyundaiLanguage?._test?.moneyPart?.(s);
  if(n==null||!Number.isFinite(n)||n<=0)return null;
  return String(Math.round(n*100)/100);
 }
 if(key==='balanceTime'){
  const time=s.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return time?time[0]:null;
 }
 if(key==='unit'&&!/^.{1,100}$/.test(s))return null;
 return s;
}
function pretty(raw){
 const v=String(raw||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.replace(/-/g,'.')+'.':v;
}
function patchDateInNotice(notice,key,newValue){
 const names=NOTICE_LINES[key];
 if(!names)return null;
 for(const label of names){
  const lines=String(notice).split('\n');
  const idx=lines.findIndex(x=>x.startsWith('▶ '+label+' : '));
  if(idx<0)continue;
  const suffix=key==='balanceDate'&&text('balanceTime')?' '+text('balanceTime'):'';
  lines[idx]='▶ '+label+' : '+pretty(newValue)+suffix;
  return lines.join('\n');
 }
 return null;
}
function apply(){
 if(!revising&&!start())return false;
 const key=$('revisionField')?.value||'';
 if(!Object.prototype.hasOwnProperty.call(LABELS,key))return false;
 const input=$('revisionValue');
 const normalized=normalizeField(key,input?.value);
 if(normalized===null){
  if($('revisionStatus'))$('revisionStatus').textContent='변경할 값이 올바르지 않습니다. 날짜·금액을 다시 확인해 주세요.';
  input?.focus?.();return false;
 }
 const previous=text(key);
 if(previous===normalized){
  if($('revisionStatus'))$('revisionStatus').textContent='현재 입력된 값과 동일합니다. 다른 내용을 입력해 주세요.';
  return false;
 }
 const oldNotice=text('preview');
 const target=$(key);if(!target)return false;
 target.value=normalized;
 if(MONEY_FIELDS.has(key))window.FirstHyundaiSmart?.changed?.({target});
 // A date-only edit leaves custom wording everywhere else untouched.
 const patched=patchDateInNotice(oldNotice,key,normalized);
 core.makePreview(); // Recomputes totals and makes re-approval mandatory.
 if(patched&&$('preview')){
  $('preview').value=putBanner(patched);
  core.edited();
 }
 modifications.push((LABELS[key]||key)+': '+(previous||'미입력')+' → '+normalized);
 if($('revisionStatus'))$('revisionStatus').textContent='✓ '+modifications[modifications.length-1]+
  '\n기존 안내문은 공유할 수 없습니다. 수정본을 확인하고 ‘내용 확인 완료’를 다시 눌러주세요.'+
  (patched?' 나머지 안내문 문구는 그대로 유지했습니다.':' 계산·문구가 다시 생성되었으니 전체 내용을 확인해 주세요.');
 $('revisionBefore').textContent='변경 전: '+(previous||'미입력')+' · 변경 후: '+normalized;
 refreshControls();
 $('confirmButton')?.scrollIntoView?.({behavior:'smooth',block:'center'});
 return true;
}
function restore(){
 const snapshot=readLocal();
 if(!snapshot){alert('이 휴대전화에서 다시 열 수 있는 확인본이 없습니다.');latest=null;refreshSaved();return false;}
 const filled=FIELDS.some(id=>text(id).trim())||!!text('preview').trim();
 if(filled&&typeof confirm==='function'&&!confirm(
  '현재 작성 중인 내용을 덮고 이전 확인본을 불러오시겠습니까?\n현재 미확인 초안은 사라집니다.'))return false;
 core._test.clearForNewMemo();
 for(const field of FIELDS){const element=$(field);if(element)element.value=snapshot.fields[field]||'';}
 window.FirstHyundaiSmart?.onOpen?.();
 if($('resultPanel'))$('resultPanel').classList?.remove?.('hidden');
 latest=snapshot;revision=Math.min(999,snapshot.revision+1);
 revising=true;modifications=[];
 core.makePreview();
 if($('preview')){
  $('preview').value=putBanner(snapshot.preview);
  core.edited(); // Restore is never auto-approved or auto-shared.
 }
 if($('previousNotice'))$('previousNotice').value=snapshot.preview;
 $('previousNoticeWrap')?.classList?.remove?.('hidden');
 if($('revisionStatus'))$('revisionStatus').textContent='최근 확인본을 불러왔습니다. 수정할 항목만 변경하세요. 발송 전 다시 확인해야 합니다.';
 refreshControls();select();
 $('resultPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
 return true;
}
function clearSaved(){
 if(!latest)return false;
 if(typeof confirm==='function'&&!confirm('이 기기의 마지막 확인본 1건을 삭제하시겠습니까? 현재 화면의 계약정보는 유지됩니다.'))return false;
 if(typeof host()?.clearLastApprovedContract!=='function')return false;
 try{host().clearLastApprovedContract();}catch(e){return false;}
 latest=null;refreshSaved();
 if($('resumeStatus'))$('resumeStatus').textContent='최근 확인본을 이 휴대전화에서 삭제했습니다.';
 return true;
}
function resetState(){
 revising=false;revision=1;modifications=[];
 refreshControls();refreshSaved();
}
const prevApprove=core.approve;
core.approve=function(){
 prevApprove();
 if(isApproved())saveApproved();
 refreshControls();
};
const prevPreview=core.makePreview;
core.makePreview=function(){
 window.FirstHyundaiContractImage?.close?.();
 prevPreview();
 if(revising&&$('preview')){
  $('preview').value=putBanner(text('preview'));
  core.refreshHighlightedNotice();
 }
 refreshControls();
};
const prevOpen=core.onOpen;
core.onOpen=function(){prevOpen();onOpen();};
const prevReset=core.reset;
core.reset=function(){
 const hadContent=FIELDS.some(id=>text(id).trim())||text('preview').trim();
 prevReset();
 if(hadContent&&!text('preview').trim()&&!text('rough').trim())resetState();
};
const prevComplex=core.fromSelectedComplex;
core.fromSelectedComplex=function(...args){
 const ok=prevComplex(...args);
 if(ok)resetState();
 return ok;
};
const prevToggle=core.togglePreviewEdit;
core.togglePreviewEdit=function(){
 if(isApproved()&&!revising)start();
 prevToggle();
};
window.FirstHyundaiContractRevision={onOpen,restore,start,select,apply,clearSaved,
 _test:{safeSnapshot,createSnapshot,normalizeField,patchDateInNotice,putBanner,refreshControls,getState:()=>({revising,revision,latest:!!latest})}};
})();
