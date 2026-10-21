/* One-memo contract workflow and conservative, reversible clause copyediting.
   Contract text is kept on device; no online AI endpoint, key or external data transfer. */
(function(){
'use strict';
const E=id=>document.getElementById('ct_'+id);
const v=id=>String(E(id)?.value||'').trim();
const app=window.FirstHyundaiContracts;
const language=window.FirstHyundaiLanguage;
let sourceClause='',polishedClause='';
const ESCAPE=/[<>&]/g;
function ending(line){
 let s=String(line||'').trim().replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/,'')
  .replace(/^\d+[.)]\s*/,'').replace(/\s+/g,' ')
  .replace(/[，]/g,',').replace(/[。]+$/,'').replace(/[.!?\s]+$/,'');
 if(!s)return '';
 // Standardization only; do not introduce parties, amounts, deadlines or remedies.
 s=s.replace(/애완동물/g,'반려동물').replace(/입주청소/g,'입주 청소')
  .replace(/근저당(?!권)/g,'근저당권')
  .replace(/상호합의하에/g,'상호 합의하에').replace(/앞당길수/g,'앞당길 수')
  .replace(/해주기로\s*(?:함|했음|했어|했어요)?$/,'해주기로 한다')
  .replace(/해주는\s*걸로\s*(?:함|했음|했어|했어요)?$/,'해주기로 한다')
  .replace(/주기로\s*(?:함|했음|했어|했어요)?$/,'주기로 한다')
  .replace(/하기로\s*(?:함|했음|했어|했어요)?$/,'하기로 한다')
  .replace(/한다는\s*걸로$/,'하기로 한다')
  .replace(/하는\s*걸로$/,'하기로 한다')
  .replace(/하기로\s*했(?:다|어요|어)?$/,'하기로 한다')
  .replace(/해주기$/,'해주기로 한다')
  .replace(/반려동물\s*안\s*(?:됨|돼(?:요)?)$/,'반려동물은 허용하지 않는다')
  .replace(/(?<![가-힣])안\s*됨$/,'허용하지 않는다')
  .replace(/안\s*돼(?:요)?$/,'허용하지 않는다')
  .replace(/\s*([,;])\s*/g,'$1 ');
 s=s.replace(/\.?\s*$/,'');
 return s+'.';
}
// Office shorthand often omits the word "특약". Recover independently written
// undertakings rather than discarding them. Never turn payment facts into clauses.
function inferImplicitSpecials(text){
 const source=String(text||'').replace(/\r/g,'');
 const lines=source.split('\n').map(x=>x.trim()).filter(Boolean);
 const result=[];
 for(const line of lines){
  if(/^(?:※|▶|→)?\s*(?:주소|소재지|아파트|단지|동호|매매|전세|월세|보증금|계약금|중도금|잔금일\s*[:：]?\s*\d|입금|송금|계좌|은행|예금주)\b/.test(line))continue;
  const repairs=/(?:수리|수선|보수|교체|도배|청소|설치|철거|말소|원상복구).{0,45}(?:해\s*주기로|해주기로|하기로|기로\s*함|해\s*주기로\s*함)/.test(line);
  const agreedDate=/(?:잔금일|중도금일|입주일|계약일).{0,70}(?:상호\s*합의|상호합의|합의\s*하에|협의).{0,70}(?:앞당길|조정|변경)|(?:상호\s*합의|협의).{0,55}(?:잔금일|입주일).{0,55}(?:앞당길|변경)/.test(line);
  if((repairs||agreedDate)&&!result.includes(line))result.push(line.replace(/^[→➜➡•-]\s*/,''));
 }
 return result.join('\n').slice(0,6000);
}
function extractSpecial(raw){
 const text=String(raw||'').replace(/\r/g,'');
 // An explicit "특약/합의사항/추가 조건" label is required to avoid turning narration into obligations.
 const tag=/(?:^|[\n.;]\s*|\s)(?:특약(?:사항)?|합의사항|추가\s*조건|별도\s*합의)(?:은|는|으로는|은요)?\s*(?:[:：-]\s*|\s+)/m;
 const m=tag.exec(text);
 if(!m)return inferImplicitSpecials(text);
 let tail=text.slice(m.index+m[0].length);
 // The pre-agreed payment/cancellation paragraph is a separate section, not a special clause.
 tail=tail.split(/\n(?=\s*(?:※|▶\s*(?:계약금|중도금|잔금|계좌|예금주)|계좌번호|입금계좌|송금계좌|예금주|은행|잔금일|전세보증금|매매대금|계약일)\s*[:：]?\s*)/)[0];
 tail=tail.split(/※\s*(?:금일|오늘|상기|본|위)\s*(?:계약금|내용|조건)/)[0];
 tail=tail.replace(/^\s*(?:은|는)\s*/,'').trim();
 const lines=tail.split(/\n+|(?=→)|(?:\s|^)(?=\d+[.)]\s+)|;\s*|[，,]\s*(?=(?:임대인|임차인|매도인|매수인|잔금|도배|청소|에어컨|반려동물|근저당|현상태|현재|붙박이|하자|특약|계약))/)
  .map(s=>s.trim().replace(/^[→➜➡•-]\s*/,'')) .filter(Boolean);
 return lines.join('\n').slice(0,6000);
}
function polishTerms(text){
 const src=String(text||'').replace(/\r/g,'').trim();
 if(!src)return '';
 return src.split(/\n+/).flatMap(part=>part.split(/\s+(?=\d+[.)]\s+)/)).map(ending).filter(Boolean).join('\n');
}
function presentSpecials(){
 const diff=E('termDiff');
 if(!diff)return;
 const has=!!sourceClause;
 if(diff.classList?.toggle)diff.classList.toggle('hidden',!has);
 if(E('termOriginal'))E('termOriginal').textContent=sourceClause||'';
 if(E('termPolished'))E('termPolished').textContent=polishedClause||'';
 if(E('termNotice'))E('termNotice').textContent=has?
  '특약 문장만 다듬었습니다. 권리·의무·기한·부담 주체는 원문과 꼭 대조하세요.':'';
}
function addReviewNote(msg){
 const w=E('languageWarnings');
 if(!w)return;
 const old=String(w.textContent||'');
 if(!old.includes(msg)){
  w.textContent=(old&&old!=='자동으로 입력한 정보도 발송 전에 한 번 더 확인해 주세요.'?old+'\n':'')+'• '+msg;
  w.className='contractReview bad';
 }
}
function prepareSpecials(raw){
 const extracted=extractSpecial(raw);
 // A numbered section after a "특약:" header may already be identified by the language engine.
 const terms=extracted||v('terms');
 sourceClause=terms; polishedClause=polishTerms(terms);
 if(terms){
  const result=E('terms');if(result)result.value=E('polishTerms')?.checked===false?terms:polishedClause;
  if(polishedClause!==terms)addReviewNote('특약 표현을 정리했습니다. 원문과 비교해 의무·기한·주체 변경이 없는지 확인하세요.');
 }
 presentSpecials();
}
function refreshReport(result){
 const errors=app._test.collect().errors;
 const total=(result?.found||[]).length;
 if(E('oneTapSummary'))E('oneTapSummary').textContent='메모에서 '+total+'개 항목 인식 · '+
  (errors.length?errors.length+'개 필수 정보 확인 필요':'필수 정보 입력 완료')+
  (sourceClause?' · 특약 '+sourceClause.split('\n').filter(Boolean).length+'건':'');
 const missing=E('missing');
 if(missing){missing.textContent=errors.length?'추가 확인이 필요한 내용: '+errors.join(' · '):
 '입력된 조건을 확인하고 ‘내용 확인 완료’를 눌러주세요.';missing.className='contractReview'+(errors.length?' bad':'');}
 const details=E('reviewDetails');
 if(details && errors.length)details.open=true;
 if(E('fixMissing')?.classList?.toggle)E('fixMissing').classList.toggle('hidden',!errors.length);
}
function showPreview(){
 const panel=E('resultPanel'); if(panel?.classList?.remove)panel.classList.remove('hidden');
 if(panel?.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function compose(){
 const raw=v('rough');
 if(!raw){alert('먼저 메모를 입력하거나 음성으로 말씀해 주세요.');E('rough')?.focus?.();return false;}
 // Each new composition starts with empty deal data, avoiding old customer's account or terms leaking into new draft.
 app._test.clearForNewMemo();
 sourceClause='';polishedClause='';
 const result=language.parse()||{found:[],review:[]};
 prepareSpecials(raw);
 app.makePreview();
 refreshReport(result);
 showPreview();
 return true;
}
function afterManualEdit(){
 app.makePreview();showPreview();
 const missing=E('missing');
 if(missing){const errors=app._test.collect().errors;missing.textContent=errors.length?'확인할 사항: '+errors.join(' · '):'입력된 계약조건을 확인하세요.';missing.className='contractReview'+(errors.length?' bad':'');}
}
function openManual(){
 const d=E('manualPanel');if(d){d.open=true;if(d.scrollIntoView)d.scrollIntoView({behavior:'smooth',block:'start'});}
 const first=app._test.collect().errors[0],lookup={'소재지 도로명주소':'address','아파트 단지 선택 확인':'property','동·호수':'unit','이번 송금액':'advance','잔금 예정일':'balanceDate','송금 은행·계좌·예금주':'bank','임대차 기간':'leaseDuration'};
 const id=Object.keys(lookup).find(k=>first?.includes(k));
 if(id)E(lookup[id])?.focus?.();
}
function reset(){
 sourceClause='';polishedClause='';
 if(E('oneTapSummary'))E('oneTapSummary').textContent='메모 한 번으로 계약문자를 만들어 보세요.';
 if(E('termOriginal'))E('termOriginal').textContent='';
 if(E('termPolished'))E('termPolished').textContent='';
 if(E('resultPanel')?.classList?.add)E('resultPanel').classList.add('hidden');
 if(E('manualPanel'))E('manualPanel').open=false;
 if(E('reviewDetails'))E('reviewDetails').open=false;
 if(E('termDiff')?.classList?.add)E('termDiff').classList.add('hidden');
}
function useOriginalTerms(){
 if(!sourceClause)return;
 E('terms').value=sourceClause;
 app.updateSummary();
 addReviewNote('특약을 원문으로 되돌렸습니다.');
}
function usePolishedTerms(){
 if(!sourceClause)return;
 E('terms').value=polishedClause;
 app.updateSummary();
 addReviewNote('특약 문구를 다시 적용했습니다. 원문과 대조해 주세요.');
}
const oldReset=app.reset;
app.reset=function(){
 const before=v('rough')||v('preview')||v('property');
 oldReset();
 if(before&&!v('rough')&&!v('property'))reset();
};
const oldSpeech=window.firstHyundaiContractSpeech;
window.firstHyundaiContractSpeech=function(result){
 if(result?.ok&&typeof result.text==='string'){
  E('rough').value+=(v('rough')?'\n':'')+result.text.slice(0,3000);
  compose();
 }else oldSpeech(result);
};
window.FirstHyundaiEasy={compose,afterManualEdit,openManual,useOriginalTerms,usePolishedTerms,reset,
 _test:{extractSpecial,polishTerms,ending}};
})();
