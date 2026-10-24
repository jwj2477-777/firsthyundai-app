'use strict';
/* v2.0.48: parent-first 3-stage workflow and consent-sensitive legal text. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/ui-v2.css');
const section=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
const markers=['ct_flow1','ct_flow2','ct_flow3','ct_keyFacts','ct_factProperty','ct_factPrice','ct_factDeposit',
 'ct_factAdvance','ct_factAccount','ct_missingQuickFields','ct_clauseEffective',
 'ct_clauseCancellation','ct_clauseBrokerFee','ct_imagePrimary','ct_confirmButton','ct_previewHighlight'];
for(const id of markers)assert(section.includes('id="'+id+'"'),'Required review control lost: '+id);
assert(section.indexOf('ct_keyFacts')<section.indexOf('ct_previewHighlight'),'Summary must precede long preview');
assert(section.indexOf('ct_confirmButton')<section.indexOf('ct_imagePrimary'),'Final image action follows explicit confirmation');
assert(section.includes('id="ct_imagePrimary" type="button"')&&section.includes('disabled onclick="FirstHyundaiContractImage.open()"'),
 'Native image action must not be available before explicit approval');
assert(!section.includes('여기부터 시작'),'Unnecessary duplicated instruction removed');
const finish=css.slice(css.lastIndexOf('/* v2.0.48 — Guided contract preparation'));
assert(finish.includes('#contracts .contractMemoCard #ct_rough')&&finish.includes('height:202px'),
 'Memo starts compact instead of consuming the whole first screen');
for(const x of ['.contractFlowSteps','.contractMissingQuick','.contractCoreFacts','.contractPaymentFocus',
 '.contractClauseChoices','.contractSharePrimary'])assert(finish.includes(x),'UI polish missing '+x);
const nodes=new Map();
function E(id){
 if(!nodes.has(id)){
  const classes=new Set(['ct_resultPanel','ct_fixMissing','ct_missingQuickFields'].includes(id)?['hidden']:[]);
  nodes.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',checked:['ct_autoDeposit','ct_polishTerms'].includes(id),disabled:false,open:false,
   attrs:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,flag)=>{if(flag)classes.add(x);else classes.delete(x)}},
   setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
   scrollIntoView(){this.scrolled=true},focus(){this.focused=true},select(){},closest(){return null}});
 }
 return nodes.get(id);
}
const catalog=[{id:'f13',label:'퍼스트파크 13블럭',address:'인천 연수구 송도동 테스트100',aliases:['퍼팍 13블럭']}];
const notices=[];
const ctx=vm.createContext({window:{},document:{getElementById:E,body:{getAttribute:()=> 'family'}},catalogRows:()=>catalog,
 alert:x=>notices.push(x),confirm:()=>true,Date,Number,console,navigator:{}});
for(const file of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-easy.js']){
 const src=read('app/src/main/assets/'+file);new vm.Script(src);
 assert(!/\b(?:fetch|XMLHttpRequest|localStorage)\b/.test(src),'Customer details cannot be sent to a server');
 vm.runInContext(src,ctx);
}
const app=ctx.window.FirstHyundaiContracts,easy=ctx.window.FirstHyundaiEasy;
E('ct_rough').value='퍼팍 13블럭 1304동 3703호 매매 10억 2000만원 계약금 1억200만원 금일 천만원 국민은행 1234567-01-987654 김철수 계약일 2023년 9월 14일 잔금일 2023년 12월 11일';
assert.equal(easy.compose(),true);
const notice=()=>E('ct_preview').value;
assert(notice().includes('▶ 이번 송금 예정액 : 1,000만원'));
assert(notice().includes('▶ 입금 계좌 : 국민은행 1234567-01-987654'));
for(const phrase of ['이체와 동시에 본계약이 체결','배액을 상환','중개보수 지급의무']){
 assert(!notice().includes(phrase),'No unagreed legal clause: '+phrase);
}
assert(E('ct_factProperty').textContent.includes('퍼스트파크 13블럭'),'Verified local complex');
assert.equal(E('ct_factAdvance').textContent,'1,000만원');
assert(E('ct_factAccount').textContent.includes('김철수'));
assert.equal(E('ct_imagePrimary').disabled,true,'No image sharing without human approval');
assert.equal(E('ct_flow2').attrs['aria-current'],'step','Second stage is verification');
assert.equal(app._test.collect().errors.length,0,'Fixture complete');
app.approve();
assert.equal(E('ct_imagePrimary').disabled,false,'Final image available only after explicit review');
assert.equal(E('ct_flow3').attrs['aria-current'],'step');
E('ct_clauseEffective').checked=true;
easy.rebuildAfterClauses();
assert(notice().includes('이체와 동시에 본계약이 체결'));
assert(!notice().includes('배액을 상환'),'Other clauses remain explicitly off');
assert.equal(E('ct_imagePrimary').disabled,true,'Changing consent cancels approval');
E('ct_clauseCancellation').checked=true;E('ct_clauseBrokerFee').checked=true;
easy.rebuildAfterClauses();
assert(notice().includes('배액을 상환'));
assert(notice().includes('중개보수 지급의무'));
app.approve();
assert.equal(E('ct_imagePrimary').disabled,false);
E('ct_rough').value='퍼팍 13블럭 전세 보증금 5억 오늘 오백만원';
easy.compose();
assert.equal(E('ct_clauseEffective').checked,false);
assert.equal(E('ct_clauseCancellation').checked,false);
assert.equal(E('ct_clauseBrokerFee').checked,false);
assert(!notice().includes('이체와 동시에 본계약이 체결'),"Consent must not leak into another customer's deal");
assert(E('ct_missingQuickFields').innerHTML.includes('contractQuickFix'),'Incomplete memo offers a quick fix');
assert(E('ct_missingQuickFields').innerHTML.includes('FirstHyundaiEasy.focusMissing(&quot;'),'Quick fixes are safely quoted');
easy.focusMissing('contractDate');
assert(E('ct_manualPanel').open);
assert(E('ct_contractDate').focused);
console.log('v2.0.48 guided contract verified: three steps, local payment facts, no unagreed clauses, image lock and one-tap missing corrections.');
