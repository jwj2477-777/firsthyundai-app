// v2.0.3: trade cards must be scannable and contract confirmation must show
// pending -> ready -> confirmed -> pending after consent or text changes.
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
assert(html.includes('onchange="FirstHyundaiContracts.onConsentChange()"'));
const m=htmlJs.slice(htmlJs.indexOf('function tradeClass(type)'),htmlJs.indexOf('function renderTypeButtons('));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const trade=vm.createContext({escapeHtml:esc});
vm.runInContext(m,trade);
const card=row=>vm.runInContext(
  'dealBadge('+JSON.stringify(row.type)+')+tradeStatusBadge('+JSON.stringify(row)+')+tradeExtraBadges('+JSON.stringify(row)+')',trade);
for(const row of [
 {type:'매매',status:'신고',dealing_type:'직거래'},
 {type:'전세',status:'신고',contract_type_raw:'신규계약'},
 {type:'월세',status:'신고',contract_type_raw:'갱신계약'}
]){
 const markup=card(row);
 assert.equal((markup.match(/class="/g)||[]).length,3,'Exactly three compact badges');
 assert(markup.includes('tradeMainBadge')&&markup.includes('tradeInfoBadge'));
 assert(!markup.includes('(갱신계약)')&&!markup.includes('(신규계약)'));
 if(row.type==='매매')assert(markup.includes('직거래'));
 else assert(markup.includes('임대차 신고'));
}
assert.equal((card({type:'전세',status:'신고',contract_type_raw:''}).match(/class="/g)||[]).length,2,
 'Do not add redundant contract class if the official field is missing');
for(const fragment of ['tradeStatusBadge(x)+tradeExtraBadges(x)','dealBadge(x.type)']){
 assert(htmlJs.includes(fragment),'All card renderers must use shared badges: '+fragment);
}
const elements=new Map(),alerts=[];
function E(id){
 if(!elements.has(id)){
  const flags=new Set();
  elements.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:id==='ct_includeNotice'||id==='ct_autoDeposit',
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
const button=E('ct_confirmButton'),hint=E('ct_confirmHelp'),check=E('ct_noticeConfirmed');
const state=()=>button.attributes['data-review-state'];
contract.syncReviewButton();
assert.equal(state(),'pending');
assert.equal(button.disabled,true);
assert.equal(button.textContent,'내용 확인 필요');
assert.equal(button.attributes['aria-pressed'],'false');
const fields={dealType:'전세',property:'가상단지',address:'가상주소 1',unit:'101동 101호',
 price:'39000',contractDeposit:'3900',advance:'500',balanceDate:'2027-01-05',
 leaseDuration:'2년',bank:'테스트은행',account:'111-222-333333',accountHolder:'홍길동'};
for(const [key,value] of Object.entries(fields))E('ct_'+key).value=value;
contract.makePreview();
assert.equal(contract._test.collect().errors.length,0);
assert.equal(state(),'pending','Without checking the agreement it must still be pending');
assert(button.disabled);
assert(hint.textContent.includes('체크박스'));
check.checked=true;contract.onConsentChange();
assert.equal(state(),'ready');
assert.equal(button.textContent,'✓ 내용 확인 완료하기');
assert.equal(button.disabled,false);
contract.approve();
assert.equal(state(),'done','Confirmed state must change after clicking');
assert.equal(button.textContent,'✓ 확인 완료됨');
assert.equal(button.attributes['aria-pressed'],'true');
assert.equal(contract.canShare(),true,'Confirmed draft can be shared');
assert(hint.textContent.includes('공유'));
check.checked=false;contract.onConsentChange();
assert.equal(state(),'pending','Unchecking after approval revokes approval');
assert.equal(button.disabled,true);
assert.equal(contract.canShare(),false,'Unchecking blocks sharing');
check.checked=true;contract.onConsentChange();
assert.equal(state(),'ready','Rechecking requires a fresh confirmation click');
contract.approve();
assert.equal(state(),'done');
E('ct_preview').value+=' [확인 필요]';contract.edited();
assert.equal(state(),'pending','Manual text change invalidates approval');
assert(button.disabled,'Unverified placeholder cannot be confirmed');
E('ct_preview').value=E('ct_preview').value.replace(' [확인 필요]','');contract.edited();
assert.equal(state(),'ready','Corrected text is ready, but not approved');
contract.approve();assert.equal(state(),'done');
E('ct_price').value='40000';contract.updateSummary();
assert.equal(state(),'pending','Changed contract terms invalidate the old preview');
assert.equal(button.disabled,true);
contract.makePreview();
assert.equal(state(),'pending','Regeneration requires review again');
check.checked=true;contract.onConsentChange();
assert.equal(state(),'ready');
contract.reset();
assert.equal(state(),'pending','Reset must clear confirmation');
assert.equal(button.attributes['aria-pressed'],'false');
console.log('Three approval states, consent reversal, edited placeholders, term changes and compact trade tags passed.');
