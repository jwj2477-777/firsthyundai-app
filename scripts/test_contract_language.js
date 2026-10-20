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
assert(el('ct_preview').value.includes('▶ 최종 잔금 : 52,000만원'));
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
assert(!el('ct_address').value,'Block cannot be invented');
assert(!el('ct_property').value||el('ct_languageWarnings').textContent.includes('단지명'));
console.log('Natural-language contract extraction passed: mixed colloquial sentences, spoken numbers, unique blocks, partial dates, monthly rent, accounts, balances.');
