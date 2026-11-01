// Missing contract date blocks approval and appears in the original review notice.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('app/src/main/assets/contracts.js'),easy=read('app/src/main/assets/contracts-easy.js');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/ui-v2.css');
const nodes=new Map(),alerts=[];
function E(id){
 if(!nodes.has(id)){
  const flags=new Set();
  nodes.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:false,disabled:false,
   classList:{add:x=>flags.add(x),remove:x=>flags.delete(x),contains:x=>flags.has(x),toggle:(x,on)=>{if(on)flags.add(x);else flags.delete(x)}},
   setAttribute(){},focus(){this.focused=true},scrollIntoView(){},closest(){return null}});
 }
 return nodes.get(id);
}
const env=vm.createContext({window:{},document:{getElementById:E,body:{getAttribute:()=> 'family'}},Date,console,navigator:{},alert:x=>alerts.push(x),confirm:()=>true});
vm.runInContext(code,env);vm.runInContext(easy,env);
const app=env.window.FirstHyundaiContracts,workflow=env.window.FirstHyundaiEasy;
const fields={dealType:'매매',property:'가상아파트',address:'가상주소 30',unit:'1502동 3004호',
 price:'150000',contractDeposit:'15000',advance:'1000',balanceDate:'2027-01-05',
 bank:'테스트은행',account:'987-65432-10',accountHolder:'가상인'};
for(const [key,value] of Object.entries(fields))E('ct_'+key).value=value;
assert(app._test.collect().errors.includes('계약일'),'All deals require a signing schedule');
app.makePreview();workflow.refreshMissing();
assert(E('ct_missing').textContent.includes('계약일'));
assert(E('ct_preview').value.includes('▶ 계약일 : [계약일 확인 필요]'));
assert(app._test.previewContainsMissing(),'Incomplete signing date should be highlighted');
assert.equal(app.canShare(),false);
app.approve();assert.equal(app.canShare(),false);
workflow.openManual();assert(E('ct_contractDate').focused,'Fix missing date should focus its manual input');
for(const date of ['2026-10-22','10월중 협의']){
 E('ct_contractDate').value=date;app.makePreview();workflow.refreshMissing();
 assert(!app._test.collect().errors.includes('계약일'));
 const displayed=date==='2026-10-22'?'2026.10.22.':date;
 assert(E('ct_preview').value.includes('▶ 계약일 : '+displayed),'Expected signing date display: '+displayed);
 assert(!E('ct_missing').textContent.includes('확인할 정보'));
 app.approve();assert.equal(app.canShare(),true);
}
// Exact confirmed dates must not approve an impossible payment order.
E('ct_contractDate').value='2027-02-01';
assert(app._test.collect().errors.some(e=>e.includes('잔금일이 계약일보다 빠름')));
app.makePreview();app.approve();assert.equal(app.canShare(),false);
E('ct_contractDate').value='2026.11.02~11.06 중 상호 협의';
assert(!app._test.collect().errors.some(e=>e.includes('잔금일이 계약일보다 빠름')),
 'A negotiated contract date range must not be flattened into a fictitious exact day');
E('ct_interim').value='1000';E('ct_interimDate').value='2027-01-06';
assert(app._test.collect().errors.some(e=>e.includes('중도금 지급일이 잔금일보다 늦음')));
E('ct_interimDate').value='2027년 1월 4일';
assert(!app._test.collect().errors.some(e=>e.includes('중도금 지급일이 잔금일보다 늦음')));
E('ct_leaseStart').value='2027-02-01';E('ct_leaseEnd').value='2027-01-15';
assert(app._test.collect().errors.some(e=>e.includes('임대차 종료일이 시작일보다 빠름')));
E('ct_leaseStart').value='';E('ct_leaseEnd').value='';E('ct_interim').value='';E('ct_interimDate').value='';
E('ct_contractDate').value='';
app.updateSummary();workflow.refreshMissing();
assert.equal(app.canShare(),false,'Removing contract date revokes approval');
assert(E('ct_missing').textContent.includes('계약일'));
assert(html.includes('계약일 (필수)'));
assert(css.includes('border-left:9px solid #D43222'));
console.log('Mandatory contract signing date/warning/focus/approved share tests passed');
