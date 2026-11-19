// v2.1.94 contract memo regressions: advance vs total deposit, 3rd+ interim, unnumbered interims, amount before 일부/일단, single year notice. Fictional data only.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert(html.includes('<script src="contracts-language.js"></script><script src="contracts-transfer.js"></script><script src="contracts-easy.js"></script>'),'Load order is essential');
const elems=new Map();function el(id){
 if(!elems.has(id)){const state=new Set();elems.set(id,{
  id,value:'',textContent:'',innerHTML:'',className:'',open:false,
  checked:['ct_autoDeposit','ct_polishTerms'].includes(id),
  classList:{add:x=>state.add(x),remove:x=>state.delete(x),toggle:(x,flag)=>flag?state.add(x):state.delete(x),contains:x=>state.has(x)},
  focus(){},select(){},closest(){return null},scrollIntoView(){}});
 }return elems.get(id);
}
const complex=[{id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 테스트로 15',aliases:[]}];
const ctx=vm.createContext({window:{},document:{getElementById:el},catalogRows:()=>complex,alert(){},confirm(){return true},console,Date,Number,String,navigator:{}});
for(const file of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-transfer.js','contracts-easy.js']){
 const js=fs.readFileSync(path.join(dir,file),'utf8');
 assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(js),file+' cannot send contract data to the network');
 vm.runInContext(js,ctx);
}
const easy=ctx.window.FirstHyundaiEasy;
const head='퍼팍 15블럭 1501동 1203호 ';
function run(note){for(const k of elems.keys())if(k.startsWith('ct_'))el(k).value='';el('ct_rough').value=head+note;assert.equal(easy.compose(),true);
 return {v:id=>el('ct_'+id).value,w:el('ct_languageWarnings').textContent||el('ct_languageWarnings').innerHTML||''};}
let r;
// 가계약금/일부 계약금 is the advance, never the agreed total deposit (any order).
r=run('매매 6억 가계약금 500만원 계약금 6천만원 잔금 2027년 3월 31일');
assert.equal(r.v('contractDeposit'),'6000');assert.equal(r.v('advance'),'500');
r=run('매매 6억 계약금은 6천만원으로 하되 가계약금 500만원 선입금 잔금 2027년 3월 31일');
assert.equal(r.v('contractDeposit'),'6000');assert.equal(r.v('advance'),'500');
// "8억 일부 계약금" / "5억 일단": a unit-bearing amount before a 일/월 word is still the price.
r=run('매매 8억 일부 계약금 300만원 계약금 8천만원 잔금 2027년 6월 30일');
assert.equal(r.v('price'),'80000');assert.equal(r.v('contractDeposit'),'8000');assert.equal(r.v('advance'),'300');
r=run('전세 5억 일단 500 보내고 계약금 5천 잔금 2027년 6월 30일');
assert.equal(r.v('price'),'50000');assert.equal(r.v('advance'),'500');
// Dates still never become money.
r=run('매매 8억 계약금 8천 중도금 2억 2027년 1월 31일 잔금 2027년 6월 30일');
assert.equal(r.v('interim'),'20000');assert.equal(r.v('interimDate'),'2027-01-31');
// Date-first single unnumbered interim.
r=run('매매 8억 계약금 8천 중도금 2027년 1월 31일 2억 잔금 2027년 6월 30일');
assert.equal(r.v('interim'),'20000');assert.equal(r.v('interimDate'),'2027-01-31');
// Several unnumbered interims: never guessed, explicit review.
r=run('매매 8억 계약금 8천 중도금 2027년 1월 31일 1억, 2027년 3월 31일 1억 잔금 2027년 6월 30일');
assert.equal(r.v('interim'),'');assert.equal(r.v('interim2'),'');
assert(r.w.includes('중도금이 2건으로 보입니다'),'Unnumbered multiple interims must ask for review');
// 3rd interim is not dropped silently; rounds 1-2 still separate.
r=run('매매 10억 계약금 1억 1차 중도금 1억 2027년 1월 31일 2차 중도금 1억 2027년 3월 31일 3차 중도금 1억 2027년 5월 31일 잔금 2027년 9월 30일');
assert.equal(r.v('interim'),'10000');assert.equal(r.v('interim2'),'10000');assert.equal(r.v('interimDate2'),'2027-03-31');
assert(r.w.includes('3차 중도금이 있습니다'),'3rd interim must require confirmation');
// One year-estimate notice for the balance date, not two.
r=run('매매 7억 계약금 7천 잔금 4월 30일');
assert.equal((r.w.match(/잔금일의 연도/g)||[]).length,1,'Balance-date year notice must appear once');
console.log('Contract memo v2.1.94 regressions passed: advance/deposit, 3rd interim, unnumbered interims, 일부/일단 amounts, single year notice.');
