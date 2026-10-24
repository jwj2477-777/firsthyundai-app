// v2.0.4: trade cards compact; contract button pending -> ready -> confirmed.
// No redundant cancellation or agreement checkboxes; final confirmation click is mandatory.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'ui-v2.css'),'utf8');
const cjs=fs.readFileSync(path.join(root,'contracts.js'),'utf8');
const htmlJs=html.split('<script>')[1].split('</script>')[0];
new vm.Script(htmlJs);new vm.Script(cjs);
for(const sel of [
 '.dealRow .tagbox','.dealRow .dealBadge.tradeMainBadge',
 '.dealRow .tradeInfoBadge','.dealRow .tradeContractKind',
 '.dealRow .tradeCancelledBadge',
 '#contracts #ct_resultPanel #ct_confirmButton[data-review-state="pending"]',
 '#contracts #ct_resultPanel #ct_confirmButton[data-review-state="ready"]',
 '#contracts #ct_resultPanel #ct_confirmButton[data-review-state="done"]'
])assert(css.includes(sel),'UI style absent: '+sel);
assert(html.includes('id="ct_confirmButton"'));
assert(html.includes('disabled onclick="FirstHyundaiContracts.approve()"'));
assert(html.includes('id="ct_confirmHelp"'));
assert(!html.includes('ct_includeNotice')&&!html.includes('ct_noticeConfirmed'),
 'Pre-negotiated agreement terms must not require redundant checkboxes');
const m=htmlJs.slice(htmlJs.indexOf('function tradeClass(type)'),htmlJs.indexOf('function renderTypeButtons('));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const trade=vm.createContext({escapeHtml:esc});
vm.runInContext(m,trade);
const card=row=>vm.runInContext(
  'dealBadge('+JSON.stringify(row.type)+')+tradeStatusBadge('+JSON.stringify(row)+')+tradeExtraBadges('+JSON.stringify(row)+')',trade);
for(const row of [
 {type:'매매',status:'신고',dealing_type:'직거래'},
 {type:'전세',status:'신고(임대차)',contract_type_raw:'신규계약'},
 {type:'월세',status:'신고',contract_type_raw:'갱신계약'}
]){
 const markup=card(row);
 assert.equal((markup.match(/class="/g)||[]).length,2,'Only type and meaningful contract/dealing kind badges');
 assert(markup.includes('tradeMainBadge')&&markup.includes('tradeInfoBadge'));
 assert(!markup.includes('tradeReportBadge'),'Ordinary report is redundant');
 assert(!markup.includes('(갱신계약)')&&!markup.includes('(신규계약)'));
 if(row.type==='매매')assert(markup.includes('직거래'));
 else assert(markup.includes(row.contract_type_raw));
}
assert.equal((card({type:'전세',status:'신고',contract_type_raw:''}).match(/class="/g)||[]).length,1,
 'Missing contract type + routine report should leave only the transaction type');
for(const fragment of ['tradeStatusBadge(x)+tradeExtraBadges(x)','dealBadge(x.type)']){
 assert(htmlJs.includes(fragment),'All card renderers must use shared badges: '+fragment);
}
const elements=new Map(),alerts=[];
function E(id){
 if(!elements.has(id)){
  const flags=new Set();
  elements.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:id==='ct_autoDeposit',
   disabled:false,attributes:{},
   classList:{add:k=>flags.add(k),remove:k=>flags.delete(k),contains:k=>flags.has(k),toggle:(k,on)=>on?flags.add(k):flags.delete(k)},
   setAttribute(k,v){this.attributes[k]=v},focus(){},select(){},closest(){return null},scrollIntoView(){}});
 }
 return elements.get(id);
}
const context=vm.createContext({window:{},document:{getElementById:E},Date,Number,String,
 console,alert:m=>alerts.push(m),confirm:()=>true,navigator:{}});
vm.runInContext(cjs,context);
const contract=context.window.FirstHyundaiContracts;
const button=E('ct_confirmButton'),hint=E('ct_confirmHelp');
const state=()=>button.attributes['data-review-state'];
contract.syncReviewButton();
assert.equal(state(),'pending');
assert.equal(button.disabled,true);
assert.equal(button.textContent,'내용 확인 필요');
assert.equal(button.attributes['aria-pressed'],'false');
const fields={dealType:'전세',property:'가상단지',address:'가상주소 1',unit:'101동 101호',
 price:'39000',contractDeposit:'3900',advance:'500',contractDate:'2026-10-22',balanceDate:'2027-01-05',
 leaseDuration:'2년',bank:'테스트은행',account:'111-222-333333',accountHolder:'홍길동'};
for(const [key,value] of Object.entries(fields))E('ct_'+key).value=value;
contract.makePreview();
assert.equal(contract._test.collect().errors.length,0);
assert.equal(state(),'ready','Complete contract does not require another checkbox');
assert.equal(button.textContent,'✓ 내용 확인 완료하기');
assert.equal(button.disabled,false);
assert(hint.textContent.includes('확인 버튼'));
const beforeApproval=E('ct_preview').value;
assert(beforeApproval.includes('금일 위 계약조건에 따라 계약금 중 일부인 500만원을 임대인 계좌(테스트은행 111-222-333333 (예금주 홍길동))로 송금하기로 합니다.'),'Original transfer sentence must include precise amount and account');
for(const fragment of ['※ 계약금 일부 송금 및 계약 성립·해제 조건 확인','본계약이 체결된 것으로 보기로 하며','실제 송금한 금액을 포기','중개보수 지급의무가 없어지는 것은 아니라는 점']){
 assert(beforeApproval.includes(fragment),'Original office contract notice must be preserved: '+fragment);
}
assert(!beforeApproval.includes('제안 1.')&&!beforeApproval.includes('제안드립니다'),'Do not reintroduce offer numbering');
assert.equal(contract.canShare(),false,'Review approval button is still mandatory');
contract.approve();
assert.equal(state(),'done','Confirmed state must change visibly after clicking');
assert.equal(button.textContent,'✓ 확인 완료됨');
assert.equal(button.attributes['aria-pressed'],'true');
assert.equal(contract.canShare(),true,'Confirmed draft can be shared');
assert(hint.textContent.includes('안내 이미지 확인·공유'),'Confirmation should lead directly to the image action');
E('ct_preview').value+=' [확인 필요]';contract.edited();
assert.equal(state(),'pending','Unverified edit invalidates the previous approval');
assert(button.disabled);
assert.equal(contract.canShare(),false);
E('ct_preview').value=E('ct_preview').value.replace(' [확인 필요]','');contract.edited();
assert.equal(state(),'ready','Edited verified text needs just final approval');
assert.equal(contract.canShare(),false,'Previous approval is still revoked after edits');
contract.approve();assert.equal(state(),'done');
E('ct_price').value='40000';contract.updateSummary();
assert.equal(state(),'pending','Changed contract terms invalidate the old notice');
assert.equal(button.disabled,true);
contract.makePreview();
assert.equal(state(),'ready','New correct draft can be confirmed without agreement checkboxes');
assert.equal(contract.canShare(),false,'Regenerated draft requires a fresh click');
contract.approve();assert.equal(state(),'done');
contract.reset();
assert.equal(state(),'pending','Reset must clear confirmation');
assert.equal(button.attributes['aria-pressed'],'false');
console.log('Contract confirmation, original office notice wording and sharing guards passed.');
