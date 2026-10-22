// Official transaction exclusive-area census + source-backed apartment -> contract bridge.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('data/complexes.json'));
const active=data.records.filter(x=>!x.aggregate_only);
assert(active.length>=90,'Keep all individual public apartment catalog rows');
const validPairs=x=>(x.area_type_pairs||[]).filter(p=>
 p&&new Set(x.supply_type_labels||[]).has(p.supply_label)&&
 /^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,8}$/.test(p.supply_label)&&
 Number.isFinite(p.exclusive_m2)&&Number.isFinite(p.supply_m2)&&
 p.exclusive_m2>0&&p.supply_m2>p.exclusive_m2&&p.supply_m2/p.exclusive_m2<2.5&&
 Math.abs(parseFloat(p.supply_label)-p.supply_m2)<2);
let missing=0,exclusiveOnly=0,paired=0;
for(const x of active){
 const verified=validPairs(x);paired+=verified.length;
 const obs=(x.area_types_m2||[]).filter(n=>!verified.some(p=>Math.abs(p.exclusive_m2-n)<=.011));
 if(obs.length)missing++;
 exclusiveOnly+=obs.length;
 assert(x.area_types_m2?.length>0||verified.length>0,'Apartment must have at least one verified source area: '+x.label);
}
assert(missing>=20,'Do not accidentally hide recorded exclusive sizes');
assert(exclusiveOnly>=30,'Need real official-exclusive-only rows, not invented supply areas');
const elements=new Map(),attr={},classes=new Set();
function E(id){
 if(!elements.has(id)){
  const flags=new Set();
  elements.set(id,{id,value:'',innerHTML:'',textContent:'',className:'',checked:id==='ct_autoDeposit',
   open:false,scrollTop:0,options:[{}],attributes:{},
   classList:{add(k){flags.add(k)},remove(k){flags.delete(k)},toggle(k,on){on?flags.add(k):flags.delete(k)},contains(k){return flags.has(k)}},
   focus(){},scrollIntoView(){},getAttribute(k){return this.attributes[k]},
   setAttribute(k,v){this.attributes[k]=v},closest(){return null},select(){},
   showModal(){this.open=true},close(){this.open=false}});
 }
 return elements.get(id);
}
E('ct_dealType').value='전세';
let permit=true,questions=0;
const payload={
 'complexes.json':data,
 'trades.json':{schema_version:1,state:'ok',area:'송도동',records:[
  {building:'송도더샵퍼스트파크F15BL',area_m2:84.90,contract_date:'2026-10-22',type:'매매',amount_10k:130000},
  {building:'더샵송도프라임뷰20BL',area_m2:84.95,contract_date:'2026-10-22',type:'매매',amount_10k:140000},
  {building:'더샵송도프라임뷰25BL',area_m2:101.50,contract_date:'2026-10-22',type:'매매',amount_10k:150000},
 ]},
 'new_trades.json':{schema_version:1,state:'ok',records:[]},
 'news.json':{schema_version:1,state:'ok',briefs:[]}
};
const body={classList:{add(k){classes.add(k)},remove(k){classes.delete(k)},contains(k){return classes.has(k)}},setAttribute(k,v){attr[k]=v}};
const ctx=vm.createContext({window:{},document:{getElementById:E,body,activeElement:E('complexSearch')},
 localStorage:{getItem(){return null},setItem(){}},
 fetch:async url=>({ok:true,json:async()=>payload[url.split('/').pop().split('?')[0]]}),
 alert(){},confirm(){questions++;return permit;},console,URL,Blob,Date,Number,String});
