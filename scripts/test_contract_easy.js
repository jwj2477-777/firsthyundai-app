// One-memo workflow, manual disclosure, privacy and reversible special-clause cleanup.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..','app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const current=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
assert(current.includes('id="ct_manualPanel"'));
assert(current.includes('<details id="ct_manualPanel"'));
assert(current.indexOf('<details id="ct_manualPanel"')<current.indexOf('id="contractForm"'));
assert(!/<details id="ct_manualPanel"[^>]*\sopen(?:\s|>)/.test(current),'Manual form must be initially collapsed');
assert(current.includes('FirstHyundaiEasy.compose()'));
assert(current.includes('id="ct_resultPanel" class="panel hidden"'));
assert(current.includes('id="ct_termOriginal"')&&current.includes('id="ct_termPolished"'));
const els=new Map();
function e(id){
 if(!els.has(id)){
  const state=new Set(['ct_resultPanel','ct_termDiff','ct_fixMissing'].includes(id)?['hidden']:[]);
  els.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:id==='ct_autoDeposit'||id==='ct_polishTerms',open:false,
   classList:{add:k=>state.add(k),remove:k=>state.delete(k),toggle:(k,on)=>on?state.add(k):state.delete(k),contains:k=>state.has(k)},
   focus(){},select(){},scrollIntoView(){},closest(){return null}});
 }
 return els.get(id);
}
const data=[
 {id:'f14',label:'퍼스트파크 14블럭',address:'인천 연수구 컨벤시아대로252번길 50',aliases:['송도더샵퍼스트파크F14BL']},
 {id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 컨벤시아대로252번길 30',aliases:['송도더샵퍼스트파크F15BL']},
 {id:'avenue',label:'파크애비뉴',address:'인천 연수구 컨벤시아대로252번길 10',aliases:['송도더샵파크애비뉴']}
];
const alerts=[];
const context=vm.createContext({
 window:{},document:{getElementById:e},catalogRows:()=>data,
 confirm:()=>true,alert:s=>alerts.push(s),console,Date,Number,String,navigator:{}
});
for(const name of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-easy.js']){
 const source=fs.readFileSync(path.join(dir,name),'utf8');
 new vm.Script(source);
 assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(source),'Customer memos must remain local: '+name);
 vm.runInContext(source,context);
}
const app=context.window.FirstHyundaiContracts,easy=context.window.FirstHyundaiEasy;
const eq=(id,want)=>assert.equal(e('ct_'+id).value,String(want),'field: '+id);
const input=(memo)=>{e('ct_rough').value=memo;assert.equal(easy.compose(),true);};
assert.equal(easy._test.polishTerms('도배는 임대인이 해주는 걸로'),'도배는 임대인이 해주기로 한다.');
assert.equal(easy._test.polishTerms('반려동물 안돼'),'반려동물은 허용하지 않는다.');
assert.equal(easy._test.polishTerms('관리비 12만원은 임차인이 낸다'),'관리비 12만원은 임차인이 낸다.');
input('퍼스트팍 15블럭 1501동 1203호 전세 삼억구천, 오백 먼저 보내, 잔금일은 2026년 12월 30일, 2년. 특약은 임대인이 도배 해주는 걸로');
eq('property','퍼스트파크 15블럭');
eq('address',data[1].address);
eq('price','39000');eq('contractDeposit','3900');eq('advance','500');eq('leaseDuration','2년');
assert(e('ct_preview').value.includes('▶ 계약금 : 3,900만원'));
eq('terms','임대인이 도배 해주기로 한다.');
assert.equal(e('ct_termOriginal').textContent,'임대인이 도배 해주는 걸로');
assert.equal(e('ct_resultPanel').classList.contains('hidden'),false);
assert.equal(e('ct_manualPanel').open,false);
easy.useOriginalTerms();
eq('terms','임대인이 도배 해주는 걸로');
easy.usePolishedTerms();
eq('terms','임대인이 도배 해주기로 한다.');
easy.openManual();
assert.equal(e('ct_manualPanel').open,true);
e('ct_account').value='111-222-33333';e('ct_bank').value='테스트은행';e('ct_accountHolder').value='홍길동';
easy.afterManualEdit();
assert(e('ct_preview').value.includes('111-222-33333'));
// Switching to a new memo must not carry over any previous customer's bank details or clauses.
input('파크애비뉴 1601동 901호 매매 8억 계약금 전체는 8천 중도금 2억 이번에 1천 먼저 송금, 잔금일 2026.12.30');
eq('account','');eq('bank','');eq('accountHolder','');eq('terms','');
eq('price','80000');eq('contractDeposit','8000');eq('advance','1000');eq('interim','20000');
assert(e('ct_preview').value.includes('▶ 중도금 : 20,000만원'));
assert(e('ct_preview').value.includes('▶ 잔금 : 52,000만원'));
// Missing interim amount must never produce an empty row.
input('월세 파크애비뉴 1601동 901호 2천에 150 먼저 오백 보내 잔금 2026년 12월 30일 기간 2년, 특약은 반려동물 안돼');
eq('price','2000');eq('monthlyRent','150');eq('advance','500');
eq('terms','반려동물은 허용하지 않는다.');
assert(!e('ct_preview').value.includes('▶ 중도금 :'));
assert(app._test.collect().errors.includes('이번 송금액이 계약금보다 큼'));
input('퍼스트파크 15블럭 1501동 1203호 전세 3억9천, 500 먼저 보내 잔금은 12월 말');
eq('balanceDate','');
assert(e('ct_languageWarnings').textContent.includes('정확한 날짜'));
input('집주인 김철수 세입자 이영희 퍼스트파크 15블럭 1501동 1203호 전세 3억9천, 계약금 5%, 선입금 500만원, 잔금 2026.12.30 기간 2년');
eq('owner','김철수');eq('buyer','이영희');
eq('contractDeposit','1950');
assert(e('ct_languageWarnings').textContent.includes('5%'));
input('퍼스트파크 15블럭 1501동 1203호 전세 3억9천, 계약금 10%, 선입금 500만원 잔금 2026.12.30 기간 2년');
eq('contractDeposit','3900');
assert(e('ct_preview').value.includes('▶ 계약금 : 3,900만원'));
e('ct_rough').value='';
assert.equal(easy.compose(),false);
assert(alerts.some(a=>a.includes('먼저 계약 내용')));
console.log('Contract one-memo workflow passed: collapsed manual UI, local clause polish, source comparison, field reset, stale bank safety, amount checks and copy review.');


