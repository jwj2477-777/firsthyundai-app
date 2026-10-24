'use strict';
/* v2.0.49: admin edits shared local proposal template; family stays read-only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app/src/main/assets/contracts.js'),'utf8');
new vm.Script(js);
const contract=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
for(const id of ['ct_specialMemo','ct_missingQuickFields','ct_templateEditor','ct_tpl_intro','ct_tpl_effective',
 'ct_tpl_cancellation','ct_tpl_broker','ct_tpl_invitation','ct_togglePreviewEdit'])assert(contract.includes('id="'+id+'"'));
assert(!contract.includes('ct_clauseChoices'));
assert(!contract.includes('ct_clauseEffective'));
assert(contract.includes('class="btn alt contractPreviewToggle adminOnly"'));
assert(css.includes('body:not([data-office-role="admin"]) #contracts .adminOnly{display:none!important}'));
assert(css.includes('body:not([data-office-role="admin"]) #contracts #ct_preview.contractEditing{display:none!important}'));
let role='admin';const store=new Map(),elems=new Map(),messages=[];
const E=id=>{
 if(!elems.has(id)){
  const flags=new Set();
  elems.set(id,{id,value:'',textContent:'',innerHTML:'',checked:false,disabled:false,open:false,
   classList:{add:x=>flags.add(x),remove:x=>flags.delete(x),contains:x=>flags.has(x),toggle:(x,state)=>state?flags.add(x):flags.delete(x)},
   setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},closest(){return null}});
 }
 return elems.get(id);
};
const ctx=vm.createContext({window:{},document:{getElementById:E,body:{getAttribute:()=>role}},console,Date,Number,
 localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
 confirm:()=>true,alert:x=>messages.push(x),navigator:{}});
vm.runInContext(js,ctx);
const app=ctx.window.FirstHyundaiContracts;
const complete={dealType:'매매',property:'가상 퍼스트파크',address:'가상 주소 100',unit:'1502동 3004호',price:'150000',
 contractDeposit:'15000',advance:'500',contractDate:'2026-11-04',balanceDate:'2027-01-05',
 bank:'하나은행',account:'110-33345-04',accountHolder:'김진욱'};
for(const [id,value] of Object.entries(complete))E('ct_'+id).value=value;
app.onOpen();
assert(E('ct_tpl_intro').value.includes('퍼스트현대'));
E('ct_tpl_invitation').value='반드시 아래 제안내용을 검토하시고 동의할지 회신 바랍니다.';
assert.equal(app.saveTemplate(),true);
app.makePreview();
assert(E('ct_preview').value.includes('반드시 아래 제안내용을 검토하시고'));
assert.equal(app._test.collect().errors.length,0);
app.approve();assert.equal(E('ct_imagePrimary').disabled,false);
role='family';
assert.equal(app.saveTemplate(),false,'Family cannot alter proposal text');
app.onOpen();
app.makePreview();
assert(E('ct_preview').value.includes('반드시 아래 제안내용을 검토하시고'),'Admin settings persist into family mode on same device');
app.togglePreviewEdit();
assert(!E('ct_preview').classList.contains('contractEditing'),'Family cannot alter raw notice');
role='admin';
assert.equal(app.resetTemplate(),true);
app.makePreview();
assert(E('ct_preview').value.includes('아래 내용은 계약 진행을 위한 제안 조건입니다.'));
assert.equal(store.size,0,'Only template setting is stored, no private contract data');
console.log('v2.0.49 shared on-device template, admin permission and family read-only protection passed.');
