/* Optional voice session. No existing memo, form value, or private field is sent.
   Incoming tool proposals stay volatile until the user stops and applies them. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id), field=k=>$('ct_'+k);
 const LABELS={property:'아파트명 / 단지명',unit:'동·호수',dealType:'계약 유형',price:'거래금액 / 보증금',contractDeposit:'계약금',advance:'이번 송금액',
  interim:'중도금',monthlyRent:'월세',contractDate:'계약일',interimDate:'중도금 지급일',balanceDate:'잔금일',
  leaseStart:'입주일',leaseEnd:'임대차 종료일',leaseDuration:'임대차 기간',balanceTime:'잔금 시간',terms:'특약 (기존 특약에 추가)'};
 const MONEY=new Set(['price','contractDeposit','advance','interim','monthlyRent']);
 const DATES=new Set(['contractDate','interimDate','balanceDate','leaseStart','leaseEnd']);
 let active=false,stopping=false,requestId='',sequence=0,proposals={},failed=false;
 function status(text){$('cl_status').textContent=text;}
 function validDate(s){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T12:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=2000&&Number(s.slice(0,4))<=2100;
 }
 function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const out={};
  for(const [k,v] of Object.entries(raw)){
   if(!Object.hasOwn(LABELS,k))return null;
   if(MONEY.has(k)){
    if(!Number.isSafeInteger(v)||v<0||v>1e12||(!v&&!['interim','monthlyRent'].includes(k)))return null;
    out[k]=String(v/10000); // Existing form stores 만원, API schema explicitly uses 원.
   }else{
    if(typeof v!=='string')return null;
    const s=v.trim();
    if(s.length>(k==='terms'?4000:100)||/[<>\u0000-\u0008]/.test(s))return null;
    if(k==='dealType'&&!['매매','전세','월세'].includes(s))return null;
    if(k==='property'){
      if(s.length<2||s.length>100||!/^[가-힣A-Za-z0-9\s().·ㆍ&+\/-]+$/.test(s)||
         (!/[가-힣A-Za-z]/.test(s))||
         /광역시|특별시|도로명주소|주소\s*[:：]/.test(s))return null;
    }
    if(k==='unit'){
      const matched=s.match(/^([0-9]{1,4})\s*동\s*([0-9]{1,4})\s*호$/);
      if(!matched||Number(matched[1])<1||Number(matched[2])<1)return null;
      out[k]=matched[1]+'동 '+matched[2]+'호';
      continue;
    }
    if(DATES.has(k)&&s&&!validDate(s)){
     if(!['contractDate','interimDate'].includes(k)||
        !/^[\d\s년월일초중말순경~～.\-/협의추후미정예정상호결정까지부터전후사이]+$/.test(s)||
        !/(협의|미정|추후|초순|중순|하순|월말|월초|전후|사이|~|～)/.test(s))return null;
    }
    if(k==='leaseDuration'&&s&&!/^\d{1,3}\s*(?:년|개월)(?:\s*\d{1,2}\s*개월)?$/.test(s))return null;
    if(k==='balanceTime'&&s&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s))return null;
    // Defense in depth on model output; this cannot redact microphone audio already sent.
    if(/(?:계좌|예금주|주민등록|전화번호|연락처|비밀번호|은행|\d{2,4}-\d{3,4}-\d{4}|\d{10,})/.test(s))return null;
    out[k]=s;
   }
  }
  return Object.keys(out).length?out:null;
 }
 // Local-only cross-field guard. Partial dictation stays allowed; compare only proposed values.
 function consistency(existing,update){
  const p={...existing,...update};
  const num=k=>Object.hasOwn(p,k)&&p[k]!==''?Number(p[k]):null;
  const total=num('price'),deposit=num('contractDeposit'),send=num('advance'),interim=num('interim');
  if(total!==null&&deposit!==null&&deposit>total)return '계약금이 거래금액보다 큽니다.';
  if(deposit!==null&&send!==null&&send>deposit)return '이번 송금액이 계약금보다 큽니다.';
  if(total!==null&&interim!==null&&interim>total)return '중도금이 거래금액보다 큽니다.';
  if(total!==null&&deposit!==null&&interim!==null&&deposit+interim>total)return '계약금과 중도금의 합계가 거래금액보다 큽니다.';
  for(const [first,last,label] of [['contractDate','balanceDate','잔금일이 계약일보다 빠릅니다.'],
                                    ['leaseStart','leaseEnd','임대차 종료일이 입주일보다 빠릅니다.']]){
   if(validDate(p[first]||'')&&validDate(p[last]||'')&&p[first]>p[last])return label;
  }
  return '';
 }
 function buttons(){
  $('cl_start').disabled=active||stopping;
  $('cl_stop').disabled=!active||stopping;
  $('cl_apply').disabled=active||stopping||!Object.keys(proposals).length;
 }
 function render(){
  const box=$('cl_proposals');box.replaceChildren();
  for(const [k,v] of Object.entries(proposals)){
   const row=document.createElement('label'),check=document.createElement('input');
   row.className='contractLiveProposal';check.type='checkbox';check.checked=true;check.id='cl_pick_'+k;
   const text=document.createElement('span'),title=document.createElement('strong'),value=document.createElement('span');
   title.textContent=LABELS[k];value.textContent=v===''?'입력 내용 지우기':MONEY.has(k)?Number(v).toLocaleString('ko-KR')+'만원':v;
   text.append(title,value);row.append(check,text);box.append(row);
  }
  $('cl_review').hidden=!Object.keys(proposals).length;buttons();
 }
 function open(){
  const dialog=$('cl_dialog');
  if(dialog.open)return;
  requestId='';active=false;stopping=false;failed=false;proposals={};
  $('cl_consent').checked=false;$('cl_transcript').textContent='';render();
  status('기존 메모는 보내지 않습니다. 이번 대화에서 말씀하신 조건만 정리합니다.');
  dialog.showModal();$('cl_close').focus();
  root.FirstHyundaiNative?.requestLiveQuotaStatus?.();
 }
 function start(){
  if(active||stopping)return;
  if(!$('cl_consent').checked){status('음성 전송 안내를 확인하고 체크해 주세요.');return;}
  if(!root.FirstHyundaiNative?.startContractLiveVoice){status('업데이트된 안드로이드 앱에서 이용해 주세요. 기존 메모 입력은 그대로 사용할 수 있습니다.');return;}
  if(Object.keys(proposals).length&&!root.confirm('새 대화는 이전 Live 검토 후보를 지웁니다. 새로 시작할까요?'))return;
  proposals={};failed=false;active=true;requestId='cl-'+Date.now()+'-'+(++sequence);render();
  root.FirstHyundaiLive?.stop?.();
  status('Live 연결 중입니다…');
  try{root.FirstHyundaiNative.startContractLiveVoice(requestId);}
  catch(e){active=false;buttons();status('연결하지 못했습니다. 기존 메모 입력을 이용해 주세요.');}
 }
 function stop(){
  if(!active||stopping)return;
  stopping=true;buttons();status('마이크를 종료하고 있습니다…');
  try{root.FirstHyundaiNative.stopContractLiveVoice();}
  catch(e){status('연결 상태를 확인해 주세요. 앱을 나가면 음성이 종료됩니다.');}
 }
 function close(){
  // Invalidate request before stopping: late native/tool callbacks cannot revive the draft.
  requestId='';
  if(active||stopping){try{root.FirstHyundaiNative?.stopContractLiveVoice?.();}catch(e){}}
  active=false;stopping=false;proposals={};$('cl_transcript').textContent='';render();
  $('cl_dialog').close();$('ct_liveOpen')?.focus?.();
 }
 function incoming(event){
  if(!requestId||event?.requestId!==requestId)return;
  const state=String(event.state||''),message=String(event.message||'');
  if(state==='date_warning'&&active){status(message||'지난 날짜가 감지됐습니다. 연도를 다시 확인해 주세요.');return;}
  if(state==='proposal'&&active&&!stopping){
   let p;try{p=normalize(JSON.parse(message));}catch(e){}
   if(!p){status('일부 조건을 확인하지 못했습니다. 금액·날짜를 정확히 다시 말씀해 주세요.');return;}
   const conflict=consistency(proposals,p);
   if(conflict){status(conflict+' 정확한 내용을 다시 말씀해 주세요.');return;}
   Object.assign(proposals,p);render();return;
  }
  if(state==='error'){active=false;stopping=true;failed=true;status(message);buttons();return;}
  if(state==='ended'){
   active=false;stopping=false;buttons();$('cl_transcript').textContent='';
   if(!failed)status(Object.keys(proposals).length?'대화가 끝났습니다. 조건을 확인하고 반영할 항목을 선택해 주세요.':message);
   root.FirstHyundaiNative?.requestLiveQuotaStatus?.();
   return;
  }
  if(!active||stopping)return;
  if(['connecting','connected','listening'].includes(state))status(message.slice(0,300));
  if(['heard','transcript'].includes(state))$('cl_transcript').textContent=(state==='heard'?'내 말: ':'AI: ')+message.slice(0,500);
 }
 function apply(){
  if(active||stopping)return false;
  const chosen=Object.entries(proposals).filter(([k])=>$('cl_pick_'+k)?.checked);
  if(!chosen.length){status('반영할 항목을 선택해 주세요.');return false;}
  if(!root.confirm('선택한 조건을 현재 계약에 반영할까요? 같은 항목의 기존 값은 바뀌며, 특약은 추가됩니다. 단지명·동·호수·금액·날짜를 확인해 주세요.'))return false;
  // Explicit deposit first prevents the existing 10% helper overwriting it on price edit.
  // Resolve the catalog apartment first so the verified address is added locally.
  // Explicit deposit before price preserves the existing 10% auto-calc safeguard.
  const rank={property:0,unit:1,contractDeposit:2};
  chosen.sort(([a],[b])=>(rank[a]??3)-(rank[b]??3));
  for(const [k,v] of chosen){
   const target=field(k);if(!target)continue;
   if(k==='terms'){
    const lines=String(target.value||'').split('\n').filter(Boolean);
    for(const line of v.split('\n').filter(Boolean))if(!lines.includes(line))lines.push(line);
    target.value=lines.join('\n');
   }else target.value=v;
   root.FirstHyundaiSmart?.changed?.({target});
  }
  root.FirstHyundaiContracts.updateSummary();
  root.FirstHyundaiEasy.afterManualEdit();
  close();
  $('ct_resultPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  return true;
 }
 $('cl_dialog')?.addEventListener('cancel',event=>{event.preventDefault();close();});
 // Defensive: private/manual input and old dictation can never run alongside this microphone.
 document.addEventListener('focusin',event=>{
  if((active||stopping)&&event.target?.id?.startsWith('ct_'))close();
 });
 const originalBack=root.firstHyundaiGoBack;
 root.firstHyundaiGoBack=function(){
  if($('cl_dialog').open){close();return true;}
  return originalBack?originalBack.apply(this,arguments):false;
 };
 function showQuota(q){
  if(!q||!Number.isInteger(q.limit)||!Number.isInteger(q.remaining)||!Number.isInteger(q.used)||
      q.limit<1||q.limit>100||q.remaining<0||q.used<0)return;
  const pending=Number.isInteger(q.pending)&&q.pending>0?q.pending:0;
  const reset=String(q.reset_at_kst||'');
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2} 오전 9시$/.test(reset))return;
  const label='오늘 Live 남은 '+q.remaining+'/'+q.limit+'회'
    +(pending?' (연결 준비 중 '+pending+'회)':'')+' · 다음 초기화: '+reset;
  for(const id of ['cl_quota','newsLiveVoiceQuota']){
   const el=$(id);if(el){el.hidden=false;el.textContent=label;}
  }
 }
 root.onFirstHyundaiLiveQuotaStatus=showQuota;
 root.onFirstHyundaiContractLiveStatus=incoming;
 root.FirstHyundaiContractLive={open,start,stop,close,apply,onPageChange(page){if(page!=='contracts'&&$('cl_dialog').open)close();},_test:{normalize,validDate,consistency}};
})(window);
