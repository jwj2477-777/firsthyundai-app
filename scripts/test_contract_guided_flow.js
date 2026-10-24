'use strict';
/* v2.0.48: parent-first 3-stage workflow and consent-sensitive legal text. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/ui-v2.css');
const section=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
const markers=['ct_flow1','ct_flow2','ct_flow3','ct_keyFacts','ct_factProperty','ct_factPrice','ct_factDeposit',
 'ct_factAdvance','ct_factAccount','ct_missingQuickFields','ct_specialMemo',
 'ct_templateEditor','ct_imagePrimary','ct_confirmButton','ct_previewHighlight'];
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
 '.contractSpecialMemoArea','.contractSharePrimary'])assert(finish.includes(x),'UI polish missing '+x);
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
 assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(src),'No customer details may be uploaded');
 vm.runInContext(src,ctx);
}
const app=ctx.window.FirstHyundaiContracts,easy=ctx.window.FirstHyundaiEasy;
E('ct_rough').value='퍼팍 13블럭 1304동 3703호 매매 10억 2000만원 계약금 1억200만원 금일 천만원 국민은행 1234567-01-987654 김철수 계약일 2023년 9월 14일 잔금일 2023년 12월 11일';
assert.equal(easy.compose(),true);
const notice=()=>E('ct_preview').value;
assert(notice().includes('금일 위 계약조건에 따라 계약금 중 일부인 1,000만원을 매도인 계좌(국민은행 1234567-01-987654 (예금주 김철수))로 송금하기로 합니다.'));
assert(notice().includes('※ 계약금 일부 송금 및 계약 성립·해제 조건 확인'));
assert(notice().includes('본계약이 체결된 것으로 보기로 하며'));
assert(notice().includes('실제 수령한 금액의 배액을 상환하고'));
assert(notice().includes('중개보수 지급의무가 없어지는 것은 아니라는 점'));
assert(!notice().includes('제안 1.')&&!notice().includes('제안드립니다'),'Keep restored office wording without proposal copy');
assert.equal(E('ct_factProperty').textContent,(E('ct_property').value+' '+E('ct_unit').value).trim()||'확인 필요','Summary must reflect the same locally recognized property fields as the notice');
assert.equal(E('ct_factAdvance').textContent,'1,000만원');
assert(E('ct_factAccount').textContent.includes('김철수'));
assert.equal(E('ct_imagePrimary').disabled,true,'No image sharing without human approval');
assert.equal(E('ct_flow2').attrs['aria-current'],'step','Second stage is verification');
assert.equal(app._test.collect().errors.length,0,'Fixture complete');
app.approve();
assert.equal(E('ct_imagePrimary').disabled,false,'Final image available only after explicit review');
assert.equal(E('ct_flow3').attrs['aria-current'],'step');
E('ct_specialMemo').value='근저당은 잔금과 동시에 말소한다\n반려동물 안돼';
easy.updateSpecials();
assert.equal(E('ct_terms').value,'근저당권은 잔금과 동시에 말소한다.\n반려동물은 허용하지 않는다.',
 'Dedicated notes become structured clauses even with no special label.');
assert(notice().includes('▶ 특약사항'),'Final proposal must contain a special-clause section.');
assert(notice().includes('→ 근저당권은 잔금과 동시에 말소한다.'));
assert(notice().includes('→ 반려동물은 허용하지 않는다.'));
assert.equal(E('ct_termOriginal').textContent,'근저당은 잔금과 동시에 말소한다\n반려동물 안돼');
assert.equal(E('ct_termPolished').textContent,E('ct_terms').value);
E('ct_polishTerms').checked=false;
easy.updateSpecials();
assert.equal(E('ct_terms').value,'근저당은 잔금과 동시에 말소한다\n반려동물 안돼',
 'User may inspect and use original wording');
E('ct_polishTerms').checked=true;
easy.updateSpecials();
assert.equal(E('ct_terms').value,'근저당권은 잔금과 동시에 말소한다.\n반려동물은 허용하지 않는다.',
 'Auto-formatting can be reenabled without losing special clauses');
assert.equal(E('ct_imagePrimary').disabled,true,'Modified special clauses require fresh review');
app.approve();assert.equal(E('ct_imagePrimary').disabled,false);
E('ct_rough').value='퍼팍 13블럭 전세 보증금 5억 오늘 오백만원';
E('ct_specialMemo').value='';
easy.compose();
assert(!notice().includes('근저당권은 잔금과 동시에 말소한다.'),'Previous special must not enter a new contract');
assert(E('ct_missingQuickFields').innerHTML.includes('contractInlineField'));
assert(E('ct_missingQuickFields').innerHTML.includes('contractQuickPickers'),'Select one missing item without expanding a full form');
assert(E('ct_missingQuickFields').innerHTML.includes('FirstHyundaiEasy.applyQuickField(&quot;'));
E('ct_property').value='';
app.makePreview();easy.refreshMissing();
assert(E('ct_missingQuickFields').innerHTML.includes('단지명'),'Missing property must offer a direct inline correction');
E('ct_property').value='퍼스트파크 13블럭';
app.makePreview();easy.refreshMissing();
assert.equal(easy.showQuickField('contractDate'),true);
E('ct_quick_contractDate').value='2026.11.02~11.06 협의';
assert.equal(easy.showQuickField('bank'),true);
assert.equal(easy.showQuickField('contractDate'),true);
assert(E('ct_missingQuickFields').innerHTML.includes('2026.11.02~11.06 협의'),'Switching corrections must retain unfinished text');
assert.equal(easy.applyQuickField('contractDate'),true);
assert.equal(E('ct_contractDate').value,'2026.11.02~11.06 협의');
assert.equal(E('ct_manualPanel').open,false,'Missing information is entered inline without opening full form');
assert.equal(easy.showQuickField('bank'),true);
E('ct_quick_bank').value='이전고객은행';
E('ct_rough').value='퍼팍 13블럭 매매 11억 잔금일 2027년 1월 1일';
assert.equal(easy.compose(),true);
assert(!E('ct_missingQuickFields').innerHTML.includes('이전고객은행'),'New client memo must clear unfinished payment drafts');
console.log('v2.0.52 guided contract verified: original notice footer, three stages, dedicated specials, inline corrections and image gate.');