input('퍼팍 15블럭 1502동 3004호 매매 15억 중도금 4억 12년20일 잔금일 1월 30일\n매도인이 화장실 수리해주기로\n잔금일은 상호합의하에 앞당길수 있다');
assert.equal(e('ct_interim').value,'40000','Do not lose interim amount when date is mistyped');
assert.equal(e('ct_terms').value.split('\n').length,2,'Infer two unlabelled obligations');
assert(e('ct_terms').value.includes('화장실 수리해주기로 한다.'));
assert(e('ct_terms').value.includes('잔금일은 상호 합의하에 앞당길 수 있다.'));
assert(!e('ct_preview').value.includes('계약금 잔여액'));
assert(e('ct_languageWarnings').textContent.includes('월/년 표기가 불명확'));
console.log('Unlabelled field memo clause regression passed.');


/* One visual rectangle, two optional zones: both feed facts, neither requires
   nonempty special clauses, and top/bottom obligations are combined. */
e('ct_rough').value='파크애비뉴 1601동 901호 매매 8억 계약금 8천 이번 송금 1천 잔금일 2026.12.30';
e('ct_specialMemo').value='임대인이 도배 해주는 걸로';
assert.equal(easy.compose(),true,'Separate reminder text must not block composing');
eq('terms','임대인이 도배 해주기로 한다.');
eq('price','80000');
e('ct_specialMemo').value='';
assert.equal(easy.compose(),true);
eq('terms','','Optional special memo must never become required');
e('ct_rough').value='파크애비뉴 1601동 901호 매매 8억 계약금 8천 이번 송금 1천 잔금일 2026.12.30\n특약: 잔금일은 상호합의하에 앞당길수 있다';
e('ct_specialMemo').value='임대인이 도배 해주는 걸로';
assert.equal(easy.compose(),true);
assert(e('ct_terms').value.includes('잔금일은 상호 합의하에 앞당길 수 있다.'));
assert(e('ct_terms').value.includes('임대인이 도배 해주기로 한다.'));
e('ct_rough').value='';
e('ct_specialMemo').value='파크애비뉴 1601동 901호 매매 8억 계약금 8천 잔금일 2026.12.30\n특약: 임대인이 도배 해주는 걸로';
assert.equal(easy.compose(),true,'Contract facts entered in either half should be recognized');
eq('property','파크애비뉴');
eq('price','80000');
eq('terms','임대인이 도배 해주기로 한다.');
console.log('Unified optional contract-note zones preserve recognized facts and natural clause copyediting.');
