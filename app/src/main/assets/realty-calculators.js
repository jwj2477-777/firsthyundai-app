/* 퍼스트현대 부동산 계산기: offline arithmetic only. No customer data is sent or stored. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const WON=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
 const types=new Set(['acquisition','transfer','fee','conversion','loan']);
 const names={acquisition:'취득세',transfer:'양도소득세',fee:'중개보수',conversion:'전월세 전환',loan:'대출이자'};
 let chosen='',taxPending='',taxSequence=0;
 function num(value,max,allowFraction=false){
  const raw=String(value??'').trim();
  if(!/^\d+(?:\.\d+)?$/.test(raw))return null;
  const n=Number(raw);
  if(!Number.isFinite(n)||n<0||n>max||(!allowFraction&&!Number.isSafeInteger(n)))return null;
  return n;
 }
 function amount(v){return num(v,1e9,false);}
 function percent(v){return num(v,100,true);}
 function months(v){const n=num(v,600,false);return n!==null&&n>=1?n:null;}
 function money(won){return WON.format(Math.round(won))+'원';}
 function commission({kind,deal,amountWan,rentWan=0,vat=false}){
  const value=amount(amountWan),rent=amount(rentWan);
  if(value===null||value===0)throw Error('거래금액이나 보증금을 올바르게 입력해 주세요.');
  if(!['house','office','other'].includes(kind)||!['sale','lease','rent'].includes(deal))throw Error('계약 종류를 확인해 주세요.');
  if(deal==='rent'&&rent===null)throw Error('월세를 올바르게 입력해 주세요.');
  const base=deal==='rent'?value+(rent*100):value;
  const tradeWan=deal==='rent'&&base<5000?value+rent*70:base;
  if(tradeWan>1e10)throw Error('거래금액을 확인해 주세요.');
  let rate,cap=null;
  if(kind==='other')rate=.009;
  else if(kind==='office')rate=deal==='sale'?.005:.004;
  else {
   const sale=deal==='sale';
   if(tradeWan<5000){rate=sale?.006:.005;cap=sale?250000:200000;}
   else if(tradeWan<(sale?20000:10000)){rate=sale?.005:.004;cap=sale?800000:300000;}
   else if(tradeWan<(sale?90000:60000))rate=sale?.004:.003;
   else if(tradeWan<120000)rate=sale?.005:.004;
   else if(tradeWan<150000)rate=sale?.006:.005;
   else rate=sale?.007:.006;
  }
  // Korean won is integral. Round floating-point percentage arithmetic once.
  const maximum=Math.round(Math.min(tradeWan*10000*rate,cap??Infinity));
  const additional=vat?Math.round(maximum*.1):0;
  return {baseWan:tradeWan,rate,maximum,vatWon:additional,total:maximum+additional,cap};
 }
 function conversion({oldWan,newWan,ratePct}){
  const old=amount(oldWan),next=amount(newWan),rate=percent(ratePct);
  if(old===null||next===null||rate===null)throw Error('두 보증금과 가정 전환율을 입력해 주세요.');
  const diff=old-next;
  return {monthlyWon:Math.abs(diff*10000*rate/100/12),direction:diff>0?'increase':diff<0?'decrease':'same'};
 }
 function loan({amountWan,ratePct,monthsCount,method}){
  const principalWan=amount(amountWan),rate=percent(ratePct),n=months(monthsCount);
  if(principalWan===null||principalWan===0||rate===null||n===null)throw Error('대출금·연 이자율·기간을 확인해 주세요.');
  if(!['equal','principal','bullet'].includes(method))throw Error('상환 방식을 확인해 주세요.');
  const p=principalWan*10000,r=rate/1200;
  let first,last,totalInterest;
  if(method==='equal'){
   // Stable annuity denominator near zero; zero rate has no interest.
   first=r===0?p/n:p*r/(1-Math.pow(1+r,-n));
   last=first;
   totalInterest=Math.max(0,first*n-p);
  }else if(method==='principal'){
   first=p/n+p*r;
   last=p/n+(p/n)*r;
   totalInterest=p*r*(n+1)/2;
  }else{
   first=p*r;
   last=p*(1+r);
   totalInterest=p*r*n;
  }
  return {first,last,totalInterest,principal:p,method};
 }
 function output(prefix,title,detail,caption){
  const t=$(prefix+'Primary'),d=$(prefix+'Detail');
  if(t)t.textContent=title;
  if(d)d.textContent=detail||'';
  const c=$(prefix+'Caption');if(c&&caption)c.textContent=caption;
 }
 function update(){
  if(chosen==='fee'){
   const deal=$('fhc_feeDeal').value,kind=$('fhc_feeKind').value;
   $('fhc_feeAmountLabel').textContent=deal==='sale'?'매매금액 (만원)':'보증금 (만원)';
   $('fhc_feeRentWrap').hidden=deal!=='rent';
   $('fhc_officeNote').hidden=kind!=='office';
   try{
    const result=commission({kind,deal,amountWan:$('fhc_feeAmount').value,
     rentWan:deal==='rent' ? $('fhc_feeRent').value :0,vat:$('fhc_feeVat').checked});
    const pieces=['적용 요율 상한 '+(result.rate*100).toFixed(1)+'%',
     '거래금액 '+WON.format(result.baseWan)+'만원'];
    if(result.cap!==null)pieces.push('보수 상한액 적용');
    if(result.vatWon>0)pieces.push('가정 부가세 '+money(result.vatWon));
    output('fhc_fee',money(result.maximum),pieces.join(' · ')+(result.vatWon>0?' · 합계 '+money(result.total):''));
   }catch(e){output('fhc_fee','금액을 확인해 주세요',e.message);}
  }else if(chosen==='conversion'){
   try{
    const result=conversion({oldWan:$('fhc_oldDeposit').value,newWan:$('fhc_newDeposit').value,ratePct:$('fhc_conversionRate').value});
    const direction=result.direction==='increase'?'월세가 늘어나는 가정':result.direction==='decrease'?'월세가 줄어드는 가정':'보증금 차이 없음';
    output('fhc_conversion',result.direction==='same'?'변동 없음':money(result.monthlyWon)+' / 월',direction+' · 입력한 전환율의 단순 산술 결과');
   }catch(e){output('fhc_conversion','조건을 확인해 주세요',e.message);}
  }else if(chosen==='loan'){
   try{
    const result=loan({amountWan:$('fhc_loanAmount').value,ratePct:$('fhc_loanRate').value,
     monthsCount:$('fhc_loanMonths').value,method:$('fhc_loanMethod').value});
    const caption=result.method==='principal'?'첫 달 납입액':result.method==='bullet'?'매월 이자액':'매월 납입액';
    let detail='총이자 약 '+money(result.totalInterest);
    if(result.method==='principal')detail+=' · 마지막 달 약 '+money(result.last);
    if(result.method==='bullet')detail+=' · 만기 원금·이자 약 '+money(result.last);
    output('fhc_loan',money(result.first),detail,caption);
   }catch(e){output('fhc_loan','조건을 확인해 주세요',e.message,'월 납입 예상액');}
  }
 }
 function taxValue(id){return String($(id)?.value||'').trim();}
 function taxWon(id,allowZero=false){
  const raw=taxValue(id);
  if(!/^\d+$/.test(raw))throw Error('금액을 만원 단위 정수로 입력해 주세요.');
  const n=Number(raw);
  if(!Number.isSafeInteger(n)||n>1000000000||(!allowZero&&n<1))throw Error('금액을 확인해 주세요.');
  return n;
 }
 function taxChoice(id,values,label){
  const value=taxValue(id);
  if(!values.includes(value))throw Error(label+' 항목을 확인하고 선택해 주세요.');
  return value;
 }
 function taxDate(id){
  const v=taxValue(id);
  if(!/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(v))throw Error('취득일과 양도일을 정확히 선택해 주세요.');
  const d=new Date(v+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error('날짜를 확인해 주세요.');
  return v.replace(/-/g,'');
 }
 function taxInputs(type){
  if(type==='acquisition')return {amount:taxWon('fhc_taxAmount'),
    areaType:taxChoice('fhc_taxArea',['40','60','85','big'],'전용면적'),
    own:taxChoice('fhc_taxOwn',['one','two','three','more'],'주택 수'),
    conArea:taxChoice('fhc_taxConArea',['Y','N'],'조정대상지역'),
    firstOfLife:taxChoice('fhc_taxFirstLife',['Y','N'],'생애최초 감면 대상'),
    metro:taxChoice('fhc_taxMetro',['Y','N'],'수도권 여부')};
  if(type!=='transfer')throw Error('세금 종류를 선택해 주세요.');
  const buyDate=taxDate('fhc_taxBuyDate'),sellDate=taxDate('fhc_taxSellDate');
  if(sellDate<buyDate)throw Error('양도일은 취득일보다 빠를 수 없습니다.');
  const v=taxValue('fhc_taxLiving');
  if(!/^\d+(?:\.\d+)?$/.test(v)||Number(v)>100)throw Error('실제 거주기간을 연 단위로 입력해 주세요.');
  const values={buyAmt:taxWon('fhc_taxBuyAmt'),sellAmt:taxWon('fhc_taxSellAmt'),buyDate,sellDate,
   own:taxChoice('fhc_taxTransferOwn',['one','two','more'],'주택 수'),
   conArea:taxChoice('fhc_taxTransferConArea',['Y','N'],'조정대상지역'),liveYear:Number(v)};
  if(taxValue('fhc_taxCost')!=='')values.cost=taxWon('fhc_taxCost',true);
  return values;
 }
 function taxStatus(message){
  const box=$('fhc_taxStatus');
  box.textContent=message||'';
  box.hidden=!message;
 }
 function taxProblem(code){
  switch(code){
   case 'account_session_required': return '사무실 계정에 다시 로그인해 주세요.';
   case 'tax_api_not_configured': return '계산 서비스 설정을 확인해 주세요.';
   case 'provider_auth_error': return '계산 서비스 인증에 문제가 있습니다.';
   case 'invalid_request':
   case 'invalid_amount':
   case 'invalid_housing_condition':
   case 'invalid_date':
   case 'invalid_date_order':
   case 'invalid_living_years':
   case 'invalid_boolean': return '입력 조건을 다시 확인해 주세요.';
   case 'rate_limited':
   case 'provider_rate_limited': return '계산 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
   case 'connection_timeout': return '응답이 지연되고 있습니다. 다시 시도해 주세요.';
   case 'provider_requires_review': return '계산 조건을 확인할 수 없습니다. 아래에서 직접 확인해 주세요.';
   default: return '계산에 실패했습니다. 다시 시도하거나 아래에서 직접 확인해 주세요.';
  }
 }
 function clearTax(){
  taxPending='';
  $('fhc_taxResult').hidden=true;
  $('fhc_taxRows').replaceChildren();
  $('fhc_taxBasis').textContent='';
  $('fhc_taxFallback').hidden=true;
  $('fhc_taxDiag').hidden=true;
  $('fhc_taxDiag').textContent='';
  taxStatus('');
  const button=$('fhc_taxCalculate');button.disabled=false;button.textContent='예상 세액 계산하기';
 }
 function onTaxEdit(){
  if(!['acquisition','transfer'].includes(chosen))return;
  clearTax();
 }
 function calculateTax(){
  if(!['acquisition','transfer'].includes(chosen))return false;
  let values;
  try{values=taxInputs(chosen);}catch(e){taxStatus(e.message);return false;}
  if(!root.FirstHyundaiNative?.calculateRealtyTax){
   taxStatus('앱 업데이트 후 계산하실 수 있습니다.');
   $('fhc_taxFallback').hidden=false;
   return false;
  }
  const requestId='tax-'+Date.now()+'-'+(++taxSequence);
  clearTax();taxPending=requestId;
  $('fhc_taxCalculate').disabled=true;
  $('fhc_taxCalculate').textContent='계산 확인 중…';
  taxStatus('계산 중…');
  try{root.FirstHyundaiNative.calculateRealtyTax(JSON.stringify({type:chosen,values}),requestId);}
  catch(e){clearTax();taxStatus('계산 요청을 시작하지 못했습니다.');$('fhc_taxFallback').hidden=false;return false;}
  return true;
 }
 function onTaxResult(event){
  if(!taxPending||event?.requestId!==taxPending)return;
  clearTax();
  const response=event?.data;
  if(event.ok!==true||response?.ok!==true||!Array.isArray(response.rows)){
   const code=String(event?.errorCode||response?.error||'network_error').slice(0,64);
   taxStatus(taxProblem(code));
   $('fhc_taxFallback').hidden=false;
   const http=Number(event?.httpStatus||0);
   $('fhc_taxDiag').textContent='계산 오류: '+code+(http>0?' · HTTP '+http:'');
   $('fhc_taxDiag').hidden=false;
   return;
  }
  const items=response.rows;
  if(!items.length){taxStatus('계산 결과가 없습니다. 외부 계산기를 이용해 주세요.');$('fhc_taxFallback').hidden=false;return;}
  const container=$('fhc_taxRows');
  for(const item of items.slice(0,100)){
   if(typeof item.label!=='string'||typeof item.value!=='string')continue;
   const row=document.createElement('div');
   row.className='fhcTaxRow';
   const label=document.createElement('span'),value=document.createElement('strong');
   label.textContent=item.label.slice(0,100);value.textContent=item.value.slice(0,140);
   row.append(label,value);
   if(item.note){const note=document.createElement('small');note.textContent=String(item.note).slice(0,240);row.append(note);}
   container.append(row);
  }
  $('fhc_taxBasis').textContent=String(response.basis||'').slice(0,1500);
  $('fhc_taxResult').hidden=false;
  taxStatus('');
  $('fhc_taxResult').scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 function select(type){
  if(!types.has(type))return false;
  if(taxPending)clearTax(); // A different calculator must never receive a late result.
  chosen=type;
  $('fhc_modes').hidden=true;
  $('fhc_detail').hidden=false;
  $('fhc_detailTitle').textContent=names[type];
  for(const name of ['fee','conversion','loan'])$('fhc_'+name+'Pane').hidden=type!==name;
  $('fhc_taxPane').hidden=!['acquisition','transfer'].includes(type);
  // Tax variants share one external-link panel, never an untrusted WebView iframe:
  // Android's JavascriptInterface is otherwise visible to child frames.
  if(type==='acquisition'||type==='transfer'){
   $('fhc_taxPane').hidden=false;
   $('fhc_taxIntro').textContent=type==='acquisition'
     ?'취득금액·주택 수·면적·규제지역·감면 여부를 확인해야 합니다.'
     :'취득/양도가액·날짜·거주기간·주택 수·필요경비 등을 확인해야 합니다.';
   $('fhc_taxExternal').href='https://xn--989a00af8jnslv3dba.com/'+(type==='acquisition'?'acquisition':'transfer');
   $('fhc_taxOfficial').href=type==='acquisition'?'https://www.wetax.go.kr':'https://www.hometax.go.kr';
   clearTax();
   $('fhc_taxAcquisition').hidden=type!=='acquisition';
   $('fhc_taxTransfer').hidden=type!=='transfer';
   taxStatus('');
  }
  update();
  $('fhc_detail').scrollIntoView?.({behavior:'smooth',block:'start'});
  return true;
 }
 function home(){
  if(taxPending)clearTax();
  chosen='';
  $('fhc_detail').hidden=true;
  $('fhc_modes').hidden=false;
 }
 function onPageChange(id){
  const quick=$('fhc_quickOpen');if(quick)quick.setAttribute('aria-current',id==='calculators'?'page':'false');
 }
 function onOpen(){onPageChange('calculators');}
 function useContractAmount(){
  const price=amount($('ct_price')?.value);
  if(price===null||price===0){output('fhc_fee','계약금액이 없습니다','계약 작성 화면에 매매금액을 먼저 입력해 주세요.');return false;}
  $('fhc_feeAmount').value=String(price);
  update();
  return true;
 }
 root.onFirstHyundaiRealtyTaxResult=onTaxResult;
 $('fhc_taxPane')?.addEventListener?.('input',onTaxEdit);
 $('fhc_taxPane')?.addEventListener?.('change',onTaxEdit);
 root.FirstHyundaiCalculators={select,home,update,onOpen,onPageChange,useContractAmount,calculateTax,
  _test:{commission,conversion,loan,num}};
})(window);
