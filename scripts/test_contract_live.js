'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const elements=new Map(),events={};
function element(tag='div'){
 const classes=new Set();
 return {tag,id:'',value:'',checked:false,disabled:false,hidden:false,open:false,textContent:'',children:[],
  classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)},
  append(...xs){for(const x of xs){this.children.push(x);if(x.id)elements.set(x.id,x);}},replaceChildren(){this.children=[];},
  showModal(){this.open=true;},close(){this.open=false;},focus(){},scrollIntoView(){},closest(){return null;},
  addEventListener(k,f){this['on'+k]=f;},setAttribute(){}};
}
function el(id){if(!elements.has(id)){const e=element();e.id=id;elements.set(id,e);}return elements.get(id);}
const requests=[],alerts=[];let stopped=0,confirmed=true;
const win={confirm:()=>confirmed,FirstHyundaiNative:{startContractLiveVoice(...args){requests.push(args);},stopContractLiveVoice(){stopped++;}},FirstHyundaiLive:{stop(){}},firstHyundaiGoBack:()=>false};
const c=vm.createContext({window:win,document:{getElementById:el,createElement:element,addEventListener:(k,f)=>events[k]=f},
 confirm:()=>confirmed,alert:x=>alerts.push(x),catalogRows:()=>[],console,Date,Number,String,navigator:{}});
