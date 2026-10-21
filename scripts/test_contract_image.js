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
const long='→ '+'긴 특약 문장 '.repeat(380);
const longPlan=api._test.plan('● 아파트 매매계약 ●\n'+long);
assert(longPlan.length>1,'Long terms must paginate rather than truncate');
console.log('Contract image checks passed:',p.length,'normal page(s),',longPlan.length,'long-text pages.');
