// Post-approval correction: dated field patch, revision safety, encrypted on-device restore.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../app/src/main/assets');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
assert(html.includes('id="ct_revisionPanel"')&&html.includes('id="ct_resumePanel"'));
assert(html.includes('contract-revision.js'));
const source=read('contract-revision.js');
new vm.Script(source);
assert(!/\b(?:fetch|XMLHttpRequest|localStorage\.setItem|sessionStorage\.setItem)\b/.test(source),
 'Private contract data must not be uploaded or persisted in Web Storage');
const javaPath=path.resolve(__dirname,'../app/src/main/java/kr/co/firsthyundai/app');
const native=fs.readFileSync(path.join(javaPath,'ContractRevisionStore.java'),'utf8');
const bridge=fs.readFileSync(path.join(javaPath,'MainActivity.java'),'utf8');
assert(native.includes('AES/GCM/NoPadding')&&native.includes('getNoBackupFilesDir()')&&native.includes('AtomicFile'));
assert(native.includes('member.getBytes')||native.includes('contract-approved-v1:'+ 'member'));
assert(bridge.includes('OfficeBoardClient.enrolled')&&bridge.includes('saveLastApprovedContract'));
const stored={value:'{}'};
let copyToNetwork=0;
function session(){
 const elem=new Map();
 function el(id){
  if(!elem.has(id)){
   const flags=new Set(['ct_resultPanel','ct_revisionPanel','ct_revisionEditor','ct_resumePanel','ct_previousNoticeWrap'].includes(id)?['hidden']:[]);
   const row={id,value:'',disabled:false,checked:id==='ct_autoDeposit',textContent:'',innerHTML:'',open:false,rows:2,
    classList:{add:k=>flags.add(k),remove:k=>flags.delete(k),toggle:(k,on)=>on?flags.add(k):flags.delete(k),contains:k=>flags.has(k)},
    setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k]||null;},
    removeAttribute(k){delete this[k];},scrollIntoView(){},focus(){},select(){},closest(){return null}};
   elem.set(id,row);
  }
  return elem.get(id);
 }
 let imageClosures=0;
 const nativeApi={
  saveLastApprovedContract(value){stored.value=value;return true;},
  getLastApprovedContract(){return stored.value;},
  clearLastApprovedContract(){stored.value='{}';}
 };
 const ctx=vm.createContext({
  window:{FirstHyundaiNative:nativeApi,FirstHyundaiContractImage:{close(){imageClosures++;}},
   FirstHyundaiSmart:{onOpen(){},needsPropertyConfirmation(){return false;},changed(){},reset(){}},
   FirstHyundaiLanguage:{_test:{moneyPart:t=>/^\d+억(?:원)?$/.test(t)?Number(t.match(/\d+/)[0])*10000:/^\d+$/.test(t)?Number(t):null}},
   FirstHyundaiEasy:{_test:{normalizeQuickField:(k,t)=>{
    let m=t.match(/^(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
    if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    return null;}}}},
  document:{getElementById:el,body:{getAttribute(){return 'family'}}},
  confirm(){return true;},alert(){},navigator:{},Date,console,Number,String,localStorage:{getItem(){return null},setItem(){throw Error('Should not use Web Storage')}}});
 vm.runInContext(read('contracts.js'),ctx);
 vm.runInContext(source,ctx);
 return {ctx,el,revision:ctx.window.FirstHyundaiContractRevision,core:ctx.window.FirstHyundaiContracts,getImageClosures:()=>imageClosures};
}
let a=session(),{el,core,revision}=a;
for(const [id,value] of Object.entries({
 dealType:'매매',property:'파크애비뉴',address:'인천 연수구 테스트로 10',unit:'1604동 2101호',
 price:'143000',contractDeposit:'20000',advance:'2000',interim:'10000',interimDate:'2027-01-31',
 interim2:'50000',interimDate2:'2027-06-30',contractDate:'2026-12-01',balanceDate:'2027-07-30',
 bank:'가상은행',account:'111-22-333333',accountHolder:'가상인',
 terms:'매도인은 중도금을 현재 세입자 퇴거를 위한 용도로만 사용한다.',
 rough:'파크애비뉴 매매 14억3천만원 계약금 2억 1차 중도금 1억 2차 중도금 5억'}))el('ct_'+id).value=value;
assert.equal(core._test.collect().errors.length,0,JSON.stringify(core._test.collect().errors));
core.makePreview();
const first=el('ct_preview').value;
assert(first.includes('▶ 잔금일 : 2027.07.30.'));
assert(first.includes('▶ 잔금 : 63,000만원'));
core.approve();
assert.equal(JSON.parse(stored.value).revision,1,'First approval encrypted via native bridge');
assert.equal(JSON.parse(stored.value).fields.bank,'가상은행');
assert(!el('ct_imagePrimary').disabled,'Approval allows image sharing');
core.onOpen(); // reopening the same tab is NOT a contract modification.
assert(!el('ct_imagePrimary').disabled,'Re-entering contract page cannot revoke approval');
assert(revision.start(),'One-tap edit on approved notice');
assert(el('ct_imagePrimary').disabled,'Old image must not be re-shared');
assert(el('ct_preview').value.startsWith('※ 계약 안내 수정본 (2차 확인)'));
el('ct_revisionField').value='balanceDate';
revision.select();
assert.equal(el('ct_revisionValue').value,'2027-07-30');
el('ct_revisionValue').value='2027.08.15';
assert(revision.apply(),'Patch the date without retyping the contract');
assert.equal(el('ct_balanceDate').value,'2027-08-15');
assert(el('ct_preview').value.includes('▶ 잔금일 : 2027.08.15.'));
assert(el('ct_preview').value.includes('매도인은 중도금을 현재 세입자 퇴거를 위한 용도로만 사용한다.'),
 'Other clauses must be preserved in notice');
assert(el('ct_preview').value.includes('▶ 잔금 : 63,000만원'));
assert(el('ct_imagePrimary').disabled,'Share remains disabled until confirming corrected notice');
assert.equal(JSON.parse(stored.value).revision,1,'Revising cannot overwrite the approved original prematurely');
core.approve();
assert.equal(JSON.parse(stored.value).revision,2,'Explicit reapproval saves the corrected snapshot');
assert(!el('ct_imagePrimary').disabled);
assert(a.getImageClosures()>=1,'Old image canvas is invalidated');

a=session();({el,core,revision}=a);
revision.onOpen();
assert(!el('ct_resumePanel').classList.contains('hidden'),'Encrypted recent-notice recovery exposed');
assert(revision.restore(),'Restore approved contract from native storage');
assert.equal(el('ct_balanceDate').value,'2027-08-15');
assert.equal(el('ct_account').value,'111-22-333333','No account details re-entry needed');
assert(el('ct_preview').value.includes('※ 계약 안내 수정본 (3차 확인)'));
assert(el('ct_imagePrimary').disabled,'Restored copy is never automatically approved');
assert(el('ct_previousNotice').value.includes('▶ 잔금일 : 2027.08.15.'));
el('ct_revisionField').value='interimDate2';
revision.select();el('ct_revisionValue').value='2027.07.01';
assert(revision.apply());
assert.equal(el('ct_interimDate2').value,'2027-07-01');
assert(el('ct_preview').value.includes('▶ 2차 중도금 지급일 : 2027.07.01.'));
assert(el('ct_preview').value.includes('▶ 잔금일 : 2027.08.15.'));
assert(el('ct_imagePrimary').disabled);
el('ct_revisionField').value='interim2';
revision.select();el('ct_revisionValue').value='6억';
assert(revision.apply());
assert.equal(el('ct_interim2').value,'60000');
assert(el('ct_preview').value.includes('▶ 잔금 : 53,000만원'),'Money correction recalculates balance');
el('ct_revisionField').value='balanceDate';
revision.select();const before=el('ct_balanceDate').value;el('ct_revisionValue').value='2월 31일';
assert.equal(revision.apply(),false,'Invalid dates must be rejected');
assert.equal(el('ct_balanceDate').value,before);
assert.equal(JSON.parse(stored.value).revision,2,'An unfinished correction cannot replace latest confirmed notice');
core.reset();
assert(el('ct_preview').value==='','New contract clears volatile UI');
assert.equal(JSON.parse(stored.value).revision,2,'Reset keeps last approved encrypted copy for later restoration');
assert(revision.restore(),'Previous approved contract still recoverable');
revision.clearSaved();
assert.equal(stored.value,'{}','Explicit deletion clears private approved record');
assert(el('ct_resumePanel').classList.contains('hidden'));
assert.equal(copyToNetwork,0);
console.log('Post-approval revisions PASS: selected-date edit, field preservation, mandatory reapproval, source image invalidation, encrypted offline restore, money recalc and explicit delete.');
