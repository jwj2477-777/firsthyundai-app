'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{
 id,value:'',hidden:true,checked:false,textContent:'',href:'',attributes:{},children:[],
 replaceChildren(){this.children=[];},
 append(...items){this.children.push(...items);},
 setAttribute(name,value){this.attributes[name]=value;},
 scrollIntoView(){}
});return elements.get(id);}
const win={},doc={getElementById:element,createElement:tag=>({tag,textContent:'',className:'',children:[],append(...nodes){this.children.push(...nodes);}})};
vm.runInNewContext(read('app/src/main/assets/realty-calculators.js'),{window:win,document:doc,Intl,Number,String,Math,Object,Set,Error});
const calc=win.FirstHyundaiCalculators,fn=calc._test;
const approx=(a,b,t=1e-7)=>assert(Math.abs(a-b)<=t,`expected ${a} ≈ ${b}`);
assert.equal(fn.num('',100),null);
assert.equal(fn.num('-1',100),null);
assert.equal(fn.num('1e2',100),null);
assert.equal(fn.num('0.5',100),null);
assert.equal(fn.num('4.5',100,true),4.5);
assert.equal(fn.num('Infinity',100),null);
const fee=(kind,deal,amountWan,rentWan=0)=>fn.commission({kind,deal,amountWan,rentWan});
assert.equal(fee('house','sale',140000).maximum,8400000,'14억 주택 0.6%');
assert.equal(fee('house','sale',150000).maximum,10500000,'15억부터 0.7%');
assert.equal(fee('house','sale',90000).maximum,4500000,'9억부터 0.5%');
assert.equal(fee('house','sale',30000).maximum,1200000);
assert.equal(fee('house','sale',19999).maximum,800000,'5천만~2억 cap 80만원');
assert.equal(fee('house','sale',4000).maximum,240000,'5천만 미만 0.6%');
assert.equal(fee('house','lease',60000).maximum,2400000,'6억부터 임대차 0.4%');
assert.equal(fee('house','lease',9900).maximum,300000,'임대차 한도 30만원');
assert.equal(fee('house','rent',1000,30).baseWan,3100,'월세환산액 5천만 미만이면 70배');
assert.equal(fee('house','rent',1000,30).maximum,155000);
assert.equal(fee('office','sale',140000).maximum,7000000,'요건충족 오피스텔 0.5%');
assert.equal(fee('office','lease',80000).maximum,3200000,'요건충족 오피스텔 임대차 0.4%');
assert.equal(fee('other','sale',140000).maximum,12600000,'기타 0.9%');
assert.equal(fn.commission({kind:'house',deal:'sale',amountWan:140000,vat:true}).total,9240000);
for(const bad of [0,-1,'1e6','','abc'])assert.throws(()=>fee('house','sale',bad));
assert.throws(()=>fee('house','rent',1000,''),'No fake monthly zero');
assert.throws(()=>fee('guess','sale',10000));
const conv=fn.conversion({oldWan:10000,newWan:5000,ratePct:4});
assert.equal(conv.direction,'increase');
approx(conv.monthlyWon,5000*10000*.04/12,1e-6);
assert.equal(fn.conversion({oldWan:5000,newWan:10000,ratePct:4}).direction,'decrease');
assert.equal(fn.conversion({oldWan:5000,newWan:5000,ratePct:4}).monthlyWon,0);
assert.throws(()=>fn.conversion({oldWan:10000,newWan:5000,ratePct:''}),'No guessed statutory rate');
const loan=(amountWan,ratePct,monthsCount,method)=>fn.loan({amountWan,ratePct,monthsCount,method});
assert.equal(loan(1200,0,12,'equal').first,1000000);
assert.equal(loan(1200,0,12,'equal').totalInterest,0);
const amort=loan(30000,4.5,360,'equal');
assert(amort.first>1500000&&amort.first<1600000,'30년 원리금균등 정상 범위');
assert(amort.totalInterest>0&&Math.abs(amort.first-amort.last)<1e-5);
const principal=loan(30000,4.5,360,'principal');
assert(principal.first>principal.last);
const bullet=loan(30000,4.5,360,'bullet');
assert.equal(bullet.first,300000000*.045/12);
assert.equal(bullet.totalInterest,300000000*.045/12*360);
assert.throws(()=>loan(30000,4.5,0,'equal'));
assert.throws(()=>loan(30000,4.5,601,'equal'));
assert.throws(()=>loan(30000,4.5,360,'unrecognized'));
const ids=['fhc_modes','fhc_detail','fhc_detailTitle','fhc_feePane','fhc_conversionPane',
 'fhc_loanPane','fhc_taxPane','fhc_taxIntro','fhc_taxExternal','fhc_taxOfficial',
 'fhc_feeDeal','fhc_feeKind','fhc_feeAmount','fhc_feeRent','fhc_feeAmountLabel','fhc_feeRentWrap','fhc_officeNote',
 'fhc_feeVat','fhc_feePrimary','fhc_feeDetail','fhc_feeCaption','fhc_oldDeposit','fhc_newDeposit',
 'fhc_conversionRate','fhc_conversionPrimary','fhc_conversionDetail','fhc_loanAmount','fhc_loanRate',
 'fhc_loanMonths','fhc_loanMethod','fhc_loanPrimary','fhc_loanDetail','fhc_loanCaption',
 'fhc_quickOpen','ct_price','fhc_taxStatus','fhc_taxResult','fhc_taxRows','fhc_taxSubmit',
 'fhc_acquisitionInputs','fhc_transferInputs','fhc_acqAmount','fhc_acqOwn','fhc_acqArea','fhc_acqRegion',
 'fhc_acqMetro','fhc_acqFirst','fhc_trBuyAmt','fhc_trSellAmt','fhc_trBuyDate','fhc_trSellDate',
 'fhc_trOwn','fhc_trRegion','fhc_trLiveYears','fhc_trCost'];
