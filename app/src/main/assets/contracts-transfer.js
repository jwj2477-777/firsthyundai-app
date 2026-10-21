/* 퍼스트현대: account and partial-deposit extraction independent of spoken field order.
 * On-device only. Values are draft candidates; uncertain matches are not invented. */
(function(){
'use strict';
const language=window.FirstHyundaiLanguage,core=window.FirstHyundaiContracts;
if(!language||!core)return;
const E=id=>document.getElementById('ct_'+id);
const v=id=>String(E(id)?.value||'').trim();
const bankNames=/국민은행|KB국민|국민|신한은행|신한|우리은행|우리|하나은행|하나|농협은행|NH농협|농협|기업은행|IBK기업|기업|카카오뱅크|카카오은행|카카오|토스뱅크|토스은행|토스|새마을금고|새마을|우체국|수협은행|수협|SC제일은행|SC제일|부산은행|대구은행|경남은행|전북은행|광주은행|제주은행|케이뱅크/gi;
const reserved=/^(?:매도인|매수인|임대인|임차인|집주인|세입자|계좌|계좌번호|계약|계약금|송금|송금액|입금|입금액|금액|은행|예금주|오늘|금일|내일|만원|계약일|중도금|잔금|잔금일|보증금|이체|이체액|성립|확인|일부|예정|기타|원금|금일자|이번|입주|현금|매매|전세|월세|동시|문자|명의|매도자|매수자|입금처|납부|대금|선입금|금주|우선|우리|하나|신한|국민|농협|카카오|토스|기업)$/;
const dateRanges=t=>[
 ...t.matchAll(/20\d{2}\s*[./년-]\s*\d{1,2}\s*[./월-]\s*\d{1,2}\s*일?/g)
].map(m=>[m.index,m.index+m[0].length]);
const overlap=(a,b,range)=>range.some(([s,e])=>a<e&&b>s);
function accountCandidates(text){
 const results=[];
 const rx=/\d{2,8}(?:-\d{2,8}){1,4}|\d{10,16}/g; // A separated transfer amount cannot merge into the account
 const dates=dateRanges(text);
 let m;
 while((m=rx.exec(text))){
  const numbers=m[0].replace(/\D/g,'');
  if(numbers.length<10||numbers.length>16||overlap(m.index,rx.lastIndex,dates))continue;
  if(text[rx.lastIndex]==='호'||text[rx.lastIndex]==='동')continue;
  const left=text.slice(Math.max(0,m.index-20),m.index);
  const hasBank=Array.from(text.matchAll(new RegExp(bankNames.source,'gi')))
   .some(b=>Math.abs(b.index-m.index)<=65);
  const named=/계좌|은행|입금|송금|이체|예금주/.test(left);
  const strength=hasBank?3:named?2:1;
  if(strength<2)continue;
  results.push({value:m[0].replace(/\s/g,''),start:m.index,end:rx.lastIndex,strength});
 }
 return results.sort((a,b)=>b.strength-a.strength||a.start-b.start);
}
function bankCandidates(text,account){
 const found=[];
 for(const m of text.matchAll(new RegExp(bankNames.source,'gi'))){
  const value=m[0],tail=text.slice(m.index+m[0].length,m.index+m[0].length+6);
  const strong=/은행|뱅크|금고|우체국|수협|KB|IBK|NH|SC/.test(value);
  const nearby=account&&Math.min(Math.abs(m.index-account.start),Math.abs(m.index-account.end))<=70;
  const label=/계좌|은행|예금주|입금/.test(text.slice(Math.max(0,m.index-10),m.index));
  // Words like "우리", "하나", "기업" may be ordinary prose, not bank names.
  if(!strong&&!nearby&&!label)continue;
  if(!strong&&!nearby&&!/^\s*(?:은행|뱅크)/.test(tail))continue;
  found.push({value,start:m.index,end:m.index+value.length,strength:(strong?2:0)+(nearby?2:0)+(label?1:0)});
 }
 return found.sort((a,b)=>b.strength-a.strength||a.start-b.start);
}
function holderCandidate(text,account,bank){
 const explicit=/(?:예금주|계좌주|입금\s*받는\s*분|입금\s*받을\s*분|수취인|명의자)\s*[:：]?\s*([가-힣]{2,5})/g;
 let m,explicitList=[];
 while((m=explicit.exec(text)))if(!reserved.test(m[1]))explicitList.push({value:m[1],score:150,pos:m.index});
 if(explicitList.length===1)return {value:explicitList[0].value,confidence:'explicit'};
 if(explicitList.length>1)return {value:null,warning:'예금주가 여러 명 언급되어 확인이 필요합니다.'};
 if(!account)return {value:null};
 const all=[];
 const reg=/[가-힣]{2,5}/g;
 while((m=reg.exec(text))){
  if(reserved.test(m[0]))continue;
  const k=m[0];
  if(/^(?:송도|퍼스트|마스터|아파트|부동산|구청|만원|국민은행|신한은행|우리은행|하나은행|농협은행|기업은행|카카오|토스)/.test(k))continue;
  const dist=Math.min(Math.abs(m.index-account.start),Math.abs(m.index-account.end),
   bank?Math.abs(m.index-bank.start):Infinity);
  if(dist>24)continue;
  const prev=text.slice(Math.max(0,m.index-9),m.index);
  // Names explicitly marked as the buyer should never silently become the recipient.
  if(/(?:매수인|임차인|세입자)\s*[:：]?\s*$/.test(prev))continue;
  const score=100-dist*2+(/(?:예금주|계좌주|명의)/.test(prev)?30:0);
  all.push({value:k,score,pos:m.index});
 }
 all.sort((a,b)=>b.score-a.score);
 if(!all.length)return {value:null};
 if(all[1]&&all[0].score-all[1].score<18&&all[0].value!==all[1].value)
  return {value:null,warning:'계좌 주변에서 서로 다른 이름이 발견되었습니다. 예금주를 확인하세요.'};
 return {value:all[0].value,confidence:'adjacent'};
}
function moneyCandidates(text,account){
 const dates=dateRanges(text);
 const forbidden=[
  ...dates,
  ...Array.from(text.matchAll(/\d{1,4}\s*동\s*\d{1,4}\s*호/g),m=>[m.index,m.index+m[0].length]),
  ...Array.from(text.matchAll(/\d{1,2}\s*(?:월|일|년|블럭|블록)/g),m=>[m.index,m.index+m[0].length]),
 ];
 if(account)forbidden.push([account.start,account.end]);
 // Mask dates, dong/ho, and account before monetary tokenization.
 // This prevents the earlier tokenizer joining "123-456-789012 500" into one number.
 const masked=Array.from(text);
 for(const [start,end] of forbidden)for(let i=start;i<end;i++)masked[i]='§';
 const words=language._test.tokenizeMoney(masked.join(''));
 const unique=[];
 for(const tok of words){
  if(overlap(tok.start,tok.end,forbidden))continue;
  if(/[%％]/.test(text.slice(tok.end,tok.end+2)))continue;
  const after=text.slice(tok.end,tok.end+8);
  if(/^\s*(?:년|월|일|동|호|블럭|블록|층|%|％)/.test(after))continue;
  const prior=text.slice(Math.max(0,tok.start-36),tok.start);
  const recent=prior.split(/[,.;\n]/).pop()||prior;
  const next=text.slice(tok.end,tok.end+24);
  const exactTransfer=/송금액|입금액|이체액|보낼\s*금액|송금할\s*금액|이번\s*송금|오늘\s*보낼|오늘\s*입금|금일\s*송금|금일\s*입금|계약금\s*(?:의|중)\s*일부|일부\s*계약금/.test(recent);
  const beforeToday=/(?:오늘|금일|이번|우선|일단|먼저|당일)\s*(?:보낼|보내는|입금|송금|이체|납부)?\s*$/.test(recent);
  const nextTransfer=/^\s*(?:만|만원|원|정도)?\s*(?:먼저|송금|입금|이체|보내|넣|부칠|보낼|입금할|송금할|보내기로)/.test(next);
  const nearVerb=/(?:^|\s)(?:송금|입금|이체|보내|보낼)/.test(next.slice(0,18));
  const followedToday=/(?:오늘|금일|이번|당일)\s*(?:보내|입금|송금|이체|넣|납부)/.test(next.slice(0,20));
  const totalLabel=/(?:매매대금|매매금액|매매가|매매|전세보증금|전세금|전세|보증금|총\s*금액|중도금|계약금\s*(?!일부|중\s*일부|의\s*일부))\s*[:：]?\s*$/.test(recent);
  let score=10;
  if(exactTransfer)score+=115;
  else if(beforeToday)score+=90;
  if(nextTransfer||nearVerb||followedToday)score+=75;
  if(/일부\s*\(?\s*$/.test(recent))score+=90;
  if(totalLabel)score-=120;
  if(account&&Math.abs(tok.start-account.start)<90)score+=12;
  if([v('price'),v('contractDeposit'),v('interim')].includes(String(tok.amount)))score-=80;
  // Account-looking numbers and years are never payments.
  if(tok.amount>=100000000||tok.amount>Number(v('price')||10000000))score-=160;
  unique.push({...tok,score});
 }
 const best=unique.sort((a,b)=>b.score-a.score||a.start-b.start);
 return best;
}
function packet(text){
 const s=String(text||'').normalize('NFKC').replace(/\r/g,'');
 const accountList=accountCandidates(s);
 const account=accountList[0]||null;
 const banks=bankCandidates(s,account);
 const bank=banks[0]||null;
 const holder=holderCandidate(s,account,bank);
 const possible=moneyCandidates(s,account);
 const known=possible.filter(x=>x.score>=65);
 let amount=null,confidence='none',warning=holder.warning||'';
 if(known.length){
  if(known.length===1||known[0].score-known[1].score>=22||known[0].amount===known[1].amount){
   amount=known[0].amount;confidence='context';
  }else warning+=(warning?'\n':'')+'송금액으로 보이는 금액이 여러 개 있어 확인이 필요합니다.';
 }else if(account&&bank&&holder.value){
  // Four loose tokens, no explicit labels. Exclude transaction totals and intermediate payments.
  const remaining=possible.filter(x=>x.score>=14);
  if(remaining.length===1){amount=remaining[0].amount;confidence='inferred';}
 }
 return {account:account?.value||null,bank:bank?.value||null,holder:holder.value||null,amount,confidence,warning,
  candidates:possible.map(x=>({amount:x.amount,score:x.score}))};
}
function merge(result){
 const found=result?.found||[],review=result?.review||[],p=packet(v('rough'));
 const set=(id,value,label)=>{
  if(value==null||String(value)==='')return;
  const field=E(id);if(!field)return;
  if(!v(id)){field.value=String(value);found.push({id,value:String(value),source:'송금정보 순서무관 분석'});}
 };
 set('bank',p.bank,'은행');set('account',p.account,'계좌번호');
 if(p.account&&v('account')!==p.account){
  // An old positional parse may have accidentally joined 500 or another standalone amount to the account.
  E('account').value=p.account;
  found.push({id:'account',value:p.account,source:'계좌번호 독립 추출'});
  review.push('계좌번호가 다른 숫자와 붙어 인식되어 다시 분리했습니다. 실제 계좌를 확인하세요.');
 }
 const previousHolder=v('accountHolder');
 if(p.holder&&(previousHolder===''||previousHolder===p.holder)){
  set('accountHolder',p.holder,'예금주');
 }else if(p.holder&&previousHolder!==p.holder){
  if(/^(?:잔금일|금일|오늘|예금주|계좌|은행|계약금|매도인|매수인|입금|송금)$/.test(previousHolder)){
   E('accountHolder').value=p.holder;
   found.push({id:'accountHolder',value:p.holder,source:'예금주 독립 추출'});
   review.push('계좌 주변의 계약 용어를 예금주로 오인식하여 정정했습니다. 예금주를 확인하세요.');
  }else review.push('예금주 후보가 둘입니다. 계좌 명의자 '+previousHolder+' / '+p.holder+' 중 실제 값을 확인하세요.');
 }
 // High-confidence new context overrides only an existing *unverified parser guess* when different.
 if(p.amount!==null){
  const old=v('advance'),wanted=String(p.amount);
  if(!old){set('advance',wanted,'이번 송금액');}
  else if(old!==wanted&&p.confidence==='context'){
   E('advance').value=wanted;
   found.push({id:'advance',value:wanted,source:'명시된 송금 문맥'});
   review.push('송금액이 다른 금액과 혼동되어 '+wanted+'만원으로 다시 분석했습니다. 실제 송금액을 확인하세요.');
  }
 }
 if(p.warning)review.push(p.warning);
 const labels={bank:'은행',account:'계좌번호',accountHolder:'예금주',advance:'이번 송금액'};
 const status=E('recognized');
 if(status&&found.length)status.textContent='✓ 자동 인식: '+found.map(x=>labels[x.id]||x.id).join(' · ');
 const warn=E('languageWarnings');
 if(warn&&review.length){warn.textContent='확인할 내용\n• '+review.join('\n• ');warn.className='contractReview bad';}
 core.updateSummary();
 return {found,review};
}
const previous=language.parse;
language.parse=function(){const result=previous();return result?merge(result):result};
window.FirstHyundaiTransfer={packet,_test:{accountCandidates,bankCandidates,holderCandidate,moneyCandidates}};
})();
