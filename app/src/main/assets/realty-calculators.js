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
   first=r===0?p/n:p*r/(-Math.expm1(-n*Math.log1p(r)));
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
    output('fhc_fee',money(result.total),pieces.join(' · ')+(result.vatWon>0?' · 부가세 포함 합계':' · 부가세 제외'),result.vatWon>0?'부가세 포함 예상 합계':'예상 중개보수 상한');
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
  if(type==='acquisition'){
   const own=taxChoice('fhc_taxOwn',['one','two','three','more'],'주택 수');
   const conArea=taxChoice('fhc_taxConArea',['Y','N'],'조정대상지역');
   const data={amount:taxWon('fhc_taxAmount'),areaType:taxChoice('fhc_taxArea',['40','60','85','big'],'전용면적'),
    own,conArea,firstOfLife:taxChoice('fhc_taxFirstLife',['Y','N'],'생애최초 감면 대상'),
    metro:taxChoice('fhc_taxMetro',['Y','N'],'수도권 여부')};
   if(data.firstOfLife==='Y')data.firstHomeType=taxChoice('fhc_taxFirstHomeType',['general','small'],'생애최초 감면 구분');
   if(own==='two'&&conArea==='Y')data.tempTwo=taxChoice('fhc_taxTemporaryTwo',['Y','N'],'일시적 2주택 여부');
   return data;
  }
  if(type!=='transfer')throw Error('세금 종류를 선택해 주세요.');
  const buyDate=taxDate('fhc_taxBuyDate'),sellDate=taxDate('fhc_taxSellDate');
  if(sellDate<buyDate)throw Error('양도일은 취득일보다 빠를 수 없습니다.');
  const v=taxValue('fhc_taxLiving');
  if(!/^\d+(?:\.\d+)?$/.test(v)||Number(v)>100)throw Error('실제 거주기간을 연 단위로 입력해 주세요.');
  const values={buyAmt:taxWon('fhc_taxBuyAmt'),sellAmt:taxWon('fhc_taxSellAmt'),buyDate,sellDate,
   own:taxChoice('fhc_taxTransferOwn',['one','two','more'],'주택 수'),
   conArea:taxChoice('fhc_taxTransferConArea',['Y','N'],'조정대상지역'),liveYear:Number(v)};
  if(taxValue('fhc_taxCost')!=='')values.cost=taxWon('fhc_taxCost',true);
  if(values.own==='one'&&taxValue('fhc_taxExemptionVerified'))values.exemptionVerified=taxChoice('fhc_taxExemptionVerified',['Y','N'],'1주택 비과세 확인');
  return values;
 }
 function simpleAcquisitionTax(v){
  if(!v||!['one','two','three','more'].includes(v.own)||!['Y','N'].includes(v.firstOfLife)||!['Y','N'].includes(v.metro)||
     !['Y','N'].includes(v.conArea)||!['40','60','85','big'].includes(v.areaType))return null;
  if(v.areaType==='big'&&v.metro==='N')return null;
  if(v.own==='two'&&v.conArea==='Y'&&!['Y','N'].includes(v.tempTwo))return null;
  if(v.own==='two'&&v.tempTwo==='Y'&&v.conArea!=='Y')return null;
  const man=v.amount;
  if(!Number.isSafeInteger(man)||man<1||man>1000000000)return null;
  if(v.firstOfLife==='Y'){
   if(v.own!=='one'||man>120000||v.areaType==='big'||!['general','small'].includes(v.firstHomeType))return null;
   if(v.firstHomeType==='small'&&(!['40','60'].includes(v.areaType)||man>(v.metro==='Y'?60000:30000)))return null;
  }
  const general=man<=60000?1:man>90000?3:Math.round((man/10000*2/3-3)*100)/100;
  let rate=general,educationRate=general/10,ruralRate=v.areaType==='big'?.2:0;
  if(v.own==='two'&&v.conArea==='Y'&&v.tempTwo==='N')rate=8;
  if(v.own==='three')rate=v.conArea==='Y'?12:8;
  if(v.own==='more')rate=12;
  if(rate===8){educationRate=.4;ruralRate=v.areaType==='big'?.6:0;}
  if(rate===12){educationRate=.4;ruralRate=v.areaType==='big'?1:0;}
  const base=man*10000,grossAcquisition=Math.round(base*rate/100);
  const discount=v.firstOfLife==='Y'?Math.min(grossAcquisition,v.firstHomeType==='small'?3000000:2000000):0;
  const acquisition=grossAcquisition-discount;
  const education=v.firstOfLife==='Y'?Math.round(acquisition*.1):Math.round(base*educationRate/100);
  const rural=Math.round(base*ruralRate/100);
  const totalWon=acquisition+education+rural;
  const caution=v.firstOfLife==='Y'
    ?'생애최초 요건을 확인한 취득자에 한한 감면 가정. 실제 거주·주택 유형·추징 사유에 따라 달라질 수 있음'
    :v.own==='two'&&v.tempTwo==='Y'
    ?'일시적 2주택의 처분 기한과 요건이 충족된 것으로 가정. 미충족 시 추징 가능'
    :(rate>=8?'중과 배제 주택·공시가격 예외·주택 수 산정 특례는 미반영':'법정 기본세율이며 별도 감면·중과 제외·과세표준 예외는 미반영');
  return {ok:true,totalWon,source:'local_basic',
   rows:[{label:'예상 합계',value:money(totalWon)},
     {label:'취득세 ('+rate.toFixed(2)+'%'+(discount?' · 감면 '+money(discount):'')+')',value:money(acquisition)},
     {label:'지방교육세',value:money(education)},{label:'농어촌특별세',value:money(rural)}],
   basis:'앱 자체 계산 · 외부 API 전송 없음. 2026년 11월 기준 주택 유상취득 세율. '+caution+'. 신고 전 위택스·관할 지자체에서 확인해 주세요.'};
 }
 function heldFullYears(buyDate,sellDate){
  const by=Number(buyDate.slice(0,4)),bm=buyDate.slice(4),sy=Number(sellDate.slice(0,4)),sm=sellDate.slice(4);
  return sy-by-(sm<bm?1:0);
 }
 function standardTaxByBase(base){
  const bands=[[14000000,.06,0],[50000000,.15,1260000],[88000000,.24,5760000],
   [150000000,.35,15440000],[300000000,.38,19940000],
   [500000000,.40,25940000],[1000000000,.42,35940000],[Infinity,.45,65940000]];
  for(const [limit,rate,deduct] of bands)if(base<=limit)return Math.max(0,Math.round(base*rate-deduct));
  throw Error('invalid_tax_bracket');
 }
 function simpleTransferTax(v){
  // Only the tax regime of an explicitly VERIFIED qualifying one-house sale.
  if(!v||v.own!=='one'||v.exemptionVerified!=='Y'||!['Y','N'].includes(v.conArea)||
     !/^[0-9]{8}$/.test(String(v.buyDate))||!/^[0-9]{8}$/.test(String(v.sellDate))||
     v.sellDate<'20230101'||v.sellDate>'20261231')return null;
  const held=heldFullYears(v.buyDate,v.sellDate);
  if(held<2||!Number.isFinite(v.liveYear)||v.liveYear<2||v.liveYear>held+1)return null;
  if(!Number.isSafeInteger(v.buyAmt)||!Number.isSafeInteger(v.sellAmt)||v.buyAmt<1||v.sellAmt<1)return null;
  const cost=v.cost===undefined?0:v.cost;
  if(!Number.isSafeInteger(cost)||cost<0)return null;
  const sell=v.sellAmt*10000,buy=v.buyAmt*10000,gain=Math.max(0,sell-buy-cost*10000);
  const taxableGain=Math.round(gain*Math.max(0,(sell-1200000000)/sell));
  const holdingRate=held>=3?Math.min(held*4,40):0,residenceRate=held>=3?Math.min(Math.floor(v.liveYear)*4,40):0;
  const longDeduction=Math.round(taxableGain*(holdingRate+residenceRate)/100);
  const taxBase=Math.max(0,taxableGain-longDeduction-2500000),incomeTax=standardTaxByBase(taxBase),
   localTax=Math.round(incomeTax*.1),totalWon=incomeTax+localTax;
  return {ok:true,source:'local_qualified_one_home',totalWon,
   rows:[{label:'예상 합계',value:money(totalWon)},{label:'양도차익',value:money(gain)},
    {label:'과세대상 양도차익',value:money(taxableGain)},
    {label:'장기보유특별공제 ('+(holdingRate+residenceRate)+'%)',value:money(longDeduction)},
    {label:'과세표준 (기본공제 250만원 가정)',value:money(taxBase)},
    {label:'양도소득세',value:money(incomeTax)},{label:'지방소득세',value:money(localTax)}],
   basis:'앱 자체 계산 · 외부 API 전송 없음. 사용자가 1세대1주택 비과세 요건을 직접 확인한 2023~2026년 양도 가정. 고가주택 12억원 초과분만 과세, 보유·거주 연4%(각 최대40%) 및 기본공제 250만원 가정. 다른 양도·공동명의·취득 당시 조정지역·세금 특례는 미반영. 반드시 세무전문가에게 확인해 주세요.'};
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
   case 'provider_forbidden': return '계산 서비스가 요청을 거절했습니다. 외부 계산기를 이용해 주세요.';
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
   case 'provider_unavailable':
   case 'network_error':
   case 'tax_server_error': return '외부 계산 서비스에 연결되지 않습니다. 아래에서 직접 확인해 주세요.';
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
 function updateTaxFields(){
  if(chosen==='acquisition'){
   const el=$('fhc_taxTempTwoField');
   if(el)el.hidden=!(taxValue('fhc_taxOwn')==='two'&&taxValue('fhc_taxConArea')==='Y');
   const first=$('fhc_taxFirstHomeField');
   if(first)first.hidden=taxValue('fhc_taxFirstLife')!=='Y';
  }else if(chosen==='transfer'){
   const el=$('fhc_taxExemptionField');
   if(el)el.hidden=taxValue('fhc_taxTransferOwn')!=='one';
  }
 }
 function onTaxEdit(){
  if(!['acquisition','transfer'].includes(chosen))return;
  clearTax();updateTaxFields();
 }
 function calculateTax(){
  if(!['acquisition','transfer'].includes(chosen))return false;
  let values;
  try{values=taxInputs(chosen);}catch(e){taxStatus(e.message);return false;}
  const local=chosen==='acquisition'?simpleAcquisitionTax(values):simpleTransferTax(values);
  if(local){clearTax();showTaxResult(local);return true;}
  if(chosen==='acquisition'&&values.firstOfLife==='Y'){
   taxStatus('해당 조건은 생애최초 감면의 일반 산식 범위를 벗어납니다. 상세 확인이 필요합니다.');
   $('fhc_taxFallback').hidden=false;return false;
  }
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
  const providerValues={...values};
  delete providerValues.tempTwo;
  delete providerValues.exemptionVerified;
  delete providerValues.firstHomeType;
  try{root.FirstHyundaiNative.calculateRealtyTax(JSON.stringify({type:chosen,values:providerValues}),requestId);}
  catch(e){clearTax();taxStatus('계산 요청을 시작하지 못했습니다.');$('fhc_taxFallback').hidden=false;return false;}
  return true;
 }
 function showTaxResult(response){
  if(!Array.isArray(response.rows)||!response.rows.length){
   taxStatus('계산 결과가 없습니다. 외부 계산기를 이용해 주세요.');
   $('fhc_taxFallback').hidden=false;return;
  }
  const container=$('fhc_taxRows');
  for(const item of response.rows.slice(0,100)){
   if(typeof item.label!=='string'||typeof item.value!=='string')continue;
   const row=document.createElement('div');row.className='fhcTaxRow';
   const label=document.createElement('span'),value=document.createElement('strong');
   label.textContent=item.label.slice(0,100);value.textContent=item.value.slice(0,140);
   row.append(label,value);
   if(item.note){const note=document.createElement('small');note.textContent=String(item.note).slice(0,240);row.append(note);}
   container.append(row);
  }
  $('fhc_taxBasis').textContent=String(response.basis||'').slice(0,1500);
  $('fhc_taxResult').hidden=false;taxStatus('');
  $('fhc_taxResult').scrollIntoView?.({behavior:'smooth',block:'start'});
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
  showTaxResult(response);
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
   updateTaxFields();taxStatus('');
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
  _test:{commission,conversion,loan,num,simpleAcquisitionTax,simpleTransferTax,standardTaxByBase,heldFullYears}};
})(window);
