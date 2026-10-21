/* Contract image preview must preserve user-edited clauses and check approval before sharing. */
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/contract-image.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/contracts.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const java=fs.readFileSync(path.join(__dirname,'../app/src/main/java/kr/co/firsthyundai/app/ContractImageShare.java'),'utf8');
const manifest=fs.readFileSync(path.join(__dirname,'../app/src/main/AndroidManifest.xml'),'utf8');
const ctx={
 font:'',measureText(s){return {width:Array.from(s).length*21}},
 fillRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},
 fill(){},stroke(){},fillText(){},set textAlign(x){},set fillStyle(x){},set strokeStyle(x){},set lineWidth(x){}
};
const nodes={ct_preview:{value:'안녕하세요. 퍼스트현대부동산입니다.\n\n● 아파트 전세계약 ●\n▶ 전세보증금 : 39,000만원\n▶ 특약사항\n→ 기타 상세한 특약사항은 본계약서 작성 시 협의하여 기재한다.\n※ 당사자 합의에 따른 안내\n실제 협의한 해제 조건을 확인해 주세요.'}};
let approved=false, alerts=[];
const env={document:{
 createElement(tag){
  if(tag==='canvas')return {width:0,height:0,getContext(){return ctx},setAttribute(){},toDataURL(){return 'data:image/png;base64,YWJj'}};
  return {className:'',textContent:'',append(){},appendChild(){},setAttribute(){}};
 },
 getElementById(id){return nodes[id]||null;}
},window:{FirstHyundaiContracts:{canShare(){return approved}},FirstHyundaiNative:{shareContractImages(x){env.sent=JSON.parse(x)}}},
 navigator:{},alert(s){alerts.push(s)},console};
vm.createContext(env);vm.runInContext(source,env);
const api=env.window.FirstHyundaiContractImage;
const clauses=[
 '기타 상세한 특약사항은 본계약서 작성 시 협의하여 기재한다.',
 '실제 협의한 해제 조건을 확인해 주세요.',
 '39,000만원'
];
assert(html.includes('FirstHyundaiContractImage.open()'));
assert(html.includes('contract-image.js'));
assert(html.includes('ct_imageDialog'));
assert(css.includes('.contractImageDialog'));
assert(java.includes('FLAG_GRANT_READ_URI_PERMISSION'));
assert(manifest.includes('androidx.core.content.FileProvider'));
const p=api._test.plan(nodes.ct_preview.value);
const rendered=p.flatMap(page=>page.items.map(x=>x.text)).join('');
for(const clause of clauses)assert(rendered.includes(clause), 'Clause omitted: '+clause);
assert.strictEqual(api._test.kindFor('▶ 잔금 : 35,000만원'),'row');
assert.strictEqual(api._test.kindFor('→ 기본 특약'),'term');
assert.strictEqual(api._test.kindFor('※ 실제 합의'),'notice');
assert(!source.includes('fetch('), 'Contract details must not be transmitted externally');
assert(!source.includes('localStorage'), 'Contract images must not be persisted in web storage');
api.open();assert.strictEqual(alerts.length,0,'Not approved: image preview must stay closed');
approved=true;
nodes.ct_imagePages={replaceChildren(){},appendChild(){}};
nodes.ct_imageStatus={textContent:''};
nodes.ct_imageDialog={showModal(){this.open=true},open:false,close(){this.open=false}};
api.open();assert(nodes.ct_imageDialog.open);
api.share();assert(env.sent&&env.sent.pages.length===p.length);
approved=false;const previous=env.sent;api.share();assert.strictEqual(env.sent,previous,'Unapproved image must not be shared');
const long='→ '+'긴 특약 문장 '.repeat(900);
const longPlan=api._test.plan('● 아파트 매매계약 ●\n'+long);
assert(longPlan.length>1,'Long terms must paginate rather than truncate');
console.log('Contract image checks passed:',p.length,'normal page(s),',longPlan.length,'long-text pages.');


const typical=[
 '안녕하세요. 퍼스트현대부동산입니다.',
 '● 아파트 매매계약 ●',
 '▶ 소재지 : 인천 연수구 가상로 30',
 '▶ 아파트명 : 퍼스트파크 15블럭 1502동 3004호',
 '▶ 매매대금 : 150,000만원',
 '▶ 계약금 : 15,000만원 (매매대금의 10%)',
 '▶ 중도금 지급일 : 2026-12-05',
 '▶ 중도금 : 50,000만원',
 '▶ 잔금일 : 2027.01.30.',
 '▶ 잔금 : 85,000만원',
 '▶ 특약사항',
 '→ 중도금 및 잔금일 앞당길 수 있다.',
 '→ 매도인은 부서진 곳을 수리해준다.',
 '→ 기타 상세한 특약사항은 본계약서 작성 시 협의하여 기재한다.',
 '※ 계약금 일부 송금 및 계약 성립·해제 조건 확인',
 '금일 위 계약조건에 따라 계약금 중 일부인 700만원을 매도인 계좌(하나은행 123-45678-01 (예금주 김가람))로 송금하기로 합니다.',
 '당사자들은 위 금액의 이체와 동시에 본계약이 체결된 것으로 보기로 하며, 일방의 변심으로 계약을 해제하는 경우 매도인은 실제 수령한 금액의 배액을 상환하고 매수인은 실제 송금한 금액을 포기하는 조건으로 합의합니다.',
 '또한 위 사유로 계약이 해제되더라도 그 사실만으로 중개보수 지급의무가 없어지는 것은 아니라는 점을 확인합니다.'
].join('\n');
const premium=api._test.plan(typical);
assert.strictEqual(premium.length,1,'Normal complete customer notice must be a single image');
assert(premium[0].bottom<3100,'No content should be clipped under footer');
assert(premium[0].heading.includes('매매계약 안내'));
const semantic=premium.flatMap(page=>page.items.map(item=>item.text)).join('');
for(const text of ['150,000만원','50,000만원','85,000만원','김가람','부서진 곳을 수리해준다.','실제 송금한 금액을 포기'])assert(semantic.includes(text),'Premium sheet lost content: '+text);
assert.strictEqual(api._test.clean('▶ 잔금 : 85,000만원','row'),'잔금 : 85,000만원');
assert.strictEqual(api._test.clean('→ 수리해준다.','term'),'수리해준다.');
nodes.ct_preview.value=typical;
api.open();assert(nodes.ct_imageDialog.open,'Premium sheet preview opens');
api.share();assert(env.sent&&env.sent.pages.length===1,'Only one PNG must be handed to native share for an ordinary contract');
console.log('Premium single-sheet layout and legal text preservation passed.');
