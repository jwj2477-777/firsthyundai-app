
/* Local-only assistive contract drafting. No external AI, network or customer-data persistence. */
(function(){
'use strict';
const el=id=>document.getElementById('ct_'+id);
const value=id=>String(el(id)?.value||'').trim();
const amount=id=>window.FirstHyundaiContracts._test.contractValue(value(id));
const safe=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const edited=new Set();
let autoDeposit=null, acceptedComplex='', alerts=[], candidates=[];
let mute=false;
function key(v){
 return String(v||'').normalize('NFKC').toLowerCase().replace(/퍼스트팍|퍼팍|프팍/g,'퍼스트파크').replace(/마뷰|마스터뵤/g,'마스터뷰').replace(/더\s*샵/g,'더샵').replace(/블럭|블록|bl\b|block/g,'bl')
 .replace(/송도|인천|광역시|연수구|아파트|주상복합|더샵/g,'')
 .replace(/[^가-힣a-z0-9]/g,'');
}
function tokenizeComplex(x){
 return [...new Set([x.label,...(Array.isArray(x.aliases)?x.aliases:[])].map(key).filter(v=>v.length>=3))];
}
function catalog(){
 try{
  if(typeof catalogRows==='function'){
   return catalogRows().filter(x=>x?.id&&x?.label&&typeof x.address==='string');
  }
 }catch(e){}
 return [];
}
function distance(a,b,cap=3){
 if(Math.abs(a.length-b.length)>cap)return cap+1;
 const prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const cur=[i];let min=i;
  for(let j=1;j<=b.length;j++){
   cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   min=Math.min(min,cur[j]);
  }
  if(min>cap)return cap+1;
  prev.splice(0,prev.length,...cur);
 }
 return prev[b.length];
}
function grade(query,alias){
 if(!query||query.length<3||!alias)return 0;
 if(query===alias)return 100;
 if(alias.startsWith(query))return query.length>=5?86:68;
 if(query.startsWith(alias))return alias.length>=5?82:0;
 if(query.length>=5&&alias.includes(query))return 78;
 if(alias.length>=5&&query.includes(alias))return 75;
 if(query.length>=5){
  const digits=(v=>v.match(/\d+/g)||[])(query);
  const otherDigits=(alias.match(/\d+/g)||[]);
  // Never edit away a block number: 13BL, 14BL and 15BL are different addresses.
  if(digits.length&&otherDigits.length&&digits.join(',')!==otherDigits.join(','))return 0;
  const diff=distance(query,alias,2);
  if(diff===1)return 80;
  if(diff===2&&Math.min(query.length,alias.length)>=7)return 67;
 }
 return 0;
}
function choices(query){
 const q=key(query);
 if(!q)return [];
 return catalog().map(x=>({row:x,score:Math.max(0,...tokenizeComplex(x).map(k=>grade(q,k)))}))
  .filter(x=>x.score>=55)
  .sort((a,b)=>b.score-a.score||a.row.label.localeCompare(b.row.label,'ko'))
  .slice(0,8);
}
function cleanPropertyText(raw){
 let s=String(raw||'').trim().replace(/^소재지\s*[:：]?\s*/,'').replace(/\d{1,4}\s*동\s*\d{1,4}\s*호.*$/,'').replace(/\s+(?:전세|월세|매매|보증금|동호수|계약금|잔금|입주).*$/,'');
 return s.slice(0,100);
}
function notify(text,warn=false){
 const box=el('autoStatus');if(!box)return;
 box.textContent=text;box.className='contractReview'+(warn?' bad':'');
}
function set(id,text,override=false,automatic=false){
 const e=el(id);
 if(!e || edited.has(id)&&!override || (!override&&value(id)))return false;
 e.value=String(text||'');
 if(automatic)edited.delete(id);
 return true;
}
function detect(query){
 const matches=choices(query);
 candidates=matches;
 const list=el('suggestions');
 if(list){
  list.innerHTML=matches.length?
    '<strong class="tiny">아파트 후보 — 주소를 확인해 선택하세요</strong>'+
    matches.slice(0,5).map(x=>'<button class="contractChoice" type="button" onclick="FirstHyundaiSmart.select(\''+
     String(x.row.id).replace(/[^a-zA-Z0-9_-]/g,'')+'\')">'+safe(x.row.label)+'<small>'+safe(x.row.address)+'</small></button>').join(''):
    '';
 }
 if(!matches.length)return null;
 const a=matches[0],b=matches[1];
 // Exact unique match or a long distinctive typo with no other plausible candidate.
 if((a.score===100&&(!b||b.score<100))||
    (a.score>=78&&key(query).length>=5&&(!b||a.score-b.score>=15)))return a.row;
 return null;
}
function choose(id){
 const row=catalog().find(x=>x.id===id);
 if(!row||!row.address)return false;
 mute=true;
 el('property').value=row.label;
 el('address').value=row.address;
 acceptedComplex=row.id;
 edited.delete('property');edited.delete('address');
 mute=false;
 const list=el('suggestions');if(list)list.innerHTML='';
 notify('✓ '+row.label+' · 기존 송도 단지정보 주소를 가져왔습니다. 동·호수와 도로명주소가 실제 대상물과 맞는지 확인해 주세요.');
 window.FirstHyundaiContracts.updateSummary();
 return true;
}
function resolveProperty(query,prefer=false){
 if(!query)return;
 const match=detect(query);
 if(match&&match.address){
  if(acceptedComplex!==match.id || !value('address'))choose(match.id);
 }else{
  acceptedComplex='';
  if(!edited.has('address'))el('address').value='';
  if(candidates.length)notify('비슷한 단지가 여러 개 있습니다. 주소를 보고 정확한 단지를 선택해 주세요.',true);
  else if(prefer)notify('단지를 찾지 못했습니다. 단지명을 확인하거나 소재지 주소를 직접 입력해 주세요.',true);
 }
}
function setDeposit(force=false){
 const price=amount('price'),checkbox=el('autoDeposit');
 if(!checkbox?.checked ||price===null||price<=0){
  if(autoDeposit!==null&&!edited.has('contractDeposit'))el('contractDeposit').value='';
  autoDeposit=null;
  return;
 }
 if(!force&&edited.has('contractDeposit')){autoDeposit=null;return;}
 const amount10=Math.round(price*10)/100;
 if(!Number.isFinite(amount10)||amount10<=0)return;
 const current=value('contractDeposit');
 if(!current ||autoDeposit!==null||force){
  el('contractDeposit').value=String(amount10);
  autoDeposit=amount10;
 }
}
function showAutomatic(){
 const label=el('depositHelp');
 if(label)label.textContent=autoDeposit!==null?
  '계약금이 미입력되어 거래금액의 10% ('+autoDeposit.toLocaleString('ko-KR')+'만원)를 임시 계산했습니다. 당사자 합의 금액인지 반드시 확인하세요.':
  '계약금이 비어 있으면 총액의 10%를 제안합니다. 실제 합의 금액을 입력하면 그 금액이 우선합니다.';
 const rentRow=el('monthlyRent')?.closest?.('.contractMonthlyRow');
 if(rentRow)rentRow.classList.toggle('hidden',value('dealType')!=='월세');
}
function changed(event){
 if(mute)return;
 const target=event?.target;
 const name=String(target?.id||'').replace(/^ct_/,'');
 if(name==='contractDeposit'){
  edited.add(name);autoDeposit=null; // Manual value always beats 10% default.
 }
 if(name==='price'){
  edited.add(name);
  setDeposit();
 }
 if(name==='autoDeposit'){
  if(!target.checked&&autoDeposit!==null){
   el('contractDeposit').value='';autoDeposit=null;
  }else setDeposit();
 }
 if(name==='property'){
  edited.add(name);
  acceptedComplex='';
  if(!edited.has('address'))el('address').value='';
  resolveProperty(value('property'));
 }
 if(name==='address'){
  edited.add(name);
  acceptedComplex=''; // User may be transacting in an unlisted address.
 }
 showAutomatic();
}
function onOpen(){
 setDeposit();
 if(value('property'))resolveProperty(value('property'));
 showAutomatic();
}
function reset(){
 edited.clear();autoDeposit=null;acceptedComplex='';alerts=[];candidates=[];
 if(el('autoDeposit'))el('autoDeposit').checked=true;
 if(el('suggestions'))el('suggestions').innerHTML='';
 if(el('autoStatus')){el('autoStatus').textContent='단지명을 입력하면 주소를 찾아줍니다.';el('autoStatus').className='contractReview';}
 setDeposit();showAutomatic();
}
function needsPropertyConfirmation(){
 const p=value('property'); if(!p)return false;
 const list=choices(p);
 // If the user typed only a family with multiple block addresses, exact block selection is mandatory.
 if(!acceptedComplex&&list.length>1&&list[0].score===list[1].score&&
  list[0].score>=68&&!value('address'))return true;
 return false;
}
function between(v){return String(v||'').replace(/^[\s:：,-]+/,'').replace(/[\s,.;。]+$/,'').trim();}
const AMOUNT='(\\d[\\d\\s,.억천백만]*\\s*(?:원|만원)?)(?![\\d])';
function tryMoney(text){
 const candidate=between(text).replace(/^(?:약|대략|한|금|총액|일부|이번에|우선|일단|먼저)\s*/,'');
 const m=candidate.match(/^\d[\d\s,.억천백만]*(?:원|만원)?/);
 if(!m)return null;
 const convert=window.FirstHyundaiContracts._test.contractValue;
 return convert(m[0]);
}
function monetarySegment(sentence,pattern){
 const reg=new RegExp(pattern+'\\s*(?:은|는|가|을|를|으로|에|:|：|금액은|금액이)?\\s*'+AMOUNT,'i');
 const m=String(sentence).match(reg);
 return m?tryMoney(m[1]):null;
}
function findAmount(text,patterns){
 for(const p of patterns){const v=monetarySegment(text,p);if(v!==null&&v>0)return v;}
 return null;
}
function extractDate(text){
 const s=String(text||'');
 const convert=window.FirstHyundaiContracts._test.normalizeDate;
 const withYear=s.match(/20\d{2}\s*[년./-]\s*\d{1,2}\s*[월./-]\s*\d{1,2}\s*일?/);
 if(withYear){const d=convert(withYear[0]);if(d)return {date:d,assumed:false};}
 const match=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 if(!match)return null;
 const today=new Date(),month=Number(match[1]),day=Number(match[2]);
 let year=today.getFullYear();
 let d=new Date(year,month-1,day);
 if(d.getMonth()!==month-1||d.getDate()!==day)return null;
 const localToday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 if(d<localToday)year++;
 d=new Date(year,month-1,day);
 return {date:year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),assumed:true};
}
function labeledParts(raw){
 // Split at recognized boundaries, not on ordinary Korean spaces inside numbers.
 const tags=[
  ['contractDeposit',/(?:총\s*계약금|약정\s*계약금|계약금(?:은|은요|은)?)(?!\s*일부)/g],
  ['advance',/(?:이번\s*송금액|이번\s*입금|일부\s*계약금|선\s*송금액|선입금|가계약금|먼저\s*보낼\s*금액|입금예정액|우선\s*송금)/g],
  ['interim',/(?:중도금)/g],
  ['monthlyRent',/(?:월차임|월세액|월세금|월세)/g],
  ['price',/(?:전세\s*보증금|전세금|전세가|매매\s*대금|매매가|매매금액|집값|총\s*금액|보증금)/g],
  ['balanceDate',/(?:잔금일(?:시)?|잔금\s*지급일|잔금은)/g],
  ['contractDate',/(?:계약서\s*작성일|본계약\s*작성일|본계약일)/g],
  ['leaseStart',/(?:입주일|임대차\s*개시일)/g],
  ['leaseEnd',/(?:임대차\s*종료일|만기일)/g],
  ['leaseDuration',/(?:임대차\s*기간|계약기간)/g],
  ['unit',/(?:동호수|동\s*호수|대상물|호수)/g],
  ['property',/(?:소재지|아파트|단지명)/g],
  ['bank',/(?:은행)/g],
  ['account',/(?:계좌번호|입금계좌)/g],
  ['accountHolder',/(?:예금주)/g]
 ];
 const matches=[];
 for(const [id,re] of tags){
  re.lastIndex=0;let m;
  while((m=re.exec(raw))!==null)matches.push({id,start:m.index,end:re.lastIndex});
 }
 matches.sort((a,b)=>a.start-b.start||b.end-a.end);
 const out={};
 matches.forEach((m,i)=>{
  if(i&&m.start<matches[i-1].end)return;
  const next=matches.slice(i+1).find(x=>x.start>=m.end);
  const content=between(raw.slice(m.end,next?next.start:raw.length));
  if(content&&!out[m.id])out[m.id]=content;
 });
 return out;
}
function extractNotes(){
 const raw=value('rough');
 if(!raw){alert('먼저 현장 메모나 음성입력 내용을 적어 주세요.');return;}
 alerts=[];let recognized=0;const memo=raw.replace(/\r/g,'').replace(/[，]/g,',');
 const lines=memo.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const label=labeledParts(memo);
 const setCount=(id,val)=>{if(val!==null&&val!==undefined&&val!==''&&set(id,val)){recognized++;return true;}return false;};
 // Terms remain literal: never invent or auto-correct obligations.
 let startTerms=-1;
 for(let i=0;i<lines.length;i++)if(/^\s*(?:특약(?:사항)?|합의사항)\s*[:：]?\s*$/.test(lines[i])){startTerms=i;break;}
 if(startTerms>=0&&!value('terms')){
  const terms=lines.slice(startTerms+1).map(x=>x.replace(/^\s*(?:\d+[.)]|[①②③④⑤])\s*/,'')).filter(Boolean);
  if(terms.length)setCount('terms',terms.join('\n'));
 }
 // Detect transaction type but preserve manual type selection when it has already changed.
 if(/\b월세\b|월차임|월세금/.test(memo)){set('dealType','월세',true);recognized++;}
 else if(/매매|매도인|매수인/.test(memo)){set('dealType','매매',true);recognized++;}
 else if(/전세|임대차/.test(memo)){set('dealType','전세',true);recognized++;}
 const property=label.property?.split(/[\n,]/)[0]||'';
 if(property&&!value('property'))setCount('property',cleanPropertyText(property));
 if(!value('property')){
  // Match an apartment phrase anywhere in casual speech. Require a distinct block or unique estate.
  const phrase=memo.split(/(?:보증금|전세가|전세금|매매가|매매대금|계약금|잔금일|월세|특약|계좌)/)[0];
  const q=phrase.replace(/\d{1,4}\s*동\s*\d{1,4}\s*호.*$/,'').replace(/(?:에\s*있는|아파트|좀|말이야|말야|해줘|써줘|전세|매매|계약).*$/,'').replace(/^(?:저기|그거|그러니까|여기|저|어|그)\s*/,'').trim();
  if(q){const direct=choices(q);if(direct[0]?.score>=78) setCount('property',direct[0].row.label);}
 }
 const unit=label.unit?.match(/(?:\d{1,4}\s*동\s*)?\d{1,4}\s*호/);
 const incidental=memo.match(/(\d{1,4})\s*동\s*(\d{1,4})\s*호/);
 if(unit)setCount('unit',unit[0].replace(/\s+/g,''));
 else if(incidental)setCount('unit',incidental[1]+'동 '+incidental[2]+'호');
 const amountPatterns=[
  ['price',['전세\\s*보증금','전세금','전세가','매매\\s*대금','매매가','매매금액','집값','보증금','(?:전세|매매)\\s*(?!계약)(?=\\d)']],
  ['contractDeposit',['총\\s*계약금','약정\\s*계약금','계약금(?!\\s*일부)']],
  ['advance',['이번\\s*송금액','이번\\s*입금액','일부\\s*계약금','선입금','먼저\\s*보낼','우선\\s*보낼','가계약금','선송금','(?:먼저|우선|일단)']],
  ['interim',['중도금']],
  ['monthlyRent',['월차임','월세액','월세\\s*금액','월세']]
 ];
 for(const [id,patterns] of amountPatterns){
  const n=findAmount(memo,patterns);
  if(n!==null) setCount(id,String(n));
  else if(label[id]){
   const num=tryMoney(label[id]);
   if(num!==null&&num>0)setCount(id,String(num));
  }
 }
 // Korean conversational order: "500만원 먼저 보내", "500 먼저 입금해".
 if(!value('advance')){
  const m=memo.match(/(\d[\d,.억천백만\s]*\s*(?:원|만원)?)\s*(?:만|정도|우선|일단)?\s*(?:먼저|선입금|보내|송금|입금)/);
  const n=m?tryMoney(m[1]):null;if(n!==null)setCount('advance',String(n));
 }
 if(!value('leaseDuration')){
  const d=memo.match(/(?:계약기간|임대차기간|기간은?)\s*(\d+\s*년(?:\s*\d+\s*개월)?)/);
  if(d)setCount('leaseDuration',d[1].replace(/\s+/g,''));
 }
 for(const [id,text,pattern] of [
  ['balanceDate',label.balanceDate||memo,/(?:잔금일(?:시)?|잔금\s*지급일|잔금은)\s*[:：]?\s*([^\n,.;]*)/],
  ['leaseStart',label.leaseStart||memo,/(?:입주일|임대차\s*개시일)\s*[:：]?\s*([^\n,.;]*)/],
  ['leaseEnd',label.leaseEnd||memo,/(?:만기일|임대차\s*종료일)\s*[:：]?\s*([^\n,.;]*)/]
 ]){
  const extracted=pattern.exec(text);const date=extractDate(extracted?extracted[1]:label[id]||'');
  if(date){setCount(id,date.date);if(date.assumed)alerts.push(id+'의 연도는 휴대폰 날짜로 추정했습니다. 확인하세요.');}
 }
 if(label.contractDate&&!value('contractDate'))setCount('contractDate',label.contractDate.split(/[\n,]/)[0].trim());
 for(const id of ['bank','account','accountHolder']){
  if(label[id]){
   const fragment=label[id].split(/[\n,;。]/)[0].trim();
   const rawValue=id==='account'?(fragment.match(/[\d-]{9,25}/)?.[0]||''):fragment;
   if(rawValue)setCount(id,rawValue);
  }
 }
 // Unspecified contract deposit is automatically derived. No assumed advance or account details.
 setDeposit();
 if(value('property'))resolveProperty(value('property'),true);
 showAutomatic();
 window.FirstHyundaiContracts.updateSummary();
 const labelText=recognized+'개 입력 항목을 인식했습니다. '+(autoDeposit!==null?'계약금 10%를 임시로 제안했습니다. ':'')+
  (alerts.length?alerts.join(' '):'')+' 문자 생성 전에 주소·금액·날짜·송금계좌를 확인해 주세요.';
 notify(labelText,!!alerts.length);
}
function previewNote(){
 return autoDeposit!==null?'⚠ 계약금 10%는 편의상 제안한 금액입니다. 당사자 합의 금액을 확인해 주세요.':'';
}
function appendContractAmountHint(original){
 const draft=String(original||'');
 if(autoDeposit===null)return draft;
 return draft.replace(/(▶ 약정 계약금 : [^\n]*)/, '$1 (총액의 10% 임시산정)');
}
const baseMake=window.FirstHyundaiContracts.makePreview;
window.FirstHyundaiContracts.makePreview=function(){
 setDeposit();
 baseMake();
 const preview=el('preview');
 if(preview)preview.value=appendContractAmountHint(preview.value);
};
const baseReset=window.FirstHyundaiContracts.reset;
window.FirstHyundaiContracts.reset=function(){
 baseReset();reset();
};
const previousSpeech=window.firstHyundaiContractSpeech;
window.firstHyundaiContractSpeech=function(result){
 previousSpeech(result);
 if(result&&result.ok&&result.text&&value('rough'))extractNotes();
};
window.FirstHyundaiSmart={changed,onOpen,extractNotes,select:choose,reset,needsPropertyConfirmation,previewNote,_test:{key,distance,choices,findAmount,extractDate}};
window.FirstHyundaiContracts.extractNotes=extractNotes;
})();
