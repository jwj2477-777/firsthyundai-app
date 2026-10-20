'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const helper=html.match(/function leaseContractBadge\(row\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(helper,'leaseContractBadge helper must exist');
const context=vm.createContext({});
vm.runInContext(helper,context);
const badge=context.leaseContractBadge;
function expect(type,value,label,css){
 const actual=badge({type,contract_type_raw:value});
 assert.match(actual,new RegExp(label));
 assert.match(actual,new RegExp(css));
}
expect('전세','신규','신규계약','contractNew');
expect('월세','갱신','갱신계약','contractRenew');
expect('전세',' 신규 계약 ','신규계약','contractNew');
expect('월세','갱신계약','갱신계약','contractRenew');
for(const unknown of ['',null,undefined,'-', '미상','사용','<img src=x onerror=alert(1)>']){
 const result=badge({type:'전세',contract_type_raw:unknown});
 assert.match(result,/계약구분 미기재/);
 assert.doesNotMatch(result,/img|onerror|alert/);
}
assert.equal(badge({type:'매매',contract_type_raw:'갱신'}),'');
assert.equal(badge(null),'');
assert.equal((html.match(/dealBadge\(x\.type\)\+leaseContractBadge\(x\)/g)||[]).length,3,
 'new contract badge must render in nearby, general trade, and new-trade screens');
const collector=fs.readFileSync(path.join(__dirname,'collect_trades.py'),'utf8');
assert.match(collector,/'contract_type_raw': get\(row, '계약구분', 'contractType'\)/);
const modeHelper=html.match(/function dealingModeBadge\(row\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(modeHelper,'dealingModeBadge helper must exist');
vm.runInContext(modeHelper,context);
const modeBadge=context.dealingModeBadge;
assert.match(modeBadge({type:'매매',dealing_type:'중개거래'}),/dealBrokerage.*중개거래/);
assert.match(modeBadge({type:'매매',dealing_type:'직거래'}),/dealDirect.*직거래/);
assert.match(modeBadge({type:'매매',dealing_type:' 중개 거래 '}),/중개거래/);
for(const unknown of ['',null,'-','<img src=x onerror=alert(1)>']){
 assert.equal(modeBadge({type:'매매',dealing_type:unknown}),'','unverified sale transaction mode must remain hidden');
}
assert.equal(modeBadge({type:'전세',dealing_type:'중개거래'}),'');
assert.equal(modeBadge({type:'월세',dealing_type:'직거래'}),'');
assert.equal(modeBadge(null),'');
assert.equal((html.match(/dealBadge\(x\.type\)\+leaseContractBadge\(x\)\+dealingModeBadge\(x\)/g)||[]).length,3,
 'mode badge must appear in nearby, main trades, and new trade cards');
assert.doesNotMatch(html,/조회 계약연월|출처: 국토교통부 아파트 실거래가 API/,
 'duplicated card source and queried year-month footer should be removed');
assert.match(collector,/'dealing_type': get\(row, '거래유형', 'dealingGbn'\)/);
const renewalHelper=html.match(/function leaseRenewalDetails\(row\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(renewalHelper,'lease renewal detail helper must exist');
const helpers=html.match(/function number\(n\)\{[^\n]+\}\nfunction value10k\(n\)\{[^\n]+\}/)?.[0];
const escapeSource=html.match(/const escapeHtml=v=>[^\n]+;/)?.[0];
assert.ok(helpers&&escapeSource,'Use same money and escaping logic as actual UI');
vm.runInContext(escapeSource+'\n'+helpers+'\n'+renewalHelper,context);
const renewalDetails=context.leaseRenewalDetails;
const renewal={
 type:'전세',contract_type_raw:'갱신',renewal_raw:'사용',
 contract_term_raw:'26.11~28.11',previous_deposit_raw:'39,000',previous_monthly_raw:'0'
};
const htmlRenewal=renewalDetails(renewal);
assert.match(htmlRenewal,/갱신요구권 사용/);
assert.match(htmlRenewal,/계약기간 26\.11 ~ 28\.11/);
assert.match(htmlRenewal,/종전금액 보증금 3억 9,000만원/);
assert.doesNotMatch(htmlRenewal,/월세 0원/,'zero old monthly rent omitted for jeonse');
const monthlyRenewal=renewalDetails({...renewal,type:'월세',renewal_raw:'미사용',
 previous_deposit_raw:'2,000',previous_monthly_raw:'90'});
assert.match(monthlyRenewal,/갱신요구권 미사용/);
assert.match(monthlyRenewal,/종전금액 보증금 2,000만원 \/ 월세 90만원/);
assert.match(renewalDetails({...renewal,previous_deposit_raw:'',previous_monthly_raw:'',renewal_raw:''}),
 /갱신요구권 미기재/);
assert.match(renewalDetails({...renewal,previous_deposit_raw:'',previous_monthly_raw:''}),
 /종전금액 미기재/);
for(const type of ['매매','전세','월세']){
 if(type==='매매'){
  assert.equal(renewalDetails({...renewal,type}), '');
 } else {
  assert.equal(renewalDetails({...renewal,type,contract_type_raw:'신규'}), '');
 }
}
const xss=renewalDetails({...renewal,renewal_raw:'<img src=x onerror=alert(1)>',
 contract_term_raw:'<svg onload=alert(1)>',previous_deposit_raw:'<12345>',previous_monthly_raw:''});
assert.doesNotMatch(xss,/img|svg|onerror|alert/);
assert.match(xss,/종전금액 미기재/);
assert.equal((html.match(/leaseRenewalDetails\(x\)/g)||[]).length,3,
 'render renewal details below main information in three trade screens');
assert.match(collector,/'previous_deposit_raw': get\(row, '종전계약보증금', 'preDeposit'\)/);
assert.match(collector,/'previous_monthly_raw': get\(row, '종전계약월세', 'preMonthlyRent'\)/);
console.log('전월세 갱신권·계약기간·종전금액 3개 화면 및 매매 중개/직거래 테스트 통과');
