// Free-form Korean contract notes: thorough regression without network or live customer data.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..','app/src/main/assets');
const files=['contracts.js','contracts-smart.js','contracts-language.js'];
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert(html.includes('contracts-language.js')&&html.includes('ct_recognized')&&html.includes('ct_languageWarnings'));
const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:id==='ct_autoDeposit',
  classList:{toggle(){}},focus(){},select(){},closest(){return null;}});
 return elements.get(id);
}
const catalog=[
 {id:'f14',label:'퍼스트파크 14블럭',address:'인천 연수구 컨벤시아대로252번길 50',aliases:['송도더샵퍼스트파크F14BL']},
 {id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 컨벤시아대로252번길 30',aliases:['송도더샵퍼스트파크F15BL']},
 {id:'avenue',label:'파크애비뉴',address:'인천 연수구 컨벤시아대로252번길 10',aliases:['송도더샵파크애비뉴']}
];
const alerts=[];
const ctx=vm.createContext({window:{},document:{getElementById:el},catalogRows:()=>catalog,confirm:()=>true,alert:s=>alerts.push(s),navigator:{},console,Date,Number,String});
for(const f of files){const s=fs.readFileSync(path.join(dir,f),'utf8');new vm.Script(s);assert(!/\b(?:fetch|XMLHttpRequest|localStorage)\b/.test(s),f+' must be offline-only');vm.runInContext(s,ctx);}
const app=ctx.window.FirstHyundaiContracts,language=ctx.window.FirstHyundaiLanguage;
const eq=(id,expected)=>assert.equal(el('ct_'+id).value,String(expected),id+' must be recognized correctly');
const reset=()=>app.reset();
const tryNote=note=>{el('ct_rough').value=note;app.extractNotes();return language._test;};
assert.equal(language._test.koreanNumber('오백'),500);
assert.equal(language._test.koreanNumber('삼천오백'),3500);
assert.equal(language._test.moneyPart('삼억구천만원'),39000);
assert.equal(language._test.moneyPart('3억9천만원'),39000);
assert.equal(language._test.moneyPart('3억 9000만원'),39000);
assert.equal(language._test.moneyPart('오백'),500);
assert.equal(language._test.moneyPart('2억5천5백만원'),25500);
assert.equal(language._test.moneyPart('500만원'),500);
assert.equal(language._test.dateIn('12월 말'),null);
assert.equal(language._test.dateIn('2026년 2월 31일'),null);
tryNote('퍼스트팍 15블럭 1501동 1203호 전세 삼억구천만원 오백 먼저 보내고 잔금은 2026년 12월 30일, 기간 2년');
eq('property','퍼스트파크 15블럭');
eq('address',catalog[1].address);
eq('unit','1501동 1203호');
eq('price','39000');
eq('advance','500');
eq('contractDeposit','3900');
eq('balanceDate','2026-12-30');
eq('leaseDuration','2년');
assert(el('ct_recognized').textContent.includes('선송금액'));
reset();
tryNote('파크애비뉴 1601동 901호 매매 8억 계약금 전체는 8천 중도금 2억 이번에 1천 먼저 송금. 잔금일 2026.12.30');
eq('property','파크애비뉴');
eq('price','80000');
eq('contractDeposit','8000');
eq('interim','20000');
eq('advance','1000');
app.makePreview();
assert(el('ct_preview').value.includes('▶ 중도금 : 20,000만원'));
assert(el('ct_preview').value.includes('▶ 잔금 : 52,000만원'));
reset();
tryNote('월세 파크애비뉴 1601동 901호 2천에 150, 먼저 오백 보내, 잔금 2026년 12월 30일 기간 2년');
eq('dealType','월세');
eq('price','2000');
eq('monthlyRent','150');
eq('advance','500');
reset();
tryNote('퍼스트파크 15블럭 1501동 1203호 전세 3억9천, 계약금 500 먼저 보내 잔금은 12월 말');
eq('advance','500');
eq('price','39000');
eq('contractDeposit','3900');
assert(!el('ct_balanceDate').value);
assert(el('ct_languageWarnings').textContent.includes('정확한 날짜'));
reset();
tryNote('퍼스트파크 15블럭 1501동 1203호 전세 3억 9천 계좌번호: 123-456-78901 예금주 김영희 잔금일 2026-12-30 계약기간 2년');
eq('account','123-456-78901');
eq('accountHolder','김영희');
reset();
tryNote('퍼스트파크 1501동 1203호 전세 3억9천 잔금일 2026년 12월 30일');
eq('property','퍼스트파크 15블럭');
eq('address',catalog[1].address);
assert(el('ct_languageWarnings').textContent.includes('앞 두 자리'));
console.log('Natural-language contract extraction passed: mixed colloquial sentences, spoken numbers, unique blocks, partial dates, monthly rent, accounts, balances.');

for(const [family,blocks,prefix] of [['퍼스트파크',[13,14,15],'f'],['마스터뷰',[21,22,23],'m']]){
 for(const b of blocks)if(!catalog.some(x=>x.id===prefix+b))catalog.push({id:prefix+b,label:family+' '+b+'블럭',address:'인천 연수구 테스트로 '+b,aliases:[]});
 for(const b of blocks){
  reset();tryNote((prefix==='f'?'퍼팍':'마뷰')+' '+b+'02동 903호 전세 5억');
  eq('property',family+' '+b+'블럭');eq('unit',b+'02동 903호');
 }
}
reset();tryNote('마뷰2301동 1002호 전세 5억');eq('property','마스터뷰 23블럭');
reset();tryNote('퍼팍 15블럭 1402동 903호 전세 5억');
assert(!el('ct_address').value);assert(el('ct_languageWarnings').textContent.includes('다릅니다'));
reset();tryNote('1502동 903호 전세 5억');assert(!el('ct_address').value,'Dong alone cannot identify an apartment family');
reset();tryNote('퍼팍 2301동 903호 전세 5억');assert(!el('ct_address').value,'Unknown family/block combination must not match');
reset();tryNote('퍼팍 1402동 또는 1502동 903호 전세 5억');assert(!el('ct_address').value,'Multiple buildings require confirmation');
reset();tryNote('퍼팍 전세 5억');assert(!el('ct_address').value,'No dong or block means ambiguous');
console.log('Songdo dong-prefix inference passed: six blocks, attached alias, conflicting block, unknown family and multiple dongs.');


// Date field is free text for mutually negotiated writing schedules, not date-only.
for(const [memo,expected,flexible] of [
 ['계약은 10월중 협의','10월중 협의',true],
 ['본계약은 추후 협의','추후 협의',true],
 ['계약일은 10월 말 예정','10월 말 예정',true],
 ['계약은 잔금 전 작성','잔금 전 작성',true],
 ['계약일 2027년 10월 25일','2027-10-25',false],
 ['계약은 27년 10월25일','2027-10-25',false]
]){
 const result=language._test.contractScheduleCandidate(memo);
 assert(result,'Contract date memo missing: '+memo);
 assert.equal(result.value,expected);
 assert.equal(result.flexible,flexible);
}
assert.equal(language._test.contractScheduleCandidate('계약금 6천'),null,'Contract money is never a writing date');
reset();
tryNote('퍼팍 15블럭 1502동 3004호 매매 16억 계약금 6천 잔금 27년 1월5일\n계약은 10월중 협의');
eq('contractDate','10월중 협의');
assert(el('ct_preview').value===''||!el('ct_preview').value.includes('계약금 6천 협의'));
console.log('Negotiated signing window and precise Korean date test passed.');
