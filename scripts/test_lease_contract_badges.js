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
console.log('전월세 계약구분·매매 중개/직거래 배지 및 불필요한 카드 출처 삭제 테스트 통과');
