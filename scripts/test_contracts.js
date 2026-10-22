// Contract drafting is private, offline, typo-tolerant and requires human review.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'app/src/main/assets');
const base=fs.readFileSync(path.join(dir,'contracts.js'),'utf8');
const smart=fs.readFileSync(path.join(dir,'contracts-smart.js'),'utf8');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
new vm.Script(base);new vm.Script(smart);
assert(html.includes('id="contracts"')&&html.includes('contracts-smart.js'));
assert(html.includes('ct_address')&&html.includes('ct_autoDeposit')&&html.includes('ct_suggestions'));
assert(!/\b(localStorage|fetch|XMLHttpRequest)\b/.test(base+smart),'Customer contract information must not be sent or persisted');
const elements=new Map();
function el(id){
 if(!elements.has(id)){
  elements.set(id,{
   id,value:'',textContent:'',innerHTML:'',className:'',checked:id==='ct_autoDeposit',
   classList:{toggle(){}},focus(){},select(){},closest(){return null;}
  });
 }
 return elements.get(id);
}
const catalog=[
 {id:'f14',label:'퍼스트파크 14블럭',address:'인천 연수구 컨벤시아대로252번길 50',aliases:['송도더샵퍼스트파크F14BL']},
 {id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 컨벤시아대로252번길 30',aliases:['송도더샵퍼스트파크F15BL']},
 {id:'prime20',label:'프라임뷰 20블럭',address:'인천 연수구 인천타워대로231번길 97',aliases:['더샵송도프라임뷰20BL']},
 {id:'avenue',label:'파크애비뉴',address:'인천 연수구 컨벤시아대로252번길 10',aliases:['송도더샵파크애비뉴']}
];
const alerts=[];
const ctx=vm.createContext({
 window:{},document:{getElementById:el},
 alert(message){alerts.push(message)},confirm(){return true},
 Date,Number,String,console,navigator:{},
 catalogRows(){return catalog}
});
vm.runInContext(base,ctx);vm.runInContext(smart,ctx);
const api=ctx.window.FirstHyundaiContracts,assistant=ctx.window.FirstHyundaiSmart;
const {contractValue,normalizeDate,collect}=api._test;
assert.equal(contractValue('3억9천만원'),39000);
assert.equal(contractValue('3억 9000만원'),39000);
assert.equal(contractValue('39,000만원'),39000);
assert.equal(contractValue('500만원'),500);
assert.equal(contractValue('3억 9천 5백만원'),39500);
assert.equal(contractValue('입력오류'),null);
assert.equal(normalizeDate('2026년 12월 30일'),'2026-12-30');
assert.equal(normalizeDate('2026.02.31'),'');
el('ct_dealType').value='전세';
el('ct_property').value='퍼스트파크 15블럭';
assistant.onOpen();
assert.equal(el('ct_address').value,catalog[1].address,'Complete block name fills verified address');
assert.equal(assistant._test.choices('퍼스트팍 15블럭')[0].row.id,'f15','One-typo candidate');
el('ct_property').value='퍼스트파크';
assistant.changed({target:el('ct_property')});
assert(!el('ct_address').value,'Shared root name must not guess block address');
assert(el('ct_suggestions').innerHTML.includes('14블럭')&&el('ct_suggestions').innerHTML.includes('15블럭'));
assistant.select('f15');
assert.equal(el('ct_address').value,catalog[1].address);
el('ct_unit').value='1501동 1203호';
el('ct_price').value='39000';
assistant.changed({target:el('ct_price')});
assert.equal(el('ct_contractDeposit').value,'3900','Missing deposit is 10% by default');
assert(el('ct_depositHelp').textContent.includes('10%'));
el('ct_advance').value='500';
el('ct_balanceDate').value='2026-12-30';
el('ct_contractDate').value='2026-11-12';
el('ct_leaseDuration').value='2년';
el('ct_bank').value='테스트은행';
el('ct_account').value='123-45-67890';
el('ct_accountHolder').value='홍길동';
el('ct_terms').value='현 상태로 인도한다.\n권리관계 변경이 없어야 한다.';
assert.equal(collect().errors.length,0,JSON.stringify(collect().errors));
api.makePreview();
assert(el('ct_preview').value.includes('▶ 소재지 : '+catalog[1].address));
assert(el('ct_preview').value.includes('▶ 계약금 : 3,900만원'));
assert(el('ct_preview').value.includes('전세보증금의 10%'));
assert(el('ct_preview').value.includes('계약금 중 일부인 500만원을'),'Pre-agreed remittance notice should always appear');
assert(!el('ct_preview').value.includes('계약금 잔여액'),'Avoid misleading remainder in customer notice');
assert(el('ct_preview').value.includes('▶ 잔금 : 35,100만원'));
assert(!el('ct_preview').value.includes('▶ 중도금 :'),'Absent interim must not render a row');
assert(!el('ct_preview').value.includes('계약금 포기'));
el('ct_price').value='40000';
assistant.changed({target:el('ct_price')});api.updateSummary();
assert.equal(el('ct_contractDeposit').value,'4000','Automatic 10% changes with total price');
api.approve();
assert(alerts.some(a=>a.includes('초안')),'Old preview cannot be approved after changing amount');
el('ct_contractDeposit').value='3500';
assistant.changed({target:el('ct_contractDeposit')});
el('ct_price').value='42000';assistant.changed({target:el('ct_price')});
assert.equal(el('ct_contractDeposit').value,'3500','Explicit contract deposit always wins');
el('ct_interim').value='5000';
api.makePreview();
assert(el('ct_preview').value.includes('▶ 중도금 : 5,000만원'));
assert(el('ct_preview').value.includes('▶ 잔금 : 33,500만원'));
el('ct_autoDeposit').checked=false;
assistant.changed({target:el('ct_autoDeposit')});
assert.equal(el('ct_contractDeposit').value,'3500','Disabling auto never deletes manual deposit');
api.reset();
assert.equal(el('ct_autoDeposit').checked,true);
el('ct_rough').value='아파트 퍼스트파크 15블럭 1501동 1203호 전세 3억9천만원 먼저 500만원 보내 잔금일 2026년 12월 30일 기간 2년';
api.extractNotes();
assert.equal(el('ct_property').value,'퍼스트파크 15블럭');
assert.equal(el('ct_address').value,catalog[1].address);
assert.equal(el('ct_unit').value,'1501동 1203호');
assert.equal(el('ct_price').value,'39000');
assert.equal(el('ct_contractDeposit').value,'3900');
assert.equal(el('ct_advance').value,'500');
assert.equal(el('ct_balanceDate').value,'2026-12-30');
assert.equal(el('ct_leaseDuration').value,'2년');
api.reset();
el('ct_rough').value='소재지: 파크애비뉴\n동호수: 1601동 1702호\n전세보증금: 3억9천만원\n계약금: 3900만원\n이번 송금액: 500만원\n잔금일: 2026.12.30\n특약사항:\n1. 현 상태 인도';
api.extractNotes();
assert.equal(el('ct_price').value,'39000');
assert.equal(el('ct_contractDeposit').value,'3900');
assert.equal(el('ct_advance').value,'500');
assert.equal(el('ct_balanceDate').value,'2026-12-30');
assert(el('ct_terms').value.includes('현 상태 인도'));
assert.equal(el('ct_address').value,catalog[3].address);
console.log('Smart contract drafting passed: trusted addresses, fuzzy blocks, auto 10%, manual override, amounts, optional interim, speech and stale-preview guard');
