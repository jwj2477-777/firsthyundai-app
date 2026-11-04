/* 퍼스트현대 부동산 계산기: offline arithmetic only. No customer data is sent or stored. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const WON=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
 const types=new Set(['acquisition','transfer','fee','conversion','loan']);
 const names={acquisition:'취득세',transfer:'양도소득세',fee:'중개보수',conversion:'전월세 전환',loan:'대출이자'};
 let chosen='';
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
  const maximum=Math.min(tradeWan*10000*rate,cap??Infinity);
  const additional=vat?maximum*.1:0;
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
 function select(type){
  if(!types.has(type))return false;
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
  }
  update();
  $('fhc_detail').scrollIntoView?.({behavior:'smooth',block:'start'});
  return true;
 }
 function home(){
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
 root.FirstHyundaiCalculators={select,home,update,onOpen,onPageChange,useContractAmount,
  _test:{commission,conversion,loan,num}};
})(window);
