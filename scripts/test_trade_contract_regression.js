// Guard the real-estate trade display decisions against UI rewrites.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..','app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cjs=fs.readFileSync(path.join(root,'contracts.js'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
new vm.Script(cjs);
const a=script.indexOf('function tradeClass(type)'),b=script.indexOf('function renderTypeButtons(',a);
assert(a>=0&&b>a,'Shared trade badge formatting helpers must be present');
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const ctx=vm.createContext({escapeHtml});
const moneyStart=script.indexOf('function number(n)'),moneyEnd=script.indexOf('function textState(',moneyStart);
assert(moneyStart>=0&&moneyEnd>moneyStart,'Real value10k helper is required');
vm.runInContext(script.slice(moneyStart,moneyEnd),ctx);
vm.runInContext(script.slice(a,b),ctx);
function badges(row){return vm.runInContext('tradeExtraBadges('+JSON.stringify(row)+')',ctx);}
function broker(row){return vm.runInContext('tradeBrokerLocation('+JSON.stringify(row)+')',ctx);}
function renewal(row){return vm.runInContext('tradeRenewalDetails('+JSON.stringify(row)+')',ctx);}
for(const type of ['전세','월세']){
 const filled=renewal({type,contract_type_raw:'갱신계약',renewal_raw:'사용',
  contract_term_raw:'2025.11~2027.11',previous_deposit_raw:'35,000',previous_monthly_raw:'0'});
 assert(filled.includes('갱신요구권 · 사용'),type+' renewal right');
 assert(filled.includes('계약기간 · 2025.11~2027.11'),type+' contract term');
 assert(filled.includes('종전 보증금 · 3억 5,000만원'),type+' previous deposit');
 assert(filled.includes('종전 월세 · 0만원'),type+' prior zero rent is not missing');
 const missing=renewal({type,contract_type_raw:'갱신'});
 assert.equal((missing.match(/미기재/g)||[]).length,4,'Unknown fields must be marked 미기재');
 const unused=renewal({type,contract_type_raw:'갱신',renewal_raw:'미사용',
  previous_deposit_raw:'8,000',previous_monthly_raw:'105',contract_term_raw:'2년'});
 assert(unused.includes('갱신요구권 · 미사용'));
 assert(unused.includes('종전 보증금 · 8,000만원'));
 assert(unused.includes('종전 월세 · 105만원'));
 assert.equal(renewal({type,contract_type_raw:'신규계약',renewal_raw:'사용'}),'',
  'New rental must not show the renewal information even if right is present');
 assert.equal(renewal({type,contract_type_raw:'',renewal_raw:'사용'}),'',
  'Right-use data alone does not prove renewal contract class');
 const escaped=renewal({type,contract_type_raw:'갱신',contract_term_raw:'<script>alert(1)</script>'});
 assert(escaped.includes('&lt;script&gt;'));
 assert(!escaped.includes('<script>'));
}
assert.equal(renewal({type:'매매',contract_type_raw:'갱신'}),'','Sales never have rent renewal details');
for(const type of ['전세','월세']){
 assert(badges({type,contract_type_raw:'갱신'}).includes('(갱신계약)'),type+' renewal');
 assert(badges({type,contract_type_raw:'갱신계약'}).includes('(갱신계약)'),type+' explicitly renewed');
 assert(badges({type,contract_type_raw:'신규'}).includes('(신규계약)'),type+' new');
 assert(badges({type,contract_type_raw:'신규계약'}).includes('(신규계약)'),type+' new signed');
 assert(badges({type,contract_type_raw:''}).includes('(계약구분 미기재)'),type+' unknown');
 assert(!badges({type,contract_type_raw:'',renewal_raw:'사용'}).includes('갱신계약'),'Request-right use alone is NOT the contract class');
 assert.equal(broker({type,dealing_type:'중개거래',broker_region_raw:'인천 연수구'}),'','Broker location must never be shown for a lease');
}
assert(badges({type:'매매',dealing_type:'중개거래'}).includes('중개거래'));
assert(badges({type:'매매',dealing_type:'직거래'}).includes('직거래'));
assert.equal(broker({type:'매매',dealing_type:'직거래',broker_region_raw:'인천 연수구'}),'');
assert.equal(broker({type:'매매',dealing_type:'중개거래',broker_region_raw:''}),'');
assert(broker({type:'매매',dealing_type:'중개거래',broker_region_raw:'인천 연수구'}).includes('중개사 소재지 · 인천 연수구'));
assert(broker({type:'매매',dealing_type:'중개거래',broker_region_raw:'<danger>'}).includes('&lt;danger&gt;'));
const views=[
 ['관심단지','function renderNearbyDetails(','function renderOverview(){'],
 ['전체 최신순','function renderTrades(){','function renderNews(){'],
 ['신규 공개 확인','function renderNew(){','updateRoleBar();switchPage(']
];
for(const [name,start,end] of views){
 const i=script.indexOf(start),j=script.indexOf(end,i+start.length);
 assert(i>=0&&j>i,name+' render section should exist');
 const section=script.slice(i,j);
 assert(section.includes('tradeExtraBadges(x)'),name+' must display new/renewed lease status');
 assert(section.includes('tradeBrokerLocation(x)'),name+' must show broker region on brokered sales');
 assert(section.includes('tradeRenewalDetails(x)'),name+' must show four renewal fields only on renewed leases');
 assert(!section.includes('출처: 국토교통부'),name+' must not repeat the source on every card');
 assert(!section.includes('조회 계약연월'),name+' must not repeat contract month on every card');
 assert(!section.includes("x.source_month"),name+' must not show source month redundantly');
 assert(section.includes('계약일')||section.includes('실제 계약일'),name+' must retain the deal date');
}
const elements=new Map();
function E(id){
 if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',checked:id==='ct_includeNotice',focus(){},select(){}});
 return elements.get(id);
}
const w={};
new Function('window','document','navigator','alert','confirm',cjs)(w,{getElementById:E},{},()=>{},()=>true);
const core=w.FirstHyundaiContracts;
const terms=core._test.previewSpecialTerms,def=core._test.DEFAULT_DETAIL_TERM;
assert.equal(terms('').length,1);
assert.equal(terms('임대인은 도배를 하기로 한다.').length,2);
assert.equal(terms(def).length,1,'Do not repeat an already specified standard clause');
assert.equal(terms('기타사항은 계약시 협의.').length,1,'Legacy wording is semantically equivalent');
assert.equal(terms('기타 상세한 특약사항은 본계약서 작성 시 협의하여 기재한다.').length,1);
const fields={dealType:'전세',property:'퍼스트파크 15블럭',address:'인천 연수구 테스트로 15',unit:'1501동 1203호',
 price:'39000',contractDeposit:'3900',advance:'500',balanceDate:'2026-12-30',leaseDuration:'2년',
 bank:'국민은행',account:'111-222-333333',accountHolder:'홍길동'};
for(const [key,value] of Object.entries(fields))E('ct_'+key).value=value;
core.makePreview();
let preview=E('ct_preview').value;
assert(preview.includes('▶ 특약사항'),'Special terms heading must appear even if not dictated');
assert(preview.includes('→ '+def),'Standard detailed-terms-at-signing clause must always appear');
assert.equal(preview.split(def).length-1,1);
E('ct_terms').value='임대인은 입주 전 도배를 마친다.';
core.makePreview();
preview=E('ct_preview').value;
assert(preview.includes('→ 임대인은 입주 전 도배를 마친다.'));
assert(preview.includes('→ '+def));
assert(preview.indexOf('→ 임대인은')<preview.indexOf('→ '+def));
console.log('Trade card regressions passed (3 views, 4 renewal-only fields) and default contract detailed-term clause confirmed.');
