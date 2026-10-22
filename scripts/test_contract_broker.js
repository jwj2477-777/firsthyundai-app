// Contract notices follow the office's pre-negotiated terms; all examples are fictional.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','app/src/main/assets');
const files=['contracts.js','contracts-smart.js','contracts-language.js','contracts-easy.js'];
const elements=new Map();
const el=id=>{
 if(!elements.has(id)){
  const c=new Set();elements.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:['ct_autoDeposit','ct_polishTerms'].includes(id),open:false,
   classList:{add:k=>c.add(k),remove:k=>c.delete(k),toggle:(k,v)=>v?c.add(k):c.delete(k),contains:k=>c.has(k)},
   focus(){},scrollIntoView(){},select(){},closest(){return null}});
 }
 return elements.get(id);
};
const catalog=[
 {id:'f13',label:'퍼스트파크 13블럭',address:'인천 연수구 테스트로 130',aliases:['송도 더샵 퍼스트파크 F13BL']},
 {id:'f14',label:'퍼스트파크 14블럭',address:'인천 연수구 테스트로 140',aliases:[]},
 {id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 테스트로 150',aliases:[]},
 {id:'m21',label:'마스터뷰 21블럭',address:'인천 연수구 테스트로 210',aliases:[]}
];
const ctx=vm.createContext({window:{},document:{getElementById:el},catalogRows:()=>catalog,alert(){},confirm(){return true},console,Date,Number,String,navigator:{}});
for(const filename of files){
 const js=fs.readFileSync(path.join(dir,filename),'utf8');
 new vm.Script(js);
 assert(!/\b(?:fetch|XMLHttpRequest|localStorage)\b/.test(js),'Contract text must not be uploaded or persisted');
 vm.runInContext(js,ctx);
}
const smart=ctx.window.FirstHyundaiSmart,app=ctx.window.FirstHyundaiContracts,easy=ctx.window.FirstHyundaiEasy;
const put=t=>{el('ct_rough').value=t;assert.equal(easy.compose(),true)};
const has=x=>assert(el('ct_preview').value.includes(x),'Missing in broker letter: '+x);
assert.equal(smart._test.choices('퍼팍 13블럭')[0].row.id,'f13');
assert.equal(smart._test.choices('마뷰 21블럭')[0].row.id,'m21');
put('퍼팍 13블럭 1304동 3703호 매매 10억 2000만원 계약금 1억200만원 중도금 2억원 금일 천만원 국민은행 1234567-01-987654 김철수 계약일 2023년 9월 14일 중도금지급일 2023년 10월중 협의 잔금일 2023년 12월 11일');
assert.equal(el('ct_property').value,'퍼스트파크 13블럭');
assert.equal(el('ct_price').value,'102000');
assert.equal(el('ct_contractDeposit').value,'10200');
assert.equal(el('ct_interim').value,'20000');
assert.equal(el('ct_advance').value,'1000');
assert.equal(el('ct_account').value,'1234567-01-987654');
assert.equal(el('ct_accountHolder').value,'김철수');
assert.equal(el('ct_owner').value,'');
assert.equal(el('ct_interimDate').value,'2023년 10월중 협의');
has('▶ 매매대금 : 102,000만원');
has('▶ 계약금 : 10,200만원');
has('▶ 중도금 : 20,000만원');
has('▶ 잔금 : 71,800만원');
has('계약금 중 일부인 1,000만원');
has('이체와 동시에 본계약이 체결된 것으로');
has('실제 수령한 금액의 배액');
has('실제 송금한 금액을 포기');
has('중개보수 지급의무');
assert(!el('ct_preview').value.includes('선송금 예정액'),'Do not show awkward advance row');
assert(!el('ct_preview').value.includes('[확인 필요]'));
assert.equal(app._test.collect().errors.length,0);
app.approve();
assert(el('ct_status').textContent.includes('직접 확인 완료'),
 'Pre-agreed cancellation terms require no redundant checkbox, only final approval');
put('아파트명 : 퍼스트파크 1304동 3703호(84A)\n소재지 : 인천 연수구 송도동 100.\n매매대금 : 10억 2000만원\n계약일 : 2023년 9월 14일.\n계약금 : 1억 200만원\n중도금지급일 : 2023년 10월중 협의\n중도금 : 2억원\n잔금일 : 2023년 12월 11일.\n특약사항\n→상기 중도금지급일과 잔금일은 상호합의하에 앞당길수 있다.\n→매도인은 잔금수령과 동시에 현재 설정된 근저당권을 전액상환 후 말소한다.\n→기타사항은 계약시 협의.\n※ 금일 위 내용을 바탕으로 계약금의 일부(1,000만원)가 매도인계좌(국민은행 1234567-01-987654 김철수)로 송금되며.');
assert.equal(el('ct_address').value,'인천 연수구 송도동 100');
assert.equal(el('ct_unit').value,'1304동 3703호(84A)');
assert.equal(el('ct_advance').value,'1000');
assert.equal(el('ct_terms').value.split('\n').length,3);
assert(!el('ct_terms').value.includes('※'),'Separate the negotiated footer from special clauses');
assert(!el('ct_terms').value.includes('송금되며'));
has('▶ 잔금 : 71,800만원');
put('마뷰 21블럭 2102동 1105호 전세 5억 오늘 500 신한은행 111-222-333333 이영희 잔금일 2026년 12월 11일 2년');
assert.equal(el('ct_property').value,'마스터뷰 21블럭');
assert.equal(el('ct_advance').value,'500');
has('500만원');
assert(!el('ct_preview').value.includes('▶ 중도금 :'),'Absent interim should not create a blank field');
put('퍼팍 13블럭 1304동 3703호 매매 10억 2000만원 금일 1,000만 원 매도인 계좌 국민은행 1234567-01-987654 김철수 잔금일 2026년 12월 11일');
assert.equal(el('ct_advance').value,'1000');
console.log('Broker contract regression passed: prior agreement footer, exact office message, alias names, today-transfer, account triplet, special clauses, and deliberate consent.');
