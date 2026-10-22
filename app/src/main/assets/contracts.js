
/* 퍼스트현대 계약문자 작성기: 개인정보 외부 전송/저장 없음. */
(function(){
'use strict';
const E=id=>document.getElementById(id);
const FIELDS=['dealType','property','address','unit','owner','buyer','price','monthlyRent','contractDeposit','advance','interim','interimDate','contractDate','balanceDate','balanceTime','exclusiveArea','supplyInfo','leaseStart','leaseEnd','leaseDuration','bank','account','accountHolder','terms','cancellation','brokerFee','rough'];
let created=false, approved=false;
function field(id){return String(E('ct_'+id)?.value||'').trim();}
// Textarea cannot color individual substrings. Show a safe, noneditable color
// preview to family members; tap "직접 수정" to edit the original plain text.
// Never inject user-supplied contract text as HTML without escaping it first.
function escapeNotice(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
const PLACEHOLDER=/\[[^\]\n]{0,90}확인 필요[^\]\n]{0,40}\]/g;
function previewContainsMissing(){PLACEHOLDER.lastIndex=0;return PLACEHOLDER.test(E('ct_preview')?.value||'');}
function highlightedNoticeHtml(raw){
 const value=String(raw||'');let last=0,html='',match;
 PLACEHOLDER.lastIndex=0;
 while((match=PLACEHOLDER.exec(value))!==null){
  html+=escapeNotice(value.slice(last,match.index));
  html+='<strong class="contractNeedsCheck">'+escapeNotice(match[0])+'</strong>';
  last=match.index+match[0].length;
 }
 return html+escapeNotice(value.slice(last));
}
function refreshHighlightedNotice(){
 const highlight=E('ct_previewHighlight');
 if(!highlight)return;
 highlight.innerHTML=highlightedNoticeHtml(E('ct_preview')?.value||'');
}
function togglePreviewEdit(){
 const source=E('ct_preview'),button=E('ct_togglePreviewEdit');
 if(!source)return;
 const editing=!!source.classList?.contains?.('contractEditing');
 source.classList?.toggle?.('contractEditing',!editing);
 E('ct_previewHighlight')?.classList?.toggle?.('hidden',!editing);
 if(button){
  button.textContent=editing?'✎ 문자 직접 수정':'✓ 수정 내용 미리보기';
  button.setAttribute?.('aria-expanded',String(!editing));
 }
 if(editing)refreshHighlightedNotice();
 else source.focus?.();
}

function setField(id,value,force){const e=E('ct_'+id);if(e&&(force||!e.value.trim()))e.value=String(value||'');}
function contractValue(text){
 const v=String(text||'').replace(/[,，\s]/g,'').replace(/원/g,'').replace(/(천|백)만$/,'$1');
 if(!v||!/^(?:\d+(?:\.\d+)?(?:억|천|백|만)?)+$/.test(v))return null;
 let amount=0,match;const rx=/(\d+(?:\.\d+)?)(억|천|백|만)?/g;
 while((match=rx.exec(v))!==null){
  let n=Number(match[1]);const unit=match[2];
  amount+=n*(unit==='억'?10000:unit==='천'?1000:unit==='백'?100:1);
 }
 return Number.isFinite(amount)&&amount>=0?Math.round(amount*100)/100:null;
}
function amount(id){return contractValue(field(id));}
function money(n){return Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2})+'만원';}
function dateLabel(raw){
 const s=String(raw||'').trim();
 if(!s)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.replace(/-/g,'.')+'.';
 return s;
}
function normalizeDate(raw){
 const m=String(raw||'').match(/(?:20\d{2})\s*[./년-]\s*(\d{1,2})\s*[./월-]\s*(\d{1,2})/);
 if(!m)return '';
 const y=Number(m[0].slice(0,4)),mo=Number(m[1]),d=Number(m[2]);
 const date=new Date(y,mo-1,d);
 return date.getFullYear()===y&&date.getMonth()===mo-1&&date.getDate()===d?
  String(y)+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'):'';
}
function safeLines(v){return String(v||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);}
const DEFAULT_DETAIL_TERM='기타 상세한 특약사항은 본계약서 작성 시 협의하여 기재한다.';
function previewSpecialTerms(raw){
 const lines=safeLines(raw);
 // Avoid adding a duplicate if the memo already says the remaining details will be agreed at signing.
 const isEquivalent=line=>{
  const clean=String(line||'').replace(/^[①②③④⑤⑥⑦⑧⑨⑩→•\d.)\s-]+/g,'').replace(/\s+/g,'');
  return clean.includes(DEFAULT_DETAIL_TERM.replace(/\s+/g,'')) ||
   /(?:기타|그외|나머지|세부|상세).{0,16}(?:사항|특약|조건).{0,20}(?:본계약|계약서|계약시|계약때).{0,15}(?:협의|작성|기재|정한다)/.test(clean) ||
   /(?:기타|그외|나머지).{0,8}사항.{0,12}(?:계약시|본계약).{0,12}(?:협의|정한다|작성)/.test(clean);
 };
 if(!lines.some(isEquivalent))lines.push(DEFAULT_DETAIL_TERM);
 return lines;
}

