/* Synthetic amounts, dates and property only. Never commit a real client's memo. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=path.join(__dirname,'../app/src/main/assets'),nodes=new Map();
function element(id){
 if(!nodes.has(id)){
  const flags=new Set();nodes.set(id,{id,value:'',textContent:'',innerHTML:'',open:false,
   checked:['ct_autoDeposit','ct_polishTerms'].includes(id),className:'',
   classList:{add:v=>flags.add(v),remove:v=>flags.delete(v),contains:v=>flags.has(v),toggle:(v,on)=>on?flags.add(v):flags.delete(v)},
   focus(){},select(){},closest(){return null},scrollIntoView(){},setAttribute(){}});
 }
 return nodes.get(id);
}
const context=vm.createContext({window:{},document:{getElementById:element},
 catalogRows:()=>[{id:'fictional-only',label:'가상파크',address:'인천 연수구 가상로 999',aliases:[]}],
 alert(){},confirm:()=>true,navigator:{},Date,Number,String,console});
for(const file of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-transfer.js','contracts-easy.js']){
 const source=fs.readFileSync(path.join(assets,file),'utf8');assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(source));vm.runInContext(source,context);
}
const lang=context.window.FirstHyundaiLanguage,app=context.window.FirstHyundaiContracts;
const field=id=>element('ct_'+id).value;
function compose(text){element('ct_rough').value=text;assert(context.window.FirstHyundaiEasy.compose());}
const sample='매매계약\n1.가상동999 가상파크 9901동 1102호. 2.매매금액-12억7000만원. 3.계약금.1.27억원. 중도금 3억-28년2월말이나 협의가능. 3.잔금 -28년 8월26일. 4.기타사항 협의후 결정';
compose(sample);
assert.equal(field('price'),'127000');assert.equal(field('contractDeposit'),'12700');
assert.equal(field('interim'),'30000');assert.equal(field('balanceDate'),'2028-08-26');
assert(field('interimDate').includes('28년2월말')&&field('interimDate').includes('협의가능'));
assert(!field('interimDate').includes('08-26'),'The balance date must never become the interim date');
for(const id of ['advance','contractDate','bank','account','accountHolder'])assert.equal(field(id),'','Absent '+id+' stays missing');
assert(!app._test.collect().errors.includes('매매대금 또는 보증금'));
assert(!app._test.collect().errors.includes('약정 계약금'));
for(const separator of ['-', '.', ':','：','–','—']){
 compose('가상파크 9901동 1102호 매매계약 2.거래금액'+separator+'9.6억원. 3.계약금'+separator+'0.96억원. 잔금 28년8월26일');
 assert.equal(field('price'),'96000',separator);assert.equal(field('contractDeposit'),'9600',separator);
 assert.equal(field('advance'),'','Full deposit is not this remittance');
}
compose('가상파크 9901동 1102호 매매계약 거래금액. 3.계약금.9600만원 잔금 28년8월26일');
assert.equal(field('price'),'','A numbered field marker cannot fill a missing price');
compose('가상파크 9901동 1102호 매매 9.6억원 계약금0.96억원 중도금 2억 28년1월15일. 잔금 28년8월26일');
assert.equal(field('interimDate'),'2028-01-15');assert.equal(field('balanceDate'),'2028-08-26');
assert.equal(lang._test.moneyPart('1.27억원'),12700);
assert.equal(lang._test.moneyPart('9.6억원'),96000);
console.log('Punctuated contract memo passed: numbered clauses, amount separators, decimal 억원, independent interim/balance schedules and no invented payment data.');
