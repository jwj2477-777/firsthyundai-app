
/* 퍼스트현대 계약문자 작성기: 개인정보 외부 전송/저장 없음. */
(function(){
'use strict';
const E=id=>document.getElementById(id);
const FIELDS=['dealType','property','address','unit','owner','buyer','price','monthlyRent','contractDeposit','advance','interim','contractDate','balanceDate','balanceTime','leaseStart','leaseEnd','leaseDuration','bank','account','accountHolder','terms','cancellation','brokerFee','rough'];
let created=false, approved=false;
function field(id){return String(E('ct_'+id)?.value||'').trim();}
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
  '\n추가로 납부할 계약금: '+(data.remainder===null?'계산 불가':money(data.remainder))+
  '\n최종 잔금: '+(data.balance===null?'계산 불가':money(data.balance))+
  (data.interim>0?' (중도금 '+money(data.interim)+' 별도)':'');
 if(created&&E('ct_preview').value){
  created=false;approved=false; // Invalidate stale preview after any upstream condition changed.
  E('ct_status').textContent='조건이 변경되었습니다. 새로 초안을 생성하고 다시 검토해 주세요.';
  E('ct_status').className='contractReview bad';
 }
}
function makePreview(){
 const d=collect();
 const totalName=d.type==='매매'?'매매대금':d.type==='전세'?'전세보증금':'보증금';
 const who=d.type==='매매'?'매도인':'임대인';
 const paying=d.type==='매매'?'매수인':'임차인';
 const out=['안녕하세요. 퍼스트현대부동산입니다.','',
  '● 아파트 '+d.type+'계약 조건 안내 ●','',
  '▶ 아파트 : '+(field('property')||'[확인 필요]'),
  '▶ 소재지 : '+(field('address')||'[주소 확인 필요]'),
  '▶ 대상물 : '+(field('unit')||'[확인 필요]')];
 if(field('owner'))out.push('▶ '+who+' : '+field('owner'));
 if(field('buyer'))out.push('▶ '+paying+' : '+field('buyer'));
 out.push('▶ '+totalName+' : '+(d.price===null?'[확인 필요]':money(d.price)));
 if(d.type==='월세')out.push('▶ 월 차임 : '+(amount('monthlyRent')===null?'[확인 필요]':money(amount('monthlyRent'))));
 if(d.type!=='매매'){
  out.push('▶ 임대차 기간 : '+(field('leaseDuration')||(field('leaseStart')&&field('leaseEnd')?dateLabel(field('leaseStart'))+' ~ '+dateLabel(field('leaseEnd')):'[확인 필요]')));
 }
 if(field('contractDate'))out.push('▶ 계약서 작성 예정 : '+field('contractDate'));
 out.push('▶ 약정 계약금 : '+(d.deposit===null?'[확인 필요]':money(d.deposit)));
 out.push('▶ 이번 선송금 예정액 : '+(d.advance===null?'[확인 필요]':money(d.advance)));
 if(d.remainder===null||d.remainder>0)out.push('▶ 남은 계약금 : '+(d.remainder===null?'[확인 필요]':money(d.remainder)));
 if(d.interim>0)out.push('▶ 중도금 : '+money(d.interim));
 out.push('▶ 최종 잔금 : '+(d.balance===null?'[확인 필요]':money(d.balance)));
 out.push('▶ 잔금 지급 예정 : '+(field('balanceDate')?dateLabel(field('balanceDate')):'[확인 필요]')+(field('balanceTime')?' '+field('balanceTime'):''));
 if(field('leaseStart'))out.push('▶ 입주/임대차 개시 : '+dateLabel(field('leaseStart')));
 out.push('','▶ '+who+' 송금 계좌 : '+(field('bank')||'[은행 확인]')+' '+(field('account')||'[계좌 확인]'));
 out.push('▶ 예금주 : '+(field('accountHolder')||'[예금주 확인]'));
 const terms=safeLines(field('terms'));
 if(terms.length){out.push('','● 특약 및 합의사항 ●');terms.forEach((line,i)=>out.push((i+1)+'. '+line.replace(/^\d+[.)]\s*/,'')));}
 if(field('cancellation'))out.push('','● 해제·위약 관련 합의 ●',field('cancellation'));
 if(field('brokerFee'))out.push('','● 중개보수 관련 합의 ●',field('brokerFee'));
 out.push('','위 조건과 송금 계좌·예금주를 당사자 모두 확인해 주시기 바랍니다.',
 '계약금 일부 송금 및 이후 계약서 작성에 관한 합의 내용을 확인한 후 진행해 주시기 바랍니다.');
 E('ct_preview').value=out.join('\n');
 created=true;
 approved=false; // Human confirmation is mandatory even for a fully populated template.
 updateSummary();
 E('ct_status').className='contractReview '+(d.errors.length?'bad':'');
 E('ct_status').textContent=d.errors.length?
  '⚠ 미완성 초안 · 발송 전 보완: '+d.errors.join(' · '):
  '필수 항목이 채워졌습니다. 문자와 계좌를 직접 대조한 뒤 ‘내용 확인 완료’를 눌러 주세요.';
}
function edited(){
 approved=false;E('ct_status').className='contractReview bad';
 E('ct_status').textContent='미리보기를 직접 수정했습니다. 복사·공유하려면 ‘내용 확인 완료’ 버튼으로 다시 검토해 주세요.';
}
function approve(){
 const d=collect();
 if(d.errors.length){E('ct_status').textContent='다음 필수 항목을 먼저 보완하세요: '+d.errors.join(' · ');E('ct_status').className='contractReview bad';return;}
 if(!created||!field('property')||!E('ct_preview').value.trim()){alert('먼저 문자 초안을 생성해 주세요.');return;}
 approved=true;
 E('ct_status').className='contractReview ok';E('ct_status').textContent='직접 확인 완료 · 복사 또는 공유할 수 있습니다.';
}
function assertReady(){
 if(!created||!approved||collect().errors.length){alert('계약 조건 입력 → 초안 생성 → 내용 확인 완료 순서로 진행해 주세요.');return false;}
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
function fromSelectedComplex(){
 try{
  const record=catalogRows().find(x=>x.id===complexSelected);
  if(!record)return;
  setField('property',record.label,true);
  if(record.address)setField('address',record.address,true);
  switchPage('contracts');
  E('ct_unit').focus();
  window.FirstHyundaiSmart?.select(record.id);
  updateSummary();
 }catch(e){switchPage('contracts');}
}
function reset(){
 if(!confirm('현재 작성 중인 계약 내용을 모두 지우시겠습니까? 저장된 사본은 없습니다.'))return;
 FIELDS.forEach(id=>{const el=E('ct_'+id);if(el)el.value='';});
 E('ct_dealType').value='전세';E('ct_preview').value='';
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
 onOpen(){window.FirstHyundaiSmart?.onOpen();updateSummary();},updateSummary,extractNotes,makePreview,approve,edited,copy,share,reset,voice,fromSelectedComplex,
 fromComplex(id){
  const r=catalogRows().find(x=>x.id===id);
  if(r){setField('property',r.label,true);setField('address',r.address||'',true);switchPage('contracts');window.FirstHyundaiSmart?.select(r.id);updateSummary();}
 },
 _test:{contractValue,normalizeDate,collect}
};
})();