const ui=read('app/src/main/assets/index.html').split('<script>')[1].split('</script>')[0];
vm.runInContext(ui,ctx);
for(const file of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-easy.js']){
 vm.runInContext(fs.readFileSync(path.join(assets,file),'utf8'),ctx);
}
(async()=>{
 for(let i=0;i<35;i++)await Promise.resolve();
 const run=code=>vm.runInContext(code,ctx);
 run("switchPage('complexes')");
 run("selectComplex('m21')");
 run("setComplexDetailTab('types')");
 let html=E('complexDetails').innerHTML;
 const master=data.records.find(x=>x.id==='m21');
 const verified=validPairs(master);
 const only=master.area_types_m2.filter(n=>!verified.some(p=>Math.abs(p.exclusive_m2-n)<=.011));
 assert(only.length>=4,'m21 must have unmatched official trade areas');
 for(const n of only)assert(html.includes('전용 '+String(n)+'㎡'),'Observed exclusive area not displayed: '+n);
 assert(html.includes('실거래 전용면적 확인 · 공급·평형은 대조 중'));
 assert(html.includes('이 면적으로 계약 작성 →'));
 assert.equal((html.match(/complexAreaItem/g)||[]).length,verified.length+only.length);
 assert(!html.includes('공급 '+String(only[0])+'㎡'),'Cannot label exclusive area as supply area');
 run("window.FirstHyundaiContracts.fromSelectedComplex(84.92,'115C')");
 assert.equal(E('ct_property').value,'마스터뷰 21블럭');
 assert.equal(E('ct_address').value,master.address);
 assert.equal(E('ct_exclusiveArea').value,'84.92');
 assert(E('ct_rough').value.includes('아파트명: 마스터뷰 21블럭'),'Top-level memo must carry actual chosen name');
 assert(E('ct_rough').value.includes('소재지: '+master.address),'Top-level memo must carry verified address');
 assert(E('ct_rough').value.includes('전용면적: 84.92㎡'),'Top-level memo must carry chosen area');
 assert(E('ct_supplyInfo').value.includes('115C타입'));
 assert(E('ct_selectedComplexContext').textContent.includes('마스터뷰 21블럭'));
 assert.equal(run("window.FirstHyundaiEasy.compose()"),true,'One-memo button must not throw away selected apartment');
 assert.equal(E('ct_property').value,'마스터뷰 21블럭','Memo composition preserves selected apartment');
 assert.equal(E('ct_exclusiveArea').value,'84.92','Memo composition preserves selected area');
 assert(E('ct_preview').value.includes('▶ 전용면적 : 84.92㎡'));
 assert(E('ct_preview').value.includes('115C타입 · 공급 115.16㎡'));
 // Enter an unverified (but real transaction-observed) area. Supply stays blank.
 run("switchPage('complexes')");
 run("selectComplex('m21')");
 run("window.FirstHyundaiContracts.fromSelectedComplex("+only[0]+")");
 assert.equal(E('ct_exclusiveArea').value,String(only[0]));
 assert.equal(E('ct_supplyInfo').value,'','Unverified area cannot gain made-up supply/market pyeong');
 assert.equal(run("window.FirstHyundaiEasy.compose()"),true);
 assert(E('ct_preview').value.includes('▶ 전용면적 : '+only[0]+'㎡'));
 assert(!E('ct_preview').value.includes('▶ 전용면적 : '+only[0]+'㎡ · 공급'),'No invented pair');
 // Parent's prior client memo/account should not follow across new apartments.
 E('ct_account').value='111-222-333333';E('ct_bank').value='가상은행';
 run("switchPage('complexes')");run("selectComplex('prime20')");
 permit=false;const kept=E('ct_rough').value;
 assert.equal(run("window.FirstHyundaiContracts.fromSelectedComplex()"),false);
 assert.equal(E('ct_rough').value,kept,'Cancelled replacement preserves the original customer');
 permit=true;assert.equal(run("window.FirstHyundaiContracts.fromSelectedComplex()"),true);
 assert.equal(E('ct_account').value,'','Old customer account must not leak');
 assert.equal(E('ct_property').value,'프라임뷰 20블럭');
 assert(E('ct_rough').value.startsWith('아파트명: 프라임뷰 20블럭'));
 assert(!E('ct_rough').value.includes('마스터뷰'));
 // Official area for prime 25 must never flow into prime 20.
 run("switchPage('complexes')");run("selectComplex('prime20')");run("setComplexDetailTab('types')");
 const twenty=E('complexDetails').innerHTML;
 assert(!twenty.includes('전용 101.5㎡'),'Never merge a similarly named block');
 console.log('Area census/contract bridge passed:',active.length,'complexes,',paired,
  'verified type pairings,',exclusiveOnly,'previously hidden exclusive areas in',missing,
  'complexes; contract memo/pair/no-leakage tested.');
})().catch(err=>{console.error(err);process.exitCode=1});