function extractNotes(){
 const raw=field('rough');if(!raw){alert('먼저 메모 또는 음성입력 내용을 적어 주세요.');return;}
 const lines=raw.replace(/\r/g,'').split('\n');
 const mappings=[
  ['property',/^\s*(?:소재지|주소|아파트|단지명)\s*[:：-]?\s*(.+)/],
  ['unit',/^\s*(?:동호수|동\s*\/\s*호|호수|대상물)\s*[:：-]?\s*(.+)/],
  ['owner',/^\s*(?:임대인|매도인)\s*[:：-]\s*(.+)/],
  ['buyer',/^\s*(?:임차인|매수인)\s*[:：-]\s*(.+)/],
  ['price',/^\s*(?:매매가|매매대금|전세금|전세보증금|보증금|총\s*금액)\s*[:：-]?\s*(.+)/],
  ['contractDeposit',/^\s*(?:총\s*계약금|약정\s*계약금|계약금)\s*[:：-]?\s*(.+)/],
  ['advance',/^\s*(?:선송금액|먼저\s*보낼\s*금액|일부\s*계약금|이번\s*송금액|입금예정액)\s*[:：-]?\s*(.+)/],
  ['monthlyRent',/^\s*(?:월세|차임)\s*[:：-]?\s*(.+)/],
  ['interim',/^\s*(?:중도금)\s*[:：-]?\s*(.+)/],
  ['bank',/^\s*(?:은행)\s*[:：-]?\s*(.+)/],
  ['account',/^\s*(?:계좌번호|입금계좌)\s*[:：-]?\s*(.+)/],
  ['accountHolder',/^\s*(?:예금주)\s*[:：-]?\s*(.+)/],
  ['contractDate',/^\s*(?:본계약\s*작성일|계약서\s*작성일|계약일)\s*[:：-]?\s*(.+)/],
  ['leaseDuration',/^\s*(?:임대차\s*기간|계약기간)\s*[:：-]?\s*(.+)/]
 ];
 let count=0,inTerms=false;const terms=[];
 for(const line of lines){
  if(/^\s*(?:특약(?:사항)?|합의사항)\s*[:：]?\s*$/.test(line)){inTerms=true;continue;}
  const dateMatch=line.match(/^\s*(?:잔금일(?:시)?|잔금\s*지급일)\s*[:：-]?\s*(.+)/);
  if(dateMatch){const d=normalizeDate(dateMatch[1]);if(d){setField('balanceDate',d);count++;}inTerms=false;continue;}
  const dateStart=line.match(/^\s*(?:입주일|임대차\s*개시일)\s*[:：-]?\s*(.+)/);
  if(dateStart){const d=normalizeDate(dateStart[1]);if(d){setField('leaseStart',d);count++;}inTerms=false;continue;}
  let matched=false;
  for(const [id,re] of mappings){
   const m=line.match(re);if(!m)continue;
   let value=m[1].trim();
   if(['price','contractDeposit','advance','interim','monthlyRent'].includes(id)){
    const token=value.match(/\d[\d,.\s억천백만]*원?/);
    if(!token||contractValue(token[0])===null)break;
    value=String(contractValue(token[0]));
   }
   const old=field(id);setField(id,value);if(!old)count++;
   matched=true;inTerms=false;break;
  }
  if(matched)continue;
  if(inTerms||/^\s*(?:특약\s*)?(?:[①②③④⑤]|\d+[.)])\s*/.test(line)){
   terms.push(line.replace(/^\s*(?:특약\s*)?(?:[①②③④⑤]|\d+[.)])\s*/,''));
  }
 }
 if(terms.length&&!field('terms'))setField('terms',terms.join('\n'));
 created=false;approved=false;
 updateSummary();
 E('ct_status').textContent=count+'개 항목을 추출했습니다. 빠진 내용이나 잘못 인식된 금액·날짜는 직접 확인해 주세요. 원문은 외부로 전송하지 않았습니다.';
 E('ct_status').className='contractReview';
}
function collect(){
 const type=field('dealType'),price=amount('price'),deposit=amount('contractDeposit'),advance=amount('advance'),interim=field('interim')?amount('interim'):0;
 const errors=[];
 if(!field('property'))errors.push('단지명');
 if(!field('address'))errors.push('소재지 도로명주소');
 if(window.FirstHyundaiSmart?.needsPropertyConfirmation())errors.push('아파트 단지 선택 확인');
 if(!field('unit'))errors.push('동·호수');
 if(price===null||price<=0)errors.push('매매대금 또는 보증금');
 if(deposit===null||deposit<=0)errors.push('약정 계약금');
 if(advance===null||advance<=0)errors.push('이번 송금액');
 if(interim===null||interim<0)errors.push('중도금 숫자');
 if(price!==null&&deposit!==null&&deposit>price)errors.push('계약금이 총금액을 초과함');
 if(deposit!==null&&advance!==null&&advance>deposit)errors.push('이번 송금액이 계약금보다 큼');
 if(price!==null&&deposit!==null&&interim!==null&&price-deposit-interim<0)errors.push('잔금 계산이 음수');
 if(!field('balanceDate'))errors.push('잔금 예정일');
 if(field('interimDate')&&!(interim>0))errors.push('중도금 일정은 있는데 금액이 없음');
 if(interim>0&&!field('interimDate')&&/중도금[^\n]{0,70}\b\d{1,2}\s*년\s*\d{1,2}\s*일/.test(field('rough')))errors.push('중도금 지급일 오타 확인');
 if(!field('bank')||!field('account')||!field('accountHolder'))errors.push('송금 은행·계좌·예금주');
 if(type==='월세'&&(amount('monthlyRent')===null||amount('monthlyRent')<=0))errors.push('월세 금액');
 if(type!=='매매'&&!field('leaseDuration')&&!(field('leaseStart')&&field('leaseEnd')))errors.push('임대차 기간');
 if(field('balanceDate')&&field('leaseStart')&&field('leaseStart')<field('balanceDate'))errors.push('입주일이 잔금일보다 빠름(재확인)');
 return {type,price,deposit,advance,interim,errors,balance:price!==null&&deposit!==null&&interim!==null?price-deposit-interim:null,
  remainder:deposit!==null&&advance!==null?deposit-advance:null};
}
function updateSummary(){
 const data=collect();
 E('ct_amountSummary').textContent='총액: '+(data.price===null?'미입력':money(data.price))+
  '\n약정 계약금: '+(data.deposit===null?'미입력':money(data.deposit))+
  '  /  이번 송금: '+(data.advance===null?'미입력':money(data.advance))+
  '\n최종 잔금: '+(data.balance===null?'계산 불가':money(data.balance))+
  (data.interim>0?' (중도금 '+money(data.interim)+' 별도)':'');
 if(created&&E('ct_preview').value){
  created=false;approved=false; // Invalidate stale preview after any upstream condition changed.
  E('ct_status').textContent='조건이 변경되었습니다. 문자를 다시 생성해 검토해 주세요.';
  E('ct_status').className='contractReview bad';
 }
}
function makePreview(){
 const d=collect();
 const moneyOr=n=>n===null?'[확인 필요]':money(n);
 const who=d.type==='매매'?'매도인':'임대인',paying=d.type==='매매'?'매수인':'임차인';
 const totalName=d.type==='매매'?'매매대금':d.type==='전세'?'전세보증금':'보증금';
 const typeLine='● 아파트 '+d.type+'계약 ●';
 const out=['안녕하세요. 퍼스트현대부동산입니다.','',typeLine,''];
 out.push('▶ 소재지 : '+(field('address')||'[주소 확인 필요]'));
 out.push('▶ 아파트명 : '+(field('property')||'[단지 확인 필요]')+(field('unit')?' '+field('unit'):' [동·호수 확인 필요]'));
 if(field('exclusiveArea')){
  const area=Number(field('exclusiveArea'));
  if(Number.isFinite(area)&&area>0&&area<400){
   out.push('▶ 전용면적 : '+String(area)+'㎡'+(field('supplyInfo')?' · '+field('supplyInfo'):''));
  }
 }
 if(field('owner'))out.push('▶ '+who+' : '+field('owner'));
 if(field('buyer'))out.push('▶ '+paying+' : '+field('buyer'));
 out.push('','▶ '+totalName+' : '+moneyOr(d.price));
 if(d.type==='월세')out.push('▶ 월세 : '+moneyOr(amount('monthlyRent')));
 if(d.type!=='매매')out.push('▶ 임대차 기간 : '+(field('leaseDuration')||(field('leaseStart')&&field('leaseEnd')?dateLabel(field('leaseStart'))+' ~ '+dateLabel(field('leaseEnd')):'[확인 필요]')));
 if(field('contractDate'))out.push('▶ 계약일 : '+dateLabel(field('contractDate')));
 const ratio=d.price>0&&d.deposit!==null?d.deposit/d.price*100:null;
 out.push('▶ 계약금 : '+moneyOr(d.deposit)+(ratio!==null&&Math.abs(ratio-10)<0.00001?' (매매대금의 10%)'.replace('매매대금',totalName):''));
 if(d.interim>0){
  if(field('interimDate'))out.push('▶ 중도금 지급일 : '+field('interimDate'));
  else if(/중도금[^\n]{0,70}\b\d{1,2}\s*년\s*\d{1,2}\s*일/.test(field('rough')))out.push('▶ 중도금 지급일 : [메모 날짜 확인 필요]');
  out.push('▶ 중도금 : '+money(d.interim));
 }
 out.push('','▶ 잔금일 : '+(field('balanceDate')?dateLabel(field('balanceDate')):'[확인 필요]')+(field('balanceTime')?' '+field('balanceTime'):''));
 out.push('▶ 잔금 : '+moneyOr(d.balance));
 if(field('leaseStart'))out.push('▶ 입주일 : '+dateLabel(field('leaseStart')));
 const terms=previewSpecialTerms(field('terms'));
 if(terms.length){
  out.push('','▶ 특약사항');
  terms.forEach(t=>out.push('→ '+t.replace(/^\d+[.)]\s*/,'')));
 }
 if(field('cancellation'))out.push('','▶ 별도 해제·위약 합의',field('cancellation'));
 if(field('brokerFee'))out.push('','▶ 별도 중개보수 합의',field('brokerFee'));
 const account=field('bank')&&field('account')&&field('accountHolder')?
  field('bank')+' '+field('account')+' (예금주 '+field('accountHolder')+')':
  '[은행·계좌번호·예금주 확인 필요]';
 if(E('ct_includeNotice')?.checked){
  out.push('','※ 계약금 일부 송금 및 계약 성립·해제 조건 확인');
  out.push('금일 위 계약조건에 따라 계약금 중 일부인 '+moneyOr(d.advance)+'을 '+who+' 계좌('+account+')로 송금하기로 합니다.');
  out.push('당사자들은 위 금액의 이체와 동시에 본계약이 체결된 것으로 보기로 하며, 일방의 변심으로 계약을 해제하는 경우 '+who+'은 실제 수령한 금액의 배액을 상환하고 '+paying+'은 실제 송금한 금액을 포기하는 조건으로 합의합니다.');
  out.push('또한 위 사유로 계약이 해제되더라도 그 사실만으로 중개보수 지급의무가 없어지는 것은 아니라는 점을 확인합니다.');
 }else{
  out.push('','※ 계약금 중 일부 '+moneyOr(d.advance)+'를 '+who+' 계좌('+account+')로 송금할 예정입니다.');
  out.push('위 계약조건과 송금 계좌, 계약 성립·해제 조건을 당사자 모두 확인해 주시기 바랍니다.');
 }
 E('ct_preview').value=out.join('\n');
 // Newly composed messages always begin in readable, red-marked review mode.
 E('ct_preview')?.classList?.remove?.('contractEditing');
 E('ct_previewHighlight')?.classList?.remove?.('hidden');
 const editToggle=E('ct_togglePreviewEdit');
 if(editToggle){editToggle.textContent='✎ 문자 직접 수정';editToggle.setAttribute?.('aria-expanded','false');}
 refreshHighlightedNotice();
 created=false;approved=false;
 updateSummary();
 created=true; // A newly generated preview remains approvable; only later form edits invalidate it.
 E('ct_status').className='contractReview '+(d.errors.length?'bad':'');
 E('ct_status').textContent=d.errors.length?'⚠ 발송 전 보완: '+d.errors.join(' · '):
  '계약내용·금액·계좌·당사자 합의를 대조한 뒤 ‘내용 확인 완료’를 누르세요.';
}
function edited(){
 refreshHighlightedNotice();
 approved=false;E('ct_status').className='contractReview bad';
 E('ct_status').textContent='미리보기를 직접 수정했습니다. 복사·공유하려면 ‘내용 확인 완료’ 버튼으로 다시 검토해 주세요.';
}
function approve(){
 const d=collect();
 if(previewContainsMissing()){
  E('ct_status').textContent='⚠ 계약문자에 빨간 확인 필요 항목이 남아 있습니다. 먼저 내용을 보완해 주세요.';
  E('ct_status').className='contractReview bad';
  return;
 }
 if(d.errors.length){E('ct_status').textContent='다음 필수 항목을 먼저 보완하세요: '+d.errors.join(' · ');E('ct_status').className='contractReview bad';return;}
 if(!created||!field('property')||!E('ct_preview').value.trim()){alert('먼저 문자 초안을 생성해 주세요.');return;}
 if(E('ct_includeNotice')?.checked&&!E('ct_noticeConfirmed')?.checked){
  E('ct_status').className='contractReview bad';
  E('ct_status').textContent='하단의 계약 성립·해제·중개보수 조건은 법률상 자동 적용되는 내용이 아닙니다. 당사자 간 실제 합의를 확인했다면 ‘하단 합의 내용 확인’에 체크해 주세요.';
  return;
 }
 approved=true;
 E('ct_status').className='contractReview ok';E('ct_status').textContent='직접 확인 완료 · 복사 또는 공유할 수 있습니다.';
}
function assertReady(){
 if(!created||!approved||collect().errors.length||previewContainsMissing()||(E('ct_includeNotice')?.checked&&!E('ct_noticeConfirmed')?.checked)){alert('계약 조건·하단 합의문을 확인한 뒤 내용 확인 완료를 눌러주세요.');return false;}
 return true;
}
async function copy(){
 if(!assertReady())return;
 const t=E('ct_preview').value;
 if(window.FirstHyundaiNative?.copyContract){window.FirstHyundaiNative.copyContract(t);return;}
 try{await navigator.clipboard.writeText(t);alert('계약문자를 복사했습니다.');}catch(e){E('ct_preview').focus();E('ct_preview').select();alert('문자를 선택했습니다. 복사 기능을 이용해 주세요.');}
}
async function share(){
 if(!assertReady())return;
 const t=E('ct_preview').value;
 if(window.FirstHyundaiNative?.shareContract){window.FirstHyundaiNative.shareContract(t);return;}
 if(navigator.share){try{await navigator.share({text:t});}catch(e){}}
 else alert('공유 기능이 없는 환경입니다. 복사 버튼을 이용해 주세요.');
}
// Apartment -> contract must populate the VISIBLE memo, not hidden advanced
// fields alone. No customer data persists; replacing an unfinished memo requires
// explicit consent and resets the previous customer's payment/account details.
function fromSelectedComplex(exclusiveM2=null,supplyLabel=''){
 const record=typeof catalogRows==='function'?catalogRows().find(x=>x.id===complexSelected):null;
 if(!record)return false;
 const oldHasData=FIELDS.some(id=>!['rough','dealType'].includes(id)&&field(id))||field('rough')||E('ct_preview')?.value.trim();
 if(oldHasData&&!confirm('기존에 작성 중인 계약 내용이 있습니다. 다른 계약으로 새로 시작할까요?'))return false;
 const area=Number(exclusiveM2),validArea=exclusiveM2!==null&&exclusiveM2!==''&&
  Number.isFinite(area)&&area>=10&&area<=400;
 const pairs=typeof verifiedSupplyPairs==='function'?verifiedSupplyPairs(record):[];
 const selected=validArea&&/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,8}$/.test(String(supplyLabel||''))?
  pairs.find(p=>p.supply_label===supplyLabel&&Math.abs(p.exclusive_m2-area)<=0.011):null;
 // A code is included only if the pair exists in the verified catalog.
 const supply=selected?selected.supply_label+'타입 · 공급 '+String(selected.supply_m2)+'㎡':'';
 const parts=['아파트명: '+record.label];
 if(typeof record.address==='string'&&record.address.trim())parts.push('소재지: '+record.address.trim());
 if(validArea)parts.push('전용면적: '+String(Math.round(area*100)/100)+'㎡');
 if(supply)parts.push('공급타입: '+supply);
 clearForNewMemo();
 window.FirstHyundaiEasy?.reset?.();
 E('ct_rough').value=parts.join('\n')+'\n';
 setField('property',record.label,true);
 if(record.address)setField('address',record.address,true);
 if(validArea)setField('exclusiveArea',String(Math.round(area*100)/100),true);
 if(supply)setField('supplyInfo',supply,true);
 switchPage('contracts');
 window.FirstHyundaiSmart?.select(record.id);
 const context=E('ct_selectedComplexContext');
 if(context){
  context.textContent='✓ '+record.label+' 자동 입력 완료'+
   (validArea?' · 전용 '+String(Math.round(area*100)/100)+'㎡':'')+
   (supply?' · '+supply:'')+
   ' · 동·호수와 계약조건을 추가해 주세요.';
  context.classList?.remove?.('hidden');
 }
 E('ct_rough')?.focus?.();
 updateSummary();
 return true;
}
function clearForNewMemo(){
 const memo=field('rough');
 FIELDS.forEach(id=>{if(id!=='rough'&&E('ct_'+id))E('ct_'+id).value='';});
 E('ct_dealType').value='전세';
 if(E('ct_noticeConfirmed'))E('ct_noticeConfirmed').checked=false;
 E('ct_preview').value='';
 refreshHighlightedNotice();
 E('ct_rough').value=memo;
 E('ct_selectedComplexContext')?.classList?.add?.('hidden');
 E('ct_status').textContent='메모에서 새 계약조건을 분석합니다.';
 E('ct_status').className='contractReview';
 created=false;approved=false;
 window.FirstHyundaiSmart?.reset();
 updateSummary();
}
function reset(){
 if(!confirm('현재 작성 중인 계약 내용을 모두 지우시겠습니까? 저장된 사본은 없습니다.'))return;
 FIELDS.forEach(id=>{const el=E('ct_'+id);if(el)el.value='';});
 E('ct_dealType').value='전세';E('ct_preview').value='';refreshHighlightedNotice();
 E('ct_selectedComplexContext')?.classList?.add?.('hidden');
 if(E('ct_noticeConfirmed'))E('ct_noticeConfirmed').checked=false;
 E('ct_status').textContent='조건을 입력하면 초안을 생성할 수 있습니다.';
 E('ct_status').className='contractReview';
 created=false;approved=false;updateSummary();
}
function voice(){
 if(!window.FirstHyundaiNative?.startContractDictation){alert('음성입력은 안드로이드 설치형 앱에서 사용해 주세요.');return;}
 const ok=confirm('휴대폰의 음성인식 서비스가 녹음 내용을 처리할 수 있습니다. 고객 개인정보나 계좌번호는 말하지 않는 것을 권장합니다. 음성입력을 시작할까요?');
 if(ok)window.FirstHyundaiNative.startContractDictation();
}
window.firstHyundaiContractSpeech=function(result){
 if(result&&result.ok&&typeof result.text==='string'){
  E('ct_rough').value+=(E('ct_rough').value?'\n':'')+result.text.slice(0,3000);
  E('ct_status').textContent='음성 입력을 메모에 추가했습니다. ‘메모에서 항목 찾기’를 눌러 확인해 주세요.';
 }else if(result&&!result.cancelled)alert('음성입력에 실패했습니다. 직접 입력을 이용해 주세요.');
};
window.FirstHyundaiContracts={
 onOpen(){window.FirstHyundaiSmart?.onOpen();updateSummary();refreshHighlightedNotice();},canShare:assertReady,updateSummary,extractNotes,makePreview,approve,edited,copy,share,reset,voice,fromSelectedComplex,togglePreviewEdit,refreshHighlightedNotice,
 fromComplex(id){
  const r=catalogRows().find(x=>x.id===id);
  if(!r)return false;
  const before=typeof complexSelected==='string'?complexSelected:null;
  try{complexSelected=r.id;return fromSelectedComplex();}
  finally{if(before!==null)complexSelected=before;}
 },
 _test:{contractValue,normalizeDate,collect,clearForNewMemo,previewSpecialTerms,DEFAULT_DETAIL_TERM,highlightedNoticeHtml,previewContainsMissing}
};
})();
