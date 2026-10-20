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
console.log('전월세 신규/갱신/미기재 표기 및 세 거래 화면 테스트 통과');
