/* Contract assistant: no persistence, no auto-send, server output is untrusted. */
'use strict';
const contractFields=[['kind','거래 종류'],['address','소재지'],['apartment','아파트명'],['unit','동·호수'],['total','매매대금 / 보증금 (원)'],['deposit','전체 약정 계약금 (원)'],['partial','이번에 보낼 계약금 일부 (원)'],['partialDate','일부 지급 예정일'],['depositDate','계약금 잔액 지급일'],['middle','중도금 (원, 없으면 0)'],['middleDate','중도금 지급일'],['monthly','월세 (원, 월세 거래만)'],['rentDay','월세 지급일 · 선불/후불'],['term','계약기간'],['signDate','계약서 작성일 / 협의 범위'],['balanceDate','잔금일'],['special','합의한 특약사항']];
let contractGeneration=0,contractBusy=false,contractSnapshot='',contractRequestInput='';
function ce(id){return document.getElementById(id)}
function contractMessage(msg){ce('contractStatus').textContent=msg;}
function contractInit(){
 const box=ce('contractFields');
 for(const [key,label] of contractFields){const l=document.createElement('label');l.textContent=label;
 let input=document.createElement(key==='special'?'textarea':key==='kind'?'select':'input');input.id='ct_'+key;
 if(key==='kind'){for(const val of ['','매매','전세','월세']){const o=document.createElement('option');o.value=val;o.textContent=val||'선택해 주세요';input.appendChild(o);}}
 if(['total','deposit','partial','middle','monthly'].includes(key)){input.inputMode='numeric';input.placeholder='예: 390,000,000';}
 if(key.toLowerCase().endsWith('date'))input.placeholder='예: 2026년 12월 28일';
 input.addEventListener('input',contractInvalidate);l.appendChild(input);box.appendChild(l);}
 ce('contract').addEventListener('input',e=>{if(e.target.id!=='contractConfirmed')contractInvalidate();});
 ce('contractConfirmed').addEventListener('change',()=>{ce('contractCopyButton').disabled=!ce('contractConfirmed').checked||!contractSnapshot;});
}
function contractInvalidate(){contractSnapshot='';ce('contractOutput').textContent='';ce('contractConfirmed').checked=false;ce('contractCopyButton').disabled=true;}
function contractRead(){const d={};for(const [key] of contractFields)d[key]=ce('ct_'+key).value.trim();for(const key of ['bank','account','holder','owner','tenant','agreement','brokerage'])d[key]=ce('ct_'+key).value.trim();return d;}
function contractMoney(s,optional=false){if(optional&&s==='')return 0;const raw=String(s).replace(/,/g,'');if(!/^\d+$/.test(raw))return null;const n=Number(raw);return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000?n:null;}
function contractValidate(d){
 const errors=[];const required=['kind','address','apartment','unit','total','deposit','partial','partialDate','signDate','balanceDate','bank','account','holder'];
 if(d.kind!=='매매')required.push('term');if(d.kind==='월세')required.push('monthly','rentDay');
 for(const k of required)if(!d[k])errors.push((contractFields.find(f=>f[0]===k)?.[1]||({bank:'은행',account:'계좌번호',holder:'예금주'})[k])+'을 확인해 주세요.');
 if(!['매매','전세','월세'].includes(d.kind))errors.push('거래 종류를 선택해 주세요.');
 const n={};for(const k of ['total','deposit','partial','middle','monthly']){n[k]=contractMoney(d[k],k==='monthly'&&d.kind!=='월세');if(n[k]===null)errors.push((contractFields.find(f=>f[0]===k)[1])+'을 원 단위 숫자로 입력해 주세요.');}
 if(n.total!==null&&n.deposit!==null&&n.partial!==null&&n.middle!==null){if(n.total<=0||n.deposit<=0||n.partial<=0)errors.push('대금·계약금·이번 지급액은 0원보다 커야 합니다.');if(n.partial>n.deposit)errors.push('이번 지급액이 전체 계약금보다 큽니다.');if(n.deposit+n.middle>n.total)errors.push('계약금과 중도금 합계가 전체 금액보다 큽니다.');}
 if(n.deposit>n.partial&&!contractDate(d.depositDate))errors.push('계약금 잔액 지급일을 연·월·일로 입력해 주세요.');
 if(n.middle>0&&!d.middleDate)errors.push('중도금 지급일을 입력해 주세요.');
 if(d.kind==='월세'&&n.monthly<=0)errors.push('월세 금액을 확인해 주세요.');
 for(const k of ['partialDate','balanceDate',...(n.middle>0?['middleDate']:[])]){if(d[k]&&!contractDate(d[k]))errors.push((contractFields.find(f=>f[0]===k)[1])+'은 연·월·일이 있는 실제 날짜로 입력해 주세요.');}
 if(d.signDate&&!/20\d{2}/.test(d.signDate))errors.push('계약서 작성일에 연도와 합의한 일정을 적어 주세요.');
 const dd=contractDate(d.depositDate);if(n.deposit>n.partial&&dd&&((contractDate(d.partialDate)&&dd<contractDate(d.partialDate))||(contractDate(d.balanceDate)&&dd>contractDate(d.balanceDate))))errors.push('계약금 잔액 지급일의 순서를 확인해 주세요.');
 const p=contractDate(d.partialDate),b=contractDate(d.balanceDate),m=contractDate(d.middleDate);if(p&&b&&p>b)errors.push('일부 지급일이 잔금일보다 늦습니다.');if(n.middle>0&&m&&((p&&m<p)||(b&&m>b)))errors.push('중도금 지급일의 순서를 확인해 주세요.');
 if(d.account&&!/^[\d -]{6,40}$/.test(d.account))errors.push('계좌번호는 숫자·공백·하이픈만 입력해 주세요.');
 return {errors:[...new Set(errors)],n};
}
function contractDate(s){const m=/^(20\d{2})\s*[년.\/-]\s*(\d{1,2})\s*[월.\/-]\s*(\d{1,2})\s*일?\.?$/.exec(s||'');if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]?d.getTime():null;}
function contractBuild(d,n){
 const won=x=>x.toLocaleString('ko-KR')+'원';const seller=d.kind==='매매'?'매도인':'임대인',buyer=d.kind==='매매'?'매수인':'임차인';
 const a=['안녕하세요. 퍼스트현대부동산입니다.','',`● 아파트 ${d.kind}계약 주요조건 및 계약금 일부 지급 안내 ●`,'',`▶ 소재지 : ${d.address}`,`▶ 아파트명 : ${d.apartment} ${d.unit}`];
 if(d.owner)a.push(`▶ ${seller} : ${d.owner}`);if(d.tenant)a.push(`▶ ${buyer} : ${d.tenant}`);
 a.push('',`▶ ${d.kind==='매매'?'매매대금':'보증금'} : ${won(n.total)}`);if(d.kind==='월세')a.push(`▶ 월세 : ${won(n.monthly)} (${d.rentDay})`);if(d.kind!=='매매')a.push(`▶ 계약기간 : ${d.term}`);
 a.push('',`▶ 계약서 작성일 : ${d.signDate}`,`▶ 전체 약정 계약금 : ${won(n.deposit)}`,`▶ 이번 일부 지급액 : ${won(n.partial)} (${d.partialDate})`,`▶ 계약금 잔액 : ${won(n.deposit-n.partial)}${n.deposit>n.partial?" ("+d.depositDate+")":""}`);
 if(n.middle)a.push(`▶ 중도금 : ${won(n.middle)} (${d.middleDate})`);
 a.push(`▶ 잔금일 : ${d.balanceDate}`,`▶ 잔금 : ${won(n.total-n.deposit-n.middle)}`,'','▶ 특약사항');
 if(d.special)a.push(...d.special.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>'→ '+s.replace(/^[→•●-]\s*/,'')));else a.push('→ 별도로 기재한 특약 없음.');
 a.push('',`▶ 입금계좌 : ${d.bank} ${d.account} / 예금주 ${d.holder}`,'',`위 일부 지급액은 전체 약정 계약금에 포함되는 금액입니다.`);
 if(d.agreement)a.push('','▶ 별도 합의사항',d.agreement);if(d.brokerage)a.push('','▶ 중개보수 관련 합의',d.brokerage);
 a.push('','내용을 확인하신 후 동의 여부를 회신해 주세요. 양 당사자의 합의 및 수취계좌 확인 후 위 일정에 따라 진행하겠습니다.');return a.join('\n');
}
function contractGenerate(){contractInvalidate();const d=contractRead(),{errors,n}=contractValidate(d);if(errors.length){contractMessage(errors.join('\n'));return;}contractSnapshot=JSON.stringify(d);ce('contractOutput').textContent=contractBuild(d,n);contractMessage('문자가 완성되었습니다. 원문과 금액·날짜·계좌·특약을 대조해 주세요.');ce('contractResult').scrollIntoView({behavior:'smooth',block:'start'});}
function contractClear(){if(!confirm('입력한 내용과 완성 문자를 지울까요?'))return;contractGeneration++;contractBusy=false;ce('contractAIButton').disabled=false;ce('contract').querySelectorAll('input,textarea,select').forEach(e=>{e.value='';if(e.type==='checkbox')e.checked=false;});ce('contractQuestions').textContent='';contractInvalidate();contractMessage('새 문자를 작성할 수 있습니다.');}
async function contractAI(){
 if(contractBusy)return;const text=ce('contractRaw').value.trim(),code=ce('contractCode').value;
 if(text.length<5)return contractMessage('정리할 계약 내용을 적어 주세요.');if(!code)return contractMessage('AI 연결에는 기존 앱의 가족 입장 비밀번호를 입력해 주세요.');
 if(!window.FirstHyundaiNative?.draftContract)return contractMessage('AI 정리는 최신 안드로이드 앱에서 사용할 수 있습니다. 아래 항목을 직접 입력해 문자 완성은 가능합니다.');
 if(!ce('contractConsent').checked)return contractMessage('AI 처리 안내를 확인하고 동의해 주세요.');
 if(!confirm('AI가 아래 확인 항목을 새로 채웁니다. 직접 수정한 항목이 있다면 덮어써도 될까요?'))return;
 contractRequestInput=JSON.stringify(contractRead())+'|'+text;const id=++contractGeneration;contractBusy=true;ce('contractAIButton').disabled=true;contractInvalidate();contractMessage('내용을 정리하고 있습니다…');
 window.FirstHyundaiNative.draftContract(text,code,String(id));
 setTimeout(()=>{if(contractBusy&&contractGeneration===id){contractGeneration++;contractBusy=false;ce('contractAIButton').disabled=false;contractMessage('응답 시간이 초과됐습니다. 입력 내용은 남아 있습니다. 다시 시도해 주세요.');}},65000);
}
window.onContractDraft=function(r){if(String(contractGeneration)!==r.id)return;contractBusy=false;ce('contractAIButton').disabled=false;if(!r.ok)return contractMessage(r.error||'AI 정리에 실패했습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.');
 if(contractRequestInput!==JSON.stringify(contractRead())+'|'+ce('contractRaw').value.trim())return contractMessage('AI 정리 중 입력이 바뀌어 기존 내용을 보존했습니다. 다시 정리해 주세요.');
 const d=r.draft||{};for(const [key] of contractFields){ce('ct_'+key).value=typeof d[key]==='string'?d[key]:'';}
 ce('contractQuestions').textContent=(Array.isArray(d.questions)?d.questions:[]).join('\n');contractInvalidate();contractMessage('AI 초안입니다. 아래 숫자와 날짜, 특약을 원문과 대조해 주세요. 중도금이 없으면 0을 입력하세요.');ce('contractReview').scrollIntoView({behavior:'smooth'});
};
async function contractCopy(){if(!ce('contractConfirmed').checked||contractSnapshot!==JSON.stringify(contractRead()))return contractMessage('변경된 내용으로 문자를 다시 완성하고 확인해 주세요.');const text=ce('contractOutput').textContent;try{if(window.FirstHyundaiNative?.copyContract)window.FirstHyundaiNative.copyContract(text);else await navigator.clipboard.writeText(text);contractMessage('복사했습니다. 문자 또는 카카오톡에 붙여넣어 주세요.');}catch{contractMessage('복사가 되지 않았습니다. 완성 문자를 길게 눌러 복사해 주세요.');}}
function contractFromApartment(){if(ce('contractRaw').value||ce('ct_apartment').value){if(!confirm('작성 중인 내용이 있습니다. 아파트명과 주소만 바꿀까요?'))return;}const p=catalogRows().find(x=>x.id===complexSelected);switchPage('contract');if(p){ce('ct_apartment').value=p.label||'';ce('ct_address').value=p.address||p.road_address||'';}contractInvalidate();}
contractInit();
