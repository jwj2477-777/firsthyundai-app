
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
 const rx=/(?<![가-힣])(\d[\d,.]*(?:\s*(?:억|천|백|십|만|원))?(?:\s*\d[\d,.]*(?:\s*(?:억|천|백|십|만|원))?)*|[일이삼사오육륙칠팔구한십백천]+(?:\s*(?:억|만원|만|원))?(?:\s*[일이삼사오육륙칠팔구한십백천]+(?:천|백|십|만|원)?)*)/g;
 let m,res=[];
 while((m=rx.exec(text))!==null){
  const normalized=m[0].trim();
  if(normalized.length===1&&/[가-힣]/.test(text[rx.lastIndex]||''))continue; // 금일·오늘은 금액이 아님
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
 const shortYear=text.match(/(?<!\d)(\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?(?!\d)/);
 const month=text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
 const slash=text.match(/(?:^|\s)(\d{1,2})[./]\s*(\d{1,2})(?:일|(?=$|\s|[,;]))/);
 let year,mo,day,assumed=false;
 if(verbose){year=+verbose[1];mo=+verbose[2];day=+verbose[3];}
 else if(iso){year=+iso[1];if(year<100)year+=2000;mo=+iso[2];day=+iso[3];}
 else if(shortYear){year=2000+Number(shortYear[1]);mo=+shortYear[2];day=+shortYear[3];}
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
// Standalone "계약은 10월중 협의" belongs in the existing free-text contractDate field.
// Keep a verified calendar date as YYYY-MM-DD; leave negotiable schedules as written.
function contractScheduleCandidate(raw){
 const lines=String(raw||'').replace(/\r/g,'').split('\n');
 for(const item of lines){
  const line=item.trim().replace(/^[▶•]\s*/,'');
  const m=line.match(/^(?:본계약(?:서)?(?:\s*작성)?(?:일|날짜)?|계약서\s*작성(?:일|날짜)?|계약일|계약)(?:은|는|을|를)?\s*(?:[:：]\s*|\s+)(.+?)\s*$/);
  if(!m)continue; // "계약금 6천" is NOT a contract date.
  const rawValue=m[1].trim().replace(/[.。]\s*$/,'');
  const d=dateIn(rawValue);
  if(d)return {value:d.value,assumed:d.assumed,flexible:false};
  // A time window must not be faked into a specific date.
  const flexible=/^(?:(?:(?:20)?\d{2}\s*년\s*)?\d{1,2}\s*월\s*(?:초|중(?:순)?|말|상순|하순|경|내)(?:\s*(?:협의|예정|작성|진행))?|(?:추후|향후|차후|별도|상호)\s*(?:협의|조율|결정|예정)|(?:잔금|입주|이사)\s*전\s*(?:협의|작성|예정)|(?:일정|날짜)\s*(?:추후|별도)\s*협의|미정|협의\s*예정)$/;
  if(flexible.test(rawValue))return {value:rawValue,assumed:false,flexible:true};
 }
 return null;
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
const FIELDS=['property','unit','exclusiveArea','supplyInfo','price','contractDeposit','advance','interim','monthlyRent','contractDate','balanceDate','leaseStart','leaseEnd','leaseDuration','bank','account','accountHolder','terms'];
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
 let block=s.match(/(?:^|[^0-9])(\d{1,2})\s*(?:블럭|블록|bl\b|block\b)/i);
 // Only known Songdo families use this dong-prefix rule. A number alone is insufficient.
 const normalized=key(s);
 const families=[['퍼스트파크',['13','14','15']],['마스터뷰',['21','22','23']]].filter(([name])=>normalized.includes(name));
 const dongs=[...new Set(Array.from(s.matchAll(/(?<!\d)(\d{4})\s*동/g),m=>m[1]))];
 let searchText=s, blockConflict=false;
 if(families.length===1&&dongs.length===1){
  const [family,allowed]=families[0],prefix=dongs[0].slice(0,2);
  if(allowed.includes(prefix)){
   if(block&&block[1]!==prefix){
    blockConflict=true;
    review.push('입력한 '+block[1]+'블럭과 '+dongs[0]+'동의 블럭('+prefix+'블럭)이 다릅니다. 단지·동을 확인해 주세요.');
   }else if(!block){
    block=['',prefix];searchText=family+' '+prefix+'블럭 '+s;
    review.push(dongs[0]+'동의 앞 두 자리로 '+family+' '+prefix+'블럭을 추정했습니다. 단지와 주소를 확인해 주세요.');
   }
  }else{blockConflict=true;review.push('이 단지의 알려진 블럭과 동 번호가 맞지 않습니다. 단지를 직접 확인해 주세요.');}
 }else if(families.length>1||families.length&&dongs.length>1){
  blockConflict=true;review.push('여러 단지 또는 동이 입력되었습니다. 계약 대상 한 곳을 확인해 주세요.');
 }
 const buildings=(blockConflict?[]:apartmentCandidates(searchText)).filter(x=>{
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
 const unit=s.match(/(\d{1,4})\s*동\s*(?:에|의|이고|에있는|에\s*있는|,)?\s*(\d{1,4})\s*호\s*(\((?:\d{2,3}(?:\.\d+)?[A-Za-z가-힣0-9-]{0,8})\))?/);
 if(unit)apply('unit',unit[1]+'동 '+unit[2]+'호'+(unit[3]||''),found);
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
 let deposit=explicitTotal||ordinaryDeposit;
 // A percentage is not a denomination. "계약금 10%" must never mean 10만원.
 const percent=s.match(/(?:계약금|약정\s*계약금|전체\s*계약금)\s*(?:은|는|가|을|를|총|전체는|전체)?\s*[:：]?\s*(\d{1,2}(?:\.\d+)?)\s*(?:%|퍼센트|프로)(?![가-힣])/);
 if(percent){
  const rate=Number(percent[1]),total=Number(val('price'));
  if(rate>0&&rate<=100&&total>0){
   deposit={amount:Math.round(total*rate)/100};
   review.push('계약금 '+rate+'%를 총 거래금액에 적용했습니다. 실제 합의 금액인지 확인하세요.');
  }else{
   deposit=null;
   review.push('계약금 비율을 확인하지 못했습니다. 계약금 총액을 확인하세요.');
  }
 }
 if(deposit?.amount!=null)apply('contractDeposit',deposit.amount,found);
 let advance=amountAfter(s,['선입금','선송금','선금','일부\\s*계약금','이번\\s*송금액','이번\\s*입금','가계약금','먼저\\s*보낼','일단\\s*보낼','우선\\s*보낼']);
 // "오늘 500", "금일 천만원", and "(계약금의 일부 1,000만원)" are advance payments, not total deposit.
 if(!advance)advance=amountAfter(s,['오늘(?:은|에|부터)?','금일(?:은|에)?','당일(?:은|에)?','오늘\\s*입금','금일\\s*송금']);
 if(!advance){
  const m=s.match(/계약금(?:의|중)?\s*일부\s*\(?\s*([\d,]+(?:억|천|백|만원|만|원)?|[일이삼사오육륙칠팔구한십백천억만원]+)\s*\)?/);
  const n=m?moneyPart(m[1]):null;
  if(n!==null)advance={amount:n,raw:m[1]};
 }
 if(!advance)advance=amountAfter(s,['먼저','우선','일단']);
 if(!advance)advance=amountBefore(s,['먼저\\s*보내','먼저\\s*입금','먼저\\s*송금','먼저','선입금','송금해','입금해','보내고']);
 if(!advance){
  // "보증금 ... 오백 먼저" -- prefixed Korean currency.
  const m=s.match(/([일이삼사오육륙칠팔구한십백천\d,.억만원\\s]+?)\s*(?:만|만원|정도)?\s*(?:먼저|우선|선입금)\s*(?:보내|송금|입금)?/);
  if(m){const n=moneyPart(m[1].replace(/\s+/g,''));if(n!==null)advance={amount:n,raw:m[1]};}
 }
 if(advance?.amount!=null)apply('advance',advance.amount,found);
 // First isolate the interim payment from trailing dates. E.g., 4억 12년20일
 // is 4억 plus an unclear date, NOT a malformed monetary amount.
 const interimContext=/중도금(?!\s*(?:지급일|지급\s*예정일|일정|날짜))\s*(?:은|는)?\s*[:：]?\s*((?:\d[\d,.]*|[일이삼사오육륙칠팔구한십백천]+)\s*(?:억|천|백|만원|만|원))/.exec(s);
 const explicitInterim=interimContext?moneyPart(interimContext[1]):null;
 const interim=explicitInterim!==null?{amount:explicitInterim,raw:interimContext[1]}:
  amountAfter(s,['중도금(?!\\s*(?:지급일|지급\\s*예정일|일정|날짜))']);
 if(interim?.amount!=null)apply('interim',interim.amount,found);
 const interimLines=String(raw||'').replace(/\r/g,'').split('\n').filter(line=>/중도금/.test(line));
 for(const line of interimLines){
  const schedule=line.match(/중도금\s*(?:지급일|지급\s*예정일|날짜|일정)\s*[:：]?\s*(.+)/);
  if(schedule){
   const due=schedule[1].split(/(?=\s*(?:▶|잔금일|잔금\s*[:：]))/)[0].trim();
   if(due){apply('interimDate',due.slice(0,100),found);break;}
  }
  if(!interim?.amount)continue;
  const after=line.slice(line.indexOf('중도금')+3);
  const malformed=after.match(/(?:^|\s)(\d{1,2})\s*년\s*(\d{1,2})\s*일(?=\s|$|[,.;])/);
  if(malformed&&Number(malformed[1])<=12){
   review.push('중도금 일정 "'+malformed[0].trim()+'"은 월/년 표기가 불명확합니다. 실제 지급일을 직접 확인해 주세요.');
   break;
  }
  const token=after.match(/(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일?|20\d{2}[./-]\d{1,2}[./-]\d{1,2}/);
  if(token){
   const d=dateIn(token[0]);
   if(d){
    apply('interimDate',d.value,found);
    if(d.assumed)review.push('중도금 지급일의 연도를 추정했습니다. 실제 날짜를 확인해 주세요.');
   }
   break;
  }
 }
 const rent=amountAfter(s,['월차임','월세액','월세\\s*금액','월세는','월세']);
 if(deal==='월세'){
  const n=rentCombo?moneyPart(rentCombo[2]):rent?.amount;
  if(n!=null)apply('monthlyRent',n,found);
 }
 // "잔금 27년 1월30일" is a DATE, not a monetary amount.
 // Require a date-shaped token immediately following the standalone 잔금 label,
 // so "잔금 8억" or "중도금 및 잔금일 앞당길..." will not be misclassified.
 const bareBalance=s.match(/(?:^|[\s,;])잔금\s*[:：]?\s*((?:(?:20)?\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일?|(?:20)?\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일?))/);
 if(bareBalance){
  const d=dateIn(bareBalance[1]);
  if(d){
   apply('balanceDate',d.value,found);
   if(d.assumed)review.push('잔금일의 연도를 자동 추정했습니다. 실제 날짜를 확인해 주세요.');
  }
 }
 for(const [id,terms] of [
  ['balanceDate',['잔금\\s*날','잔금일','잔금\\s*예정일','잔금은','잔금\\s*치르','잔금\\s*처리','잔금']],
  ['leaseStart',['입주일','입주\\s*날','입주\\s*예정','입주','이사\\s*날','이사일','이사','임대차\\s*시작','임대차\\s*개시']],
  ['leaseEnd',['만기일','종료일','임대차\\s*종료']],
  ['contractDate',['계약서\\s*작성일','본계약\\s*작성일','본계약일','계약일','계약서\\s*쓰','계약서\\s*작성','본계약\\s*날']]
 ]){
  const d=dateFor(s,terms);if(d){
   apply(id,d.value,found);
   if(d.assumed)review.push((id==='balanceDate'?'잔금일':id==='leaseStart'?'입주일':id==='leaseEnd'?'만기일':'계약서 작성일')+'의 연도를 자동 추정했습니다. 확인하세요.');
  }else if(contextAfter(s,terms,40)&&/(?:말|초|중순|쯤|경|협의|미정)/.test(contextAfter(s,terms,40))){
   review.push((id==='balanceDate'?'잔금일':id==='leaseStart'?'입주일':'날짜')+'이 대략적으로 표현되어 정확한 날짜를 직접 선택해야 합니다.');
  }
 }
 const contractSchedule=contractScheduleCandidate(raw);
 if(contractSchedule){
  if(apply('contractDate',contractSchedule.value,found)){
   if(contractSchedule.flexible)review.push('본계약 작성일은 "'+contractSchedule.value+'" 협의 일정으로 반영했습니다. 정확한 작성일이 정해지면 갱신해 주세요.');
   else if(contractSchedule.assumed)review.push('본계약 작성일의 연도를 자동 추정했습니다. 확인해 주세요.');
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
 // An explicitly typed cadastral/road address overrides fuzzy complex lookup; never fabricate a block.
 const addressLine=String(raw||'').match(/(?:^|\n)\s*[▶→•]?\s*(?:소재지|주소)\s*[:：-]\s*([^\n]+)/m);
 const explicitAddress=addressLine?.[1]?.trim().replace(/[.\s]+$/,'')||'';
 const validAddress=explicitAddress&&/^(?:인천|서울|경기|부산|대구|광주|대전|울산|세종|제주|충남|충북|경남|경북|전남|전북|강원)/.test(explicitAddress)?explicitAddress:'';
 const writtenApartment=String(raw||'').match(/(?:^|\n)\s*[▶→•]?\s*(?:아파트명|단지명)\s*[:：-]\s*([^\n]+)/m);
 if(writtenApartment&&!val('property')){
  const name=writtenApartment[1].replace(/\d{3,4}\s*동.*$/,'').replace(/[.\s]+$/,'').trim();
  if(name)apply('property',name,found);
 }
 if(validAddress&&E('address')){
  if(!val('address'))apply('address',validAddress,found);
  else if(val('address')!==validAddress){
   if(found.some(x=>x.id==='property')){E('address').value=validAddress;found.push({id:'address',value:validAddress,source:'직접 입력한 소재지'});}
   review.push('입력한 소재지와 등록 단지의 도로명주소가 다릅니다. 직접 입력한 소재지를 확인하세요.');
  }
 }
 // Apartment shortcut gives source-backed exclusive square meters, never a
 // derived supply/market-pyeong approximation. This also supports typed notes.
 const areaLine=String(raw||'').match(/(?:^|\n)\s*(?:전용면적|전용㎡)\s*[:：]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:㎡|m²|m2)?\s*(?=\n|$)/im);
 if(areaLine){
  const n=Number(areaLine[1]);
  if(Number.isFinite(n)&&n>=10&&n<=400)apply('exclusiveArea',String(n),found);
 }
 const supplyLine=String(raw||'').match(/(?:^|\n)\s*공급타입\s*[:：]\s*(\d{2,3}(?:\.\d{1,2})?[A-Za-z0-9-]{0,8}타입\s*·\s*공급\s*\d{2,3}(?:\.\d{1,3})?㎡)\s*(?=\n|$)/m);
 if(supplyLine)apply('supplyInfo',supplyLine[1],found);
 // Account: a bank-name + plausible account-number + Korean payee name is high-confidence, even without an "account" label.
 const bankName='(?:KB\\s*)?(?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|수협|SC|부산|대구|경남|전북|광주|제주|케이뱅크)(?:은행)?';
 const bankAccountRx=new RegExp('('+bankName+')\\s*[:：(]?\\s*([0-9]{2,8}(?:[- ]?[0-9]{2,8}){2,5})(?:\\s+([가-힣]{2,4}))?','i');
 const bankTriplet=bankAccountRx.exec(s);
 const bankNamed=s.match(/(?:은행|송금계좌|입금계좌)\s*[:：]?\s*((?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|수협|SC|부산|대구|경남|전북|광주|제주)(?:은행)?)/i);
 if(bankTriplet){
  apply('bank',bankTriplet[1].trim(),found);
  apply('account',bankTriplet[2].replace(/\s/g,''),found);
  if(bankTriplet[3])apply('accountHolder',bankTriplet[3],found);
 }else if(bankNamed)apply('bank',bankNamed[1],found);
 const account=s.match(/(?:계좌번호|입금계좌|송금계좌|계좌는|계좌)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,8}\s*)?(\d{2,8}(?:[- ]?\d{2,8}){2,5})/);
 if(account)apply('account',account[1].replace(/\s/g,''),found);
 const holder=s.match(/(?:예금주|명의자)\s*[:：]?\s*([가-힣]{2,5})(?=\s|$|[,.;)\]])/);
 if(holder)apply('accountHolder',holder[1],found);
 // Broker shorthand: "집주인 김철수 / 세입자 이영희".
 const owner=s.match(/(?:집주인|임대인|매도인)\s*[:：]?\s*([가-힣]{2,4})(?=\s|$|[,.;/])/);
 const buyer=s.match(/(?:세입자|임차인|매수인)\s*[:：]?\s*([가-힣]{2,4})(?=\s|$|[,.;/])/);
 if(owner&&!/^(?:계좌|계약|송금|명의|은행|예금주)$/.test(owner[1]))apply('owner',owner[1],found);
 if(buyer&&!/^(?:계좌|계약|송금|명의|은행|예금주)$/.test(buyer[1]))apply('buyer',buyer[1],found);
 // Warn on a separately dictated remaining balance that differs from the calculated balance.
 const spokenBalance=amountAfter(s,['최종\\s*잔금','남은\\s*잔금','잔금액','잔금금액']);
 const computed=base._test.collect();
 if(spokenBalance?.amount!=null && computed.balance!==null&&Math.abs(spokenBalance.amount-computed.balance)>0.01){
  review.push('말씀하신 잔금 '+spokenBalance.amount.toLocaleString('ko-KR')+'만원과 자동 계산 금액 '+computed.balance.toLocaleString('ko-KR')+'만원이 다릅니다. 확인하세요.');
 }
 if(val('price'))smart.changed({target:E('price')}); // Derive the 10% default when missing.
 if(val('property')&&!validAddress)smart.onOpen();
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
   accountHolder:'예금주',interimDate:'중도금 지급일',address:'소재지',owner:'임대인·매도인',buyer:'임차인·매수인',terms:'특약'};
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
window.FirstHyundaiLanguage={parse,recognize,_test:{koreanNumber,moneyPart,tokenizeMoney,amountAfter,amountBefore,dateIn,contractScheduleCandidate,apartmentCandidates}};
})();
