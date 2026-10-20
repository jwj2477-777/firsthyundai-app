
/* FirstHyundai spoken contract parser: rule-assisted, fully on device. */
(function(){
'use strict';
const E=id=>document.getElementById('ct_'+id);
const val=id=>String(E(id)?.value||'').trim();
const smart=window.FirstHyundaiSmart;
const base=window.FirstHyundaiContracts;
let warnings=[], lastRecognized=[];
const key=s=>smart._test.key(s);
const digitWords={영:0,공:0,일:1,이:2,삼:3,사:4,오:5,육:6,륙:6,칠:7,팔:8,구:9};
const units={십:10,백:100,천:1000};
const MONEY_BODY='(?:\\d[\\d,.]*\\s*(?:억|천|백|십|만|원)?\\s*)+';
function koreanNumber(str){
 const src=String(str||'').replace(/\s/g,'').replace(/^한(?=[십백천])/, '일');
 if(!src||!/^[영공일이삼사오육륙칠팔구십백천]+$/.test(src))return null;
 let total=0,n=0,seen=false;
 for(const c of src){
  if(c in digitWords){n=digitWords[c];seen=true;}
  else if(units[c]){total+=(n||1)*units[c];n=0;seen=true;}
 }
 return seen?total+n:null;
}
function spokenNum(text){
 const src=String(text||'').trim();
 if(!src)return null;
 if(/^\d[\d,.]*$/.test(src)){const n=Number(src.replace(/,/g,''));return Number.isFinite(n)?n:null;}
 return koreanNumber(src);
}
function moneyPart(text){
 const src=String(text||'').replace(/[，,]/g,'').replace(/원정|정\b/g,'').replace(/\s+/g,'').trim();
 if(!src)return null;
 // Recognize explicitly spoken amounts: 삼억구천, 오백만, 3억9천, 3500, 3500만원
 if(!/^[\d.영공일이삼사오육륙칠팔구한십백천억만원]+$/.test(src))return null;
 if(/^[\d.]+원$/.test(src))return Number(src.slice(0,-1))/10000;
 let total=0,rest=src,hasEok=false;
 const eok=rest.match(/^(.+?)억/);
 if(eok){
  const n=spokenNum(eok[1]);if(n===null)return null;
  total+=n*10000;rest=rest.slice(eok[0].length);hasEok=true;
 }
 // Parsed small Korean numerals "오백", "구천", "삼천오백"
 if(/^[일이삼사오육륙칠팔구영공한십백천]+(?:만(?:원)?)?$/.test(rest)){
  const raw=rest.replace(/만원?$|원$/,'');
  const n=koreanNumber(raw);return n===null?null:total+n;
 }
 if(/^(\d+(?:\.\d+)?)(?:만(?:원)?)?$/.test(rest)){
  const n=Number(rest.match(/^\d+(?:\.\d+)?/)[0]);return total+n;
 }
 // Composite "9천5백", "2천", "4백십"
 let accum=0,matched=false;
 const re=/(\d+(?:\.\d+)?|[일이삼사오육륙칠팔구한]+)(천|백|십)/g;
 let last=0,m;
 while((m=re.exec(rest))!==null){
  if(m.index!==last)return null;
  const n=spokenNum(m[1]);if(n===null)return null;
  accum+=n*units[m[2]];last=re.lastIndex;matched=true;
 }
 const tail=rest.slice(last).replace(/만원?$|원$/,'');
 if(tail){
  const n=spokenNum(tail);if(n===null)return null;
  accum+=n;matched=true;
 }
 if(!matched && rest)return null;
 if(/원$/.test(src)&&!/만원$/.test(src)&&!hasEok&&!/[십백천]/.test(rest))return total+accum/10000;
 return total+accum;
}
function tokenizeMoney(s){
 const text=String(s||'');
 // Units written as separate Korean speech words are still part of the amount.
 const rx=/(\d[\d,.]*(?:\s*(?:억|천|백|십|만|원))?(?:\s*\d[\d,.]*(?:\s*(?:억|천|백|십|만|원))?)*|[일이삼사오육륙칠팔구한십백천]+(?:\s*(?:억|만원|만|원))?(?:\s*[일이삼사오육륙칠팔구한십백천]+(?:천|백|십|만|원)?)*)/g;
 let m,res=[];
 while((m=rx.exec(text))!==null){
  const normalized=m[0].trim();
  // Exclude possible apartment dong/ho numbers, year/month/day pieces.
  const behind=text.slice(rx.lastIndex).trimStart();
  if(/^(?:동|호|월|일|년|블럭|블록|bl\b|층)/i.test(behind))continue;
  const amount=moneyPart(normalized);
  if(amount!==null&&amount>0)res.push({amount,start:m.index,end:rx.lastIndex,raw:normalized});
 }
 return res;
}
function amountAfter(text,terms){
 const positions=[];
 for(const re of terms){const pattern=new RegExp(re,'g');let m;while((m=pattern.exec(text))!==null)positions.push({start:m.index,end:pattern.lastIndex});}
 const tokens=tokenizeMoney(text);
 const choices=[];
 for(const p of positions)for(const t of tokens){
  const gap=text.slice(p.end,t.start);
  if(t.start>=p.end&&gap.length<=22&&!/\d{2,4}\s*(?:동|호|월|일)/.test(gap)&&
     /^(?:\s|[:：,=·]|은|는|으로|에|약|한|금액|총|대략|정도|만원|으로는|할게|할거야|짜리|를|이|가)*$/.test(gap.trim())){
   choices.push({...t,offset:t.start-p.end});
  }
 }
 choices.sort((a,b)=>a.offset-b.offset||a.start-b.start);
 return choices[0]||null;
}
function amountBefore(text,words){
 const tokens=tokenizeMoney(text),out=[];
 for(const w of words){const pattern=new RegExp(w,'g');let m;while((m=pattern.exec(text))!==null){
  for(const t of tokens){const gap=text.slice(t.end,m.index);
   if(t.end<=m.index&&gap.length<=17&&/^(?:\s|[:：,·]|은|는|을|를|정도|부터|만|먼저|일단|우선)*$/.test(gap.trim()))out.push({...t,offset:m.index-t.end});
  }
 }}
 out.sort((a,b)=>a.offset-b.offset);return out[0]||null;
}
function dateIn(part,now=new Date()){
 const text=String(part||'');
 const iso=text.match(/(?:20)?(\d{2})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})(?!\d)/);
 const verbose=text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
 const month=text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
 const slash=text.match(/(?:^|\s)(\d{1,2})[./]\s*(\d{1,2})(?:일|(?=$|\s|[,;]))/);
 let year,mo,day,assumed=false;
 if(verbose){year=+verbose[1];mo=+verbose[2];day=+verbose[3];}
 else if(iso){year=+iso[1];if(year<100)year+=2000;mo=+iso[2];day=+iso[3];}
 else if(month||slash){
  const m=month||slash;year=now.getFullYear();mo=+m[1];day=+m[2];assumed=true;
  const check=new Date(year,mo-1,day);
  if(check.getFullYear()===year&&check.getMonth()===mo-1&&check.getDate()===day&&check<new Date(now.getFullYear(),now.getMonth(),now.getDate()))year++;
 }else return null;
 const parsed=new Date(year,mo-1,day);
 if(parsed.getFullYear()!==year||parsed.getMonth()!==mo-1||parsed.getDate()!==day)return null;
 return {value:year+'-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0'),assumed};
}
function contextAfter(text,keywords,size=65){
 for(const k of keywords){const match=new RegExp(k,'g').exec(text);if(match)return text.slice(match.index,match.index+size);}
 return '';
}
function dateFor(text,keywords){
 const part=contextAfter(text,keywords,70);
 if(!part)return null;
 return dateIn(part);
}
function apartmentCandidates(text){
 const baseWords=String(text||'').replace(/[，,.:;!?]/g,' ').split(/\s+/).filter(Boolean);
 const windows=[];
 for(let i=0;i<baseWords.length;i++){
  for(let len=1;len<=5&&i+len<=baseWords.length;len++){
   let chunk=baseWords.slice(i,i+len).join(' ');
   // Terminate before unit number, money labels, or hard-boundary suffix.
   chunk=chunk.replace(/\d{3,4}\s*동.*$/,'').replace(/(?:전세|매매|월세|보증금|잔금|계약금).*$/,'').trim();
   if(chunk&&key(chunk).length>=3)windows.push(chunk);
  }
 }
 const scored=new Map();
 for(const phrase of windows){
  for(const c of smart._test.choices(phrase)){
   const prev=scored.get(c.row.id);
   if(!prev||c.score>prev.score)scored.set(c.row.id,{...c,phrase});
  }
 }
 return [...scored.values()].sort((a,b)=>b.score-a.score||a.row.label.localeCompare(b.row.label,'ko'));
}
const FIELDS=['property','unit','price','contractDeposit','advance','interim','monthlyRent','contractDate','balanceDate','leaseStart','leaseEnd','leaseDuration','bank','account','accountHolder','terms'];
function apply(id,newValue,found,source){
 if(newValue==null||newValue==='')return false;
 const e=E(id);if(!e||val(id))return false;
 e.value=String(newValue);
 found.push({id,value:String(newValue),source:source||'메모'});
 return true;
}
function recognize(raw){
 let s=String(raw||'').normalize('NFKC').replace(/\r/g,'').replace(/[，]/g,',').replace(/\s+/g,' ').trim();
 const found=[],review=[];
 const deal=/월세|반전세|반 전세|월차임/.test(s)?'월세':/매매|매도|매수|팔기로|사기로/.test(s)?'매매':/전세|임차|임대/.test(s)?'전세':null;
 if(deal&&(!val('price')||!val('unit'))&&E('dealType')){E('dealType').value=deal;found.push({id:'dealType',value:deal,source:'문맥'});}
 const block=s.match(/(?:^|[^0-9])(\d{1,2})\s*(?:블럭|블록|bl\b|block\b)/i);
 const buildings=apartmentCandidates(s).filter(x=>{
  if(!block)return true;
  const rowBlock=x.row.label.match(/(\d{1,2})\s*(?:블럭|블록|bl\b|block\b)/i);
  return !rowBlock||rowBlock[1]===block[1];
 });
 if(!val('property')&&buildings.length){
  const first=buildings[0],second=buildings[1];
  const blockSpecific=!!block&&buildings.filter(x=>new RegExp('(?:^|[^0-9])'+block[1]+'\\s*(?:블럭|블록|bl\\b|block\\b)','i').test(x.row.label)).length===1;
  if((first.score>=78&&(!second||first.score-second.score>=15))||(blockSpecific&&first.score>=66&&new RegExp('(?:^|[^0-9])'+block[1]+'\\s*(?:블럭|블록|bl\\b|block\\b)','i').test(first.row.label))){
   smart.select(first.row.id);
   found.push({id:'property',value:first.row.label,source:'단지 카탈로그'});
  }else if(first.score>=66){
   review.push('단지명이 여러 곳과 비슷합니다. 주소 후보를 확인해 선택하세요.');
   // Display suggestions using existing field's fuzzy matcher.
   if(!val('property'))E('property').value=first.phrase;
   smart.onOpen();
  }
 }
 // Match a 3-4 digit dong and 1-4 digit ho, allowing natural filler words.
 const unit=s.match(/(\d{1,4})\s*동\s*(?:에|의|이고|에있는|에\s*있는|,)?\s*(\d{1,4})\s*호/);
 if(unit)apply('unit',unit[1]+'동 '+unit[2]+'호',found);
 else{
  const short=s.match(/(?:동\s*호수|동호수|호실|대상물)\s*[:：]?\s*(\d{3,4})\s*[-/]\s*(\d{1,4})/);
  if(short)apply('unit',short[1]+'동 '+short[2]+'호',found);
 }
 // Contract amount rules. Numerals next to "잔금" are never the total transaction price.
 let price=amountAfter(s,['전세\\s*보증금','보증금','전세금','전세가','전세\\s*대금','매매\\s*대금','매매가','매매금액','매매','집값','전세','보증금은']);
 let rentCombo=s.match(/(?:월세|반전세)\s+([일이삼사오육륙칠팔구한십백천\d,.억만원\\s]+?)\s*에\s*([일이삼사오육륙칠팔구한십백천\d,.억만원]+)(?![가-힣\d])/);
 if(!rentCombo&&deal==='월세')rentCombo=s.match(/(?:^|\s|,)([일이삼사오육륙칠팔구한십백천\d,.억만원]+)\s*에\s*([일이삼사오육륙칠팔구한십백천\d,.억만원]+)(?=\s|,|$)/);
 if(!price&&rentCombo)price={amount:moneyPart(rentCombo[1]),raw:rentCombo[1]};
 if(price?.amount!=null)apply('price',price.amount,found);
 const explicitTotal=amountAfter(s,['약정\\s*계약금','총\\s*계약금','전체\\s*계약금','계약금\\s*전체는','계약금\\s*전체','계약금\\s*총액']);
 let ordinaryDeposit=amountAfter(s,['계약금']);
 // "계약금 500 먼저" means the advance, not the entire agreed deposit.
 if(ordinaryDeposit&&/^(?:\s|만원|원|정도)*(?:먼저|보내|송금|입금)/.test(s.slice(ordinaryDeposit.end,ordinaryDeposit.end+15)))ordinaryDeposit=null;
 const deposit=explicitTotal||ordinaryDeposit;
 if(deposit?.amount!=null)apply('contractDeposit',deposit.amount,found);
 let advance=amountAfter(s,['선입금','선송금','선금','일부\\s*계약금','이번\\s*송금액','이번\\s*입금','가계약금','먼저\\s*보낼','일단\\s*보낼','우선\\s*보낼']);
 if(!advance)advance=amountAfter(s,['먼저','우선','일단']);
 if(!advance)advance=amountBefore(s,['먼저\\s*보내','먼저\\s*입금','먼저\\s*송금','먼저','선입금','송금해','입금해','보내고']);
 if(!advance){
  // "보증금 ... 오백 먼저" -- prefixed Korean currency.
  const m=s.match(/([일이삼사오육륙칠팔구한십백천\d,.억만원\\s]+?)\s*(?:만|만원|정도)?\s*(?:먼저|우선|선입금)\s*(?:보내|송금|입금)?/);
  if(m){const n=moneyPart(m[1].replace(/\s+/g,''));if(n!==null)advance={amount:n,raw:m[1]};}
 }
 if(advance?.amount!=null)apply('advance',advance.amount,found);
 const interim=amountAfter(s,['중도금']);if(interim?.amount!=null)apply('interim',interim.amount,found);
 const rent=amountAfter(s,['월차임','월세액','월세\\s*금액','월세는','월세']);
 if(deal==='월세'){
  const n=rentCombo?moneyPart(rentCombo[2]):rent?.amount;
  if(n!=null)apply('monthlyRent',n,found);
 }
 for(const [id,terms] of [
  ['balanceDate',['잔금\\s*날','잔금일','잔금\\s*예정일','잔금은','잔금\\s*치르','잔금\\s*처리','잔금']],
  ['leaseStart',['입주일','입주\\s*날','입주\\s*예정','입주','임대차\\s*시작','임대차\\s*개시']],
  ['leaseEnd',['만기일','종료일','임대차\\s*종료']],
  ['contractDate',['계약서\\s*작성일','본계약\\s*작성일','계약서\\s*쓰','계약서\\s*작성','본계약\\s*날']]
 ]){
  const d=dateFor(s,terms);if(d){
   apply(id,d.value,found);
   if(d.assumed)review.push((id==='balanceDate'?'잔금일':id==='leaseStart'?'입주일':id==='leaseEnd'?'만기일':'계약서 작성일')+'의 연도를 자동 추정했습니다. 확인하세요.');
  }else if(contextAfter(s,terms,40)&&/(?:말|초|중순|쯤|경|협의|미정)/.test(contextAfter(s,terms,40))){
   review.push((id==='balanceDate'?'잔금일':id==='leaseStart'?'입주일':'날짜')+'이 대략적으로 표현되어 정확한 날짜를 직접 선택해야 합니다.');
  }
 }
 if(!val('leaseDuration')){
  const duration=s.match(/(?:임대차\\s*기간|계약\\s*기간|기간은?|기간|(?:전세|월세))\s*(\d+\s*년(?:\s*\d+\s*개월)?|\d+\s*개월)/);
  if(duration)apply('leaseDuration',duration[1].replace(/\s+/g,''),found);
  else if(/(?:2년|이년)\s*(?:계약|거주|살|임대)/.test(s))apply('leaseDuration','2년',found);
  else if(deal!=='매매'&&/(?:전세|월세|반전세|임대차|임차인)/.test(s)){
   // "전세 ... 잔금 12월 30일. 2년." also states a duration.
   const isolated=s.match(/(?:^|[,.;]\s*|\s)([1-9]\d?)\s*년(?!\s*(?:전|전부터|째|만에|전에|경과|뒤|후))(?:\s|$|[,.])/);
   if(isolated&&Number(isolated[1])<=10)apply('leaseDuration',isolated[1]+'년',found);
  }
 }
 // Preserve literal agreement clauses. Avoid inventing legal terms.
 if(!val('terms')){
  const m=raw.match(/(?:^|\n)\s*(?:특약|특약사항|합의사항)\s*[:：]\s*([^\n]+(?:\n(?!\s*(?:계약금|보증금|잔금|계좌|은행|예금주))[\s\S]*)?)/m);
  if(m&&m[1])apply('terms',m[1].trim().slice(0,6000),found);
 }
 // Account: recognition only when a clear field label exists, not by guessing a bank/account holder.
 const bank=s.match(/(?:은행|송금계좌|입금계좌)\s*[:：]?\s*((?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|수협|SC|부산|대구|경남|전북|광주|제주)(?:은행)?)/i)
  ||s.match(/\b((?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|수협)(?:은행)?)\s+\d{2,5}[-\d]+/);
 if(bank)apply('bank',bank[1],found);
 const account=s.match(/(?:계좌번호|입금계좌|송금계좌|계좌는|계좌)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,8}\s*)?(\d{2,6}(?:[- ]?\d{2,8}){2,5})/);
 if(account)apply('account',account[1],found);
 const holder=s.match(/(?:예금주|명의자)\s*[:：]?\s*([가-힣]{2,5})(?=\s|$|[,.;])/);
 if(holder)apply('accountHolder',holder[1],found);
 // Warn on a separately dictated remaining balance that differs from the calculated balance.
 const spokenBalance=amountAfter(s,['최종\\s*잔금','남은\\s*잔금','잔금액','잔금금액']);
 const computed=base._test.collect();
 if(spokenBalance?.amount!=null && computed.balance!==null&&Math.abs(spokenBalance.amount-computed.balance)>0.01){
  review.push('말씀하신 잔금 '+spokenBalance.amount.toLocaleString('ko-KR')+'만원과 자동 계산 금액 '+computed.balance.toLocaleString('ko-KR')+'만원이 다릅니다. 확인하세요.');
 }
 if(val('price'))smart.changed({target:E('price')}); // Derive the 10% default when missing.
 if(val('property'))smart.onOpen();
 base.updateSummary();
 return {found,review};
}
function report(data){
 warnings=data.review;lastRecognized=data.found;
 const view=E('recognized');
 if(view){
  const labels={dealType:'거래유형',property:'아파트',unit:'동·호수',price:'총 금액',contractDeposit:'약정 계약금',
   advance:'선송금액',interim:'중도금',monthlyRent:'월세',balanceDate:'잔금일',leaseStart:'입주일',
   leaseEnd:'종료일',contractDate:'본계약일',leaseDuration:'임대차 기간',bank:'은행',account:'계좌번호',
   accountHolder:'예금주',terms:'특약'};
  view.textContent=data.found.length?
   '✓ 자동 인식: '+data.found.map(x=>labels[x.id]||x.id).join(' · '):
   '자동으로 확정할 수 있는 항목을 찾지 못했습니다. 아래 입력란에서 직접 확인해 주세요.';
 }
 const warningBox=E('languageWarnings');
 if(warningBox){warningBox.textContent=warnings.length?'확인할 내용\n• '+warnings.join('\n• '):'자동으로 입력한 정보도 발송 전에 한 번 더 확인해 주세요.';warningBox.className='contractReview'+(warnings.length?' bad':'');}
 const status=E('autoStatus');
 if(status&&data.found.length)status.textContent=data.found.length+'개 항목을 찾아 입력했습니다. '+
   (warnings.length?'미확정 내용은 노란 안내를 확인해 주세요.':'정확한 동호수·금액·계좌를 다시 확인해 주세요.');
}
function parse(){
 const raw=val('rough');
 if(!raw){alert('먼저 현장 메모나 음성입력 내용을 적어 주세요.');return;}
 const result=recognize(raw);report(result);
 return result;
}
function speech(result){
 if(result?.ok&&typeof result.text==='string'){
  E('rough').value+=(val('rough')?'\n':'')+result.text.slice(0,3000);
  parse();
 }else if(result&&!result.cancelled)alert('음성입력에 실패했습니다. 직접 적어 주세요.');
}
window.firstHyundaiContractSpeech=speech;
base.extractNotes=parse;
smart.extractNotes=parse;
window.FirstHyundaiLanguage={parse,recognize,_test:{koreanNumber,moneyPart,tokenizeMoney,amountAfter,amountBefore,dateIn,apartmentCandidates}};
})();