for(const id of ids)element(id);
element('fhc_feeDeal').value='sale';element('fhc_feeKind').value='house';
element('fhc_feeAmount').value='140000';
assert(calc.select('fee'));
assert.equal(element('fhc_feePane').hidden,false);
assert.equal(element('fhc_taxPane').hidden,true,'Never show remote tax links on local forms');
assert.match(element('fhc_feePrimary').textContent,/8,400,000원/);
element('fhc_feeDeal').value='rent';element('fhc_feeAmount').value='1000';element('fhc_feeRent').value='30';calc.update();
assert.equal(element('fhc_feeRentWrap').hidden,false);
assert.match(element('fhc_feeDetail').textContent,/3,100만원/);
element('ct_price').value='140000';assert(calc.useContractAmount());
assert.equal(element('fhc_feeAmount').value,'140000');
calc.select('acquisition');
element('fhc_acqAmount').value='140000';
element('fhc_acqOwn').value='one';
element('fhc_acqArea').value='85';
element('fhc_acqRegion').value='N';
element('fhc_acqMetro').value='Y';
element('fhc_acqFirst').value='N';
const acquisitionPayload=fn.taxRequest();
assert.equal(acquisitionPayload.amount,1400000000);
assert.equal(acquisitionPayload.metro,'Y');
element('fhc_acqOwn').value='';
assert.throws(()=>fn.taxRequest(),'Unselected ownership must block calculation');
element('fhc_acqOwn').value='one';
assert.equal(calc.calculateTax(),false,'Native transport absence must not fake a tax result');

assert.equal(element('fhc_taxPane').hidden,false);
assert.equal(element('fhc_feePane').hidden,true);
assert.match(element('fhc_taxExternal').href,/\/acquisition$/);
assert.match(element('fhc_taxOfficial').href,/wetax/);
calc.select('transfer');
element('fhc_trBuyAmt').value='70000';
element('fhc_trSellAmt').value='95000';
element('fhc_trBuyDate').value='2020-01-15';
element('fhc_trSellDate').value='2026-06-28';
element('fhc_trOwn').value='one';
element('fhc_trRegion').value='N';
element('fhc_trLiveYears').value='2';
element('fhc_trCost').value='1000';
const transferPayload=fn.taxRequest();
assert.equal(transferPayload.buyAmt,700000000);
assert.equal(transferPayload.sellAmt,950000000);
assert.equal(transferPayload.buyDate,'20200115');
assert.equal(transferPayload.cost,10000000);
element('fhc_trBuyDate').value='2025-02-29';
assert.throws(()=>fn.taxRequest(),'Impossible date must not be sent to tax provider');
element('fhc_trBuyDate').value='2020-01-15';

assert.match(element('fhc_taxExternal').href,/\/transfer$/);
assert.match(element('fhc_taxOfficial').href,/hometax/);

const requests=[];
win.FirstHyundaiNative={calculateRealtyTax(id,json){requests.push({id,data:JSON.parse(json)})}};
assert.equal(calc.calculateTax(),true,'Validated values should invoke native API');
assert.equal(requests.length,1);
assert.equal(requests[0].data.kind,'transfer');
assert.equal(element('fhc_taxSubmit').disabled,true);
fn.receiveTax({requestId:'tax-invalid',ok:true,payload:{ok:true,kind:'transfer',rows:[{label:'잘못된 응답',value:'5원'}]}});
assert.equal(element('fhc_taxResult').hidden,true,'Wrong request ID must be ignored');
fn.receiveTax({requestId:requests[0].id,ok:true,payload:{ok:true,kind:'transfer',rows:[{label:'예상 세액',value:'1,000,000',detail:'참고'}]}});
assert.equal(element('fhc_taxResult').hidden,false);
assert.equal(element('fhc_taxRows').children.length,1);
assert.equal(element('fhc_taxSubmit').disabled,false);
element('fhc_trBuyAmt').value='85000';calc.invalidateTax();
assert.equal(element('fhc_taxResult').hidden,true,'Editing conditions removes old estimate');
calc.home();assert.equal(element('fhc_detail').hidden,true);
assert.equal(element('fhc_modes').hidden,false);
calc.onOpen();assert.equal(element('fhc_quickOpen').attributes['aria-current'],'page');
calc.onPageChange('news');assert.equal(element('fhc_quickOpen').attributes['aria-current'],'false');
const html=read('app/src/main/assets/index.html');
const page=html.split('<div id="calculators"')[1]?.split('<div id="contracts"')[0]||'';
assert(page.length>1000,'Calculator page must be in main app');
assert(/id="fhc_quickOpen"/.test(html),'Always accessible without changing six main tabs');
for(const id of ids.filter(x=>x!=='ct_price'))assert(html.includes('id="'+id+'"'),'Missing UI id: '+id);
assert(!page.includes('<iframe')&&!page.includes('addJavascriptInterface'),
 'Never iframe untrusted calculator domains inside privileged Android WebView');
assert(page.includes('https://www.incheon.go.kr/build/BU050301/2106584'));
assert(html.includes('src="realty-calculators.js"')&&html.includes('href="realty-calculators.css"'));
assert(html.includes("FirstHyundaiCalculators?.onPageChange?.(id)"));
const source=read('app/src/main/assets/realty-calculators.js');
assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|api_key|Authorization)\b/.test(source),
 'Do not leak contracts or API secrets over network or store calculations');
console.log('PASS calculator formulas, input guards, VAT, screen switching, API safety, navigation and contract-price copy');
