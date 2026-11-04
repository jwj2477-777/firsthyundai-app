'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{
 id,value:'',hidden:true,disabled:false,checked:false,textContent:'',href:'',attributes:{},children:[],
 setAttribute(name,value){this.attributes[name]=value;},
 append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(){},
 scrollIntoView(){}
});return elements.get(id);}
const win={},doc={getElementById:element,createElement:()=>({textContent:'',className:'',children:[],append(...xs){this.children.push(...xs);}})};
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
for(const [wan,wanted] of [[4999,250000],[5000,250000],[19999,800000],[20000,800000],[89999,3599960],[90000,4500000],[119999,5999950],[120000,7200000],[149999,8999940],[150000,10500000]])
 assert.equal(fee('house','sale',wan).maximum,wanted,'Sale threshold '+wan);
for(const [wan,wanted] of [[4999,200000],[5000,200000],[9999,300000],[10000,300000],[59999,1799970],[60000,2400000],[119999,4799960],[120000,6000000],[149999,7499950],[150000,9000000]])
 assert.equal(fee('house','lease',wan).maximum,wanted,'Rental threshold '+wan);
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
const micro=loan(30000,'0.00000001',600,'equal');
assert(Number.isFinite(micro.first)&&micro.first>0,'Near-zero floating-point annuity must remain finite');
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
const localTax=(amount,areaType='85')=>fn.simpleAcquisitionTax({amount,areaType,own:'one',conArea:'N',firstOfLife:'N',metro:'Y'});
assert.equal(localTax(50000).totalWon,5500000,'5억 1주택 85㎡ 이하 = 550만원');
assert.equal(localTax(60000).totalWon,6600000);
assert.equal(localTax(70000).totalWon,12859000,'7억원 1.67% 중간세율 반올림');
assert.equal(localTax(100000,'big').totalWon,35000000,'10억 85㎡ 초과 농어촌특별세');
assert.equal(localTax(30000,'big').totalWon,3900000,'3억 85㎡ 초과 일반세율');
assert.equal(localTax(75000).totalWon,16500000,'7억5천 2%');
assert.equal(localTax(80000).totalWon,20504000,'8억 2.33%');
assert.equal(localTax(90000).totalWon,29700000,'9억 3%');
const acq=overrides=>fn.simpleAcquisitionTax({amount:50000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y',...overrides});
assert.equal(acq({own:'two',conArea:'N'}).totalWon,5500000,'비조정 2주택 일반세율');
assert.equal(acq({own:'two',conArea:'Y',tempTwo:'N'}).totalWon,42000000,'조정 2주택 8%+교육세');
assert.equal(acq({own:'two',conArea:'Y',tempTwo:'Y'}).totalWon,5500000,'확인된 일시적 2주택 일반세율');
assert.equal(acq({own:'two',conArea:'Y'}),null,'일시적2주택 판단 없이 중과 확정 금지');
assert.equal(acq({own:'three',conArea:'N'}).totalWon,42000000,'비조정 3주택 8%');
assert.equal(acq({own:'three',conArea:'Y'}).totalWon,62000000,'조정 3주택 12%');
assert.equal(acq({own:'more',conArea:'N'}).totalWon,62000000,'4주택 이상 12%');
assert.equal(acq({own:'two',conArea:'Y',tempTwo:'N',areaType:'big'}).totalWon,45000000,'중과8% 85㎡ 초과 농특세');
assert.equal(acq({own:'three',conArea:'Y',areaType:'big'}).totalWon,67000000,'중과12% 85㎡ 초과 농특세');
assert.equal(acq({metro:'N'}).totalWon,5500000,'85㎡ 이하 비수도권 일반세율');
assert.equal(acq({metro:'N',areaType:'big'}),null,'비수도권 읍면 100㎡ 면제 가능성을 임의계산 금지');
const transfer=v=>fn.simpleTransferTax({buyAmt:80000,sellAmt:150000,buyDate:'20180101',
 sellDate:'20261101',own:'one',conArea:'N',liveYear:6,exemptionVerified:'Y',cost:0,...v});
assert.equal(transfer({}).totalWon,9266400,'8억에 산 집 15억 양도·보유8년 거주6년');
assert.equal(transfer({sellAmt:120000}).totalWon,0,'12억원 이하 자격 확인된 1주택 비과세');
assert.equal(transfer({sellAmt:150000,cost:10000}).totalWon,6943200,'필요경비는 차익에서 공제');
assert.equal(transfer({exemptionVerified:'N'}),null,'비과세 요건 확인 없는 경우 임의계산 금지');
assert.equal(transfer({sellDate:'20270101'}),null,'2027년 이후 개편될 가능성 있는 법안 자동 적용 금지');
assert.equal(transfer({sellDate:'20230101',buyDate:'20220102'}),null,'보유2년 미달은 비과세 자동 계산 금지');
assert.equal(transfer({liveYear:1.5}),null,'거주 2년 미달 비과세 자동 계산 금지');
assert.equal(transfer({own:'two'}),null,'다주택 양도세 중과 임의 계산 금지');
assert.equal(fn.standardTaxByBase(14000000),840000);
assert.equal(fn.standardTaxByBase(50000000),6240000);
assert.equal(fn.standardTaxByBase(88000000),15360000);
assert.equal(fn.standardTaxByBase(1000000000),384060000);
assert.equal(fn.heldFullYears('20180102','20260101'),7);
assert.equal(fn.heldFullYears('20180101','20260101'),8);
for(const changed of [{firstOfLife:'Y'},{areaType:'big',metro:'N'},{own:'two',conArea:'Y'}]){
 const basic={amount:50000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'};
 assert.equal(fn.simpleAcquisitionTax({...basic,...changed}),null,'특례 여부 불확실한 조건의 임의계산 금지');
}
const ids=['fhc_modes','fhc_detail','fhc_detailTitle','fhc_feePane','fhc_conversionPane',
 'fhc_loanPane','fhc_taxPane','fhc_taxIntro','fhc_taxExternal','fhc_taxOfficial',
 'fhc_feeDeal','fhc_feeKind','fhc_feeAmount','fhc_feeRent','fhc_feeAmountLabel','fhc_feeRentWrap','fhc_officeNote',
 'fhc_feeVat','fhc_feePrimary','fhc_feeDetail','fhc_feeCaption','fhc_oldDeposit','fhc_newDeposit',
 'fhc_conversionRate','fhc_conversionPrimary','fhc_conversionDetail','fhc_loanAmount','fhc_loanRate',
 'fhc_loanMonths','fhc_loanMethod','fhc_loanPrimary','fhc_loanDetail','fhc_loanCaption',
 'fhc_quickOpen','ct_price'];
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
// Tax entry validates mandatory conditions; missing/unknown is never guessed.
let taxRequests=[];
win.FirstHyundaiNative={calculateRealtyTax:(body,id)=>taxRequests.push([JSON.parse(body),id])};
calc.select('acquisition');
assert.equal(element('fhc_taxPane').hidden,false);
assert.equal(element('fhc_feePane').hidden,true);
assert.match(element('fhc_taxExternal').href,/\/acquisition$/);
assert.match(element('fhc_taxOfficial').href,/wetax/);
assert.equal(calc.calculateTax(),false,'Missing conditions must block tax request');
element('fhc_taxAmount').value='140000';
element('fhc_taxArea').value='big';
element('fhc_taxOwn').value='two';
element('fhc_taxConArea').value='N';
element('fhc_taxFirstLife').value='N';
element('fhc_taxMetro').value='N';
assert.equal(calc.calculateTax(),true);
assert.equal(taxRequests.length,1);
assert.equal(taxRequests[0][0].values.amount,140000);
assert.equal(taxRequests[0][0].values.metro,'N');
assert.equal(element('fhc_taxCalculate').disabled,true);
const [request,requestId]=taxRequests[0];
win.onFirstHyundaiRealtyTaxResult({requestId:'tax-outdated',ok:true,data:{ok:true,rows:[{label:'오류',value:'0'}]}});
assert.equal(element('fhc_taxResult').hidden,true,'Ignore late/outdated tax response');
win.onFirstHyundaiRealtyTaxResult({requestId,ok:true,data:{ok:true,rows:[{label:'취득세',value:'42,000,000',note:'계산 예시'}],basis:'요율 참조'}});
assert.equal(element('fhc_taxResult').hidden,false);
assert.equal(element('fhc_taxRows').children.length,1);
assert.equal(element('fhc_taxCalculate').disabled,false);
// Field regression: straightforward 5억원 1주택 must calculate without external service.
calc.select('acquisition');
element('fhc_taxAmount').value='50000';element('fhc_taxOwn').value='one';
element('fhc_taxArea').value='85';element('fhc_taxMetro').value='Y';
assert.equal(calc.calculateTax(),true);
assert.equal(taxRequests.length,1,'Local basic tax must never call provider');
assert.equal(element('fhc_taxResult').hidden,false);
assert.equal(element('fhc_taxRows').children[0].children[1].textContent,'5,500,000원');
assert.match(element('fhc_taxBasis').textContent,/외부 API 전송 없음/);
assert.equal(element('fhc_taxFallback').hidden,true);

calc.select('transfer');
assert.match(element('fhc_taxExternal').href,/\/transfer$/);
assert.match(element('fhc_taxOfficial').href,/hometax/);
assert.equal(calc.calculateTax(),false,'No default capital gains data');
element('fhc_taxBuyAmt').value='70000';
element('fhc_taxSellAmt').value='95000';
element('fhc_taxBuyDate').value='2020-01-15';
element('fhc_taxSellDate').value='2026-06-28';
element('fhc_taxTransferOwn').value='one';
element('fhc_taxTransferConArea').value='N';
element('fhc_taxLiving').value='2';
assert.equal(calc.calculateTax(),true);
assert.equal(taxRequests[1][0].type,'transfer');
assert.equal(taxRequests[1][0].values.buyDate,'20200115');
assert.equal(taxRequests[1][0].values.liveYear,2);
win.onFirstHyundaiRealtyTaxResult({requestId:taxRequests[1][1],ok:false,
 errorCode:'provider_auth_error',httpStatus:503});
assert.equal(element('fhc_taxFallback').hidden,false,'Only reveal fallback on server error');
assert.equal(element('fhc_taxStatus').hidden,false,'Show short actionable explanation');
assert.match(element('fhc_taxStatus').textContent,/인증/);
assert.match(element('fhc_taxDiag').textContent,/provider_auth_error.*503/);


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
assert(page.includes('class="fhcTaxNotice adminExplain"'),'General mode must not repeat tax guidance');
assert(page.includes('id="fhc_taxFallback" class="fhcTaxFallback" hidden'),'Fallback stays hidden until error');
assert(page.includes('id="fhc_taxDiag" class="fhcTaxDiagnostic adminExplain"'),'Technical status admin-only');
assert(page.includes('class="fhcTaxField"'),'Group paired fields into compact cards');
assert(page.includes('<details class="fhcMore"><summary>계산 기준 · 공식 확인</summary>'));
assert(page.includes('외부 계산기: <a href="https://eznm.me/realestate">부동산계산기.com</a>'),
 'Attribution must stay visible for family users');
assert(page.includes('외부 계산 시에만 조건 전송'),'Disclose only external API transmission');
assert(page.includes('id="fhc_taxTempTwoField" hidden'),'Two-home transition condition is conditional');
assert(page.includes('id="fhc_taxTemporaryTwo"'),'Temporary-two condition is selectable');
assert(page.includes('id="fhc_taxExemptionField" hidden'),'One-home tax status is not silently presumed');
assert(page.includes('id="fhc_taxExemptionVerified"'),'Verified exemption required for safe local capital gains tax');
const styles=read('app/src/main/assets/realty-calculators.css');
assert(styles.includes('.fhcTaxInputs{display:grid;grid-template-columns:repeat(2'),
 'Use two-column compact fields on supported devices');
assert(styles.includes('.fhcAttribution a{font-size:15px;'), 'Official provider attribution must be readable at ≥0.9rem');
assert(styles.includes('.fhcTaxCalculate{margin-top:13px;min-height:56px'),'Keep primary action prominent');

const source=read('app/src/main/assets/realty-calculators.js');
assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|api_key|Authorization)\b/.test(source),
 'Do not leak contracts or API secrets over network or store calculations');
console.log('PASS calculator formulas, input guards, VAT, screen switching, API safety, navigation and contract-price copy');