for(const name of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-easy.js','contract-live.js'])
 vm.runInContext(read('app/src/main/assets/'+name),c);
const live=win.FirstHyundaiContractLive;
assert.equal(requests.length,0);
for(const k of ['rough','specialMemo','bank','account','accountHolder','owner','buyer','unit','property','address'])el('ct_'+k).value='SYNTHETIC_PRIVATE_'+k;
el('ct_terms').value='기존 특약 보존.';el('ct_price').value='80000';el('ct_contractDeposit').value='8000';
live.open();assert(el('cl_dialog').open);live.start();assert.equal(requests.length,0,'Consent required');
el('cl_consent').checked=true;live.start();
assert.equal(requests.length,1);assert.equal(requests[0].length,1);assert.match(requests[0][0],/^cl-[0-9-]+$/);
assert(!JSON.stringify(requests).includes('PRIVATE'),'No local data may leave through bridge');
let id=requests[0][0];
const emit=(state,message,requestId=id)=>win.onFirstHyundaiContractLiveStatus({requestId,state,message});
const proposal=p=>emit('proposal',JSON.stringify(p));
proposal({price:980000000,contractDeposit:65000000,interim:0,interimDate:'',balanceDate:'2027-04-18',terms:'잔금일까지 관리비를 정산한다.'});
assert.equal(el('ct_price').value,'80000','Tool call cannot mutate form');
assert.equal(live.apply(),false,'Cannot apply with microphone active');
proposal({account:'SYNTHETIC_PRIVATE'});assert(el('cl_status').textContent.includes('확인하지 못했습니다'));
proposal({price:990000000});
assert(el('cl_pick_price').checked);
live.stop();assert.equal(stopped,1);assert(el('cl_apply').disabled,'Wait for native mic-stop acknowledgement');
proposal({price:1000000000}); // Late call while stopping must be ignored.
emit('ended','ended');assert(!el('cl_apply').disabled);
el('cl_pick_contractDeposit').checked=false; // Explicitly excluded field must survive.
confirmed=false;assert.equal(live.apply(),false);assert.equal(el('ct_price').value,'80000');
confirmed=true;assert.equal(live.apply(),true);
assert.equal(el('ct_price').value,'99000');assert.equal(el('ct_contractDeposit').value,'8000');
assert.equal(el('ct_interim').value,'0');assert.equal(el('ct_balanceDate').value,'2027-04-18');
assert.equal(el('ct_terms').value,'기존 특약 보존.\n잔금일까지 관리비를 정산한다.');
for(const k of ['rough','specialMemo','bank','account','accountHolder','owner','buyer','unit','property','address'])
 assert.equal(el('ct_'+k).value,'SYNTHETIC_PRIVATE_'+k,'Preserve '+k);
assert(!el('cl_dialog').open);
emit('proposal',JSON.stringify({price:500000000}));assert.equal(el('ct_price').value,'99000','Late events ignored');
live.open();assert(!el('cl_consent').checked);el('cl_consent').checked=true;live.start();id=requests.at(-1)[0];
proposal({price:500000000});emit('error','무료 한도 확인');assert(el('cl_apply').disabled,'Errors must wait for microphone shutdown');emit('ended','generic');assert.equal(el('cl_status').textContent,'무료 한도 확인');
assert(!el('cl_apply').disabled,'Partial reviewed candidates survive connection failure');
live.close();live.open();el('cl_consent').checked=true;live.start();id=requests.at(-1)[0];
live.onPageChange('news');assert(!el('cl_dialog').open);assert.equal(stopped,2);
live.open();el('cl_consent').checked=true;live.start();assert.equal(win.firstHyundaiGoBack(),true);assert.equal(stopped,3);
live.open();el('cl_consent').checked=true;live.start();events.focusin({target:{id:'ct_account'}});assert.equal(stopped,4);
// Contradictory data must not enter the review list or overwrite valid proposals.
live.open();el('cl_consent').checked=true;live.start();id=requests.at(-1)[0];
proposal({price:900000000,contractDeposit:90000000,contractDate:'2027-01-10'});
const beforeConflict=el('cl_proposals').children.length;
proposal({contractDeposit:990000000});
assert.equal(el('cl_proposals').children.length,beforeConflict,'Conflicting deposit is rejected');
assert.match(el('cl_status').textContent,/거래금액보다 큽니다/);
proposal({balanceDate:'2027-01-09'});
assert.equal(el('cl_proposals').children.length,beforeConflict,'Reversed balance date rejected');
proposal({balanceDate:'2027-04-09',advance:50000000});
assert(el('cl_proposals').children.length>beforeConflict,'Valid correction accepted');
proposal({advance:100000000});
assert.match(el('cl_status').textContent,/계약금보다 큽니다/);
live.close();assert.equal(stopped,5);
const valid=live._test.normalize;
const consistent=live._test.consistency;
assert.equal(consistent({price:'90000'},{contractDeposit:'90001'}),'계약금이 거래금액보다 큽니다.');
assert.equal(consistent({price:'90000',contractDeposit:'9000'},{interim:'85001'}),'계약금과 중도금의 합계가 거래금액보다 큽니다.');
assert.equal(consistent({leaseStart:'2027-10-05'},{leaseEnd:'2027-10-04'}),'임대차 종료일이 입주일보다 빠릅니다.');
assert.equal(consistent({contractDate:'2027년 1월 협의'},{balanceDate:'2027-01-01'}),'','Unfixed dates do not imply a contradiction');
assert.equal(consistent({price:'90000'},{contractDeposit:'9000'}),'');
for(const p of [{price:'9억'},{price:-1},{price:1.2},{price:0},{price:1e13},{owner:'synthetic'},
 {terms:'<img src=x>'},{terms:'예금주 직접 확인'},{balanceDate:'2027-02-30'},{balanceDate:'내년 4월'},
 {dealType:'매각'},{leaseDuration:'연락처 문의'},{balanceTime:'25:00'}])assert.equal(valid(p),null);
assert.equal(valid({price:980000000}).price,'98000');
assert.equal(valid({contractDate:'2027년 4월 중 협의'}).contractDate,'2027년 4월 중 협의');
assert.equal(valid({balanceDate:'2028-02-29'}).balanceDate,'2028-02-29');
const html=read('app/src/main/assets/index.html');
assert(html.includes('FirstHyundaiEasy.compose()')&&html.includes('FirstHyundaiContracts.voice()'));
assert(!/<dialog id="cl_dialog"[^>]*\sopen/.test(html));
assert(html.includes('Live로 작성 · 선택')&&html.includes('FirstHyundaiContractLive?.onPageChange?.(id)'));
const source=read('app/src/main/assets/contract-live.js');
assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(source));
const native=read('app/src/main/java/kr/co/firsthyundai/app/PublicLiveVoice.java');
assert(native.includes('toolResponse')&&native.includes('functionResponses'));
assert(native.includes('inputAudioTranscription')&&native.includes('outputAudioTranscription'));
assert(native.includes('contractMode?"":safePublicBrief(publicNews)'));
console.log('Optional contract Live consent, local-data isolation, proposal validation, review, cancellation and legacy workflow tests passed.');
