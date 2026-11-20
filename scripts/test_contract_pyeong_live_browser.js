'use strict';
/* v2.1.98 — 평형 함께 쓰기 + Live "다 말했어요".
   Real browser + real public catalog (data/complexes.json), fictional contract values only.
   · "35평 A타입" / "44평" in a memo → the ONE verified type; "35평" with A/B types → ask, never guess.
   · Contract text: "▶ 전용면적 : 84.9㎡ (약 35평형) · 117A타입 · 공급 …㎡".
   · Live: turn indicator + "다 말했어요" only while the user may speak; spoken areaType maps the same way. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chromium required');

// Static guards on the resolver itself.
const resolver=fs.readFileSync(path.join(assets,'contract-area-types.js'),'utf8');
assert(resolver.includes("status:'many'")&&resolver.includes('choicesText'),'Ambiguous pyeong must list choices');
assert(!/exclusive\s*=\s*[^=]*3\.305785/.test(resolver),'Never derive an exclusive area from pyeong');

async function verify(){
 const out=document.createElement('pre');out.id='pyeong-live-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  remote.complexes=window.__CATALOG__;
  const check=(v,m)=>{if(!v)throw Error(m)},get=id=>document.getElementById(id);
  const areas=window.FirstHyundaiAreaTypes;
  check(areas,'Resolver loaded');
  // Parser
  const p=s=>JSON.stringify(areas.parse(s));
  check(p('퍼팍 35평 A타입')==='{"pyeong":35,"letter":"A"}','35평 A타입');
  check(p('34평형 매매')==='{"pyeong":34,"letter":""}','34평형');
  check(p('117A타입')==='{"label":"117A"}','Explicit type label');
  check(areas.parse('평당 3천만원')===null&&areas.parse('30평대 찾는 손님')===null,'평당/평대 are not a type');
  check(p('35평 B동')==='{"pyeong":35,"letter":""}','"B동" is a building, not a type letter');
  // Memo → verified type (퍼스트파크 15블럭: 35평형 = 117A/117B, 44평형 = 144 only)
  const memo=text=>{
   window.confirm=()=>true;window.alert=()=>{};
   FirstHyundaiContracts.clearForNewMemo?.();
   for(const k of ['property','address','unit','exclusiveArea','supplyInfo','price'])if(get('ct_'+k))get('ct_'+k).value='';
   get('ct_rough').value=text;get('ct_specialMemo').value='';
   return FirstHyundaiLanguage.recognize(text);
  };
  let r=memo('퍼스트파크 15블럭 1502동 3004호 매매 13억 35평 A타입');
  check(get('ct_property').value==='퍼스트파크 15블럭','Complex resolved');
  check(get('ct_exclusiveArea').value==='84.9','35평 A → 117A 전용 84.9㎡, got '+get('ct_exclusiveArea').value);
  check(/^117A타입 · 공급 \d/.test(get('ct_supplyInfo').value),'Supply type written in the existing format');
  r=memo('퍼스트파크 15블럭 1502동 3004호 매매 13억 35평');
  check(get('ct_exclusiveArea').value==='','Two 35평형 types: do not pick one');
  check(r.review.some(x=>x.includes('117A')&&x.includes('117B')&&x.includes('2개')),'Ambiguity lists both choices');
  r=memo('퍼스트파크 15블럭 1502동 3004호 매매 15억 44평');
  check(get('ct_exclusiveArea').value==='108.08','Unique 44평형 is linked');
  r=memo('퍼스트파크 15블럭 1502동 3004호 매매 15억 77평');
  check(get('ct_exclusiveArea').value===''&&r.review.some(x=>x.includes('찾지 못했습니다')),'Unknown pyeong is reported, not invented');
  // Contract text shows 평형 beside the legal exclusive area.
  memo('퍼스트파크 15블럭 1502동 3004호 매매 13억 35평 A타입 계약금 1억3천 잔금 2027년 3월 2일');
  FirstHyundaiContracts.updateSummary();FirstHyundaiEasy.compose();
  const text=get('ct_preview').value;
  check(/▶ 전용면적 : 84\.9㎡ \(약 35평형\) · 117A타입 · 공급 /.test(text),'Contract line carries 평형: '+text.split('\n').find(x=>x.includes('전용면적')));
  // Live: turn indicator and "다 말했어요"
  let finishes=0,id='';
  window.FirstHyundaiNative={startContractLiveVoice(x){id=x;},stopContractLiveVoice(){window.onFirstHyundaiContractLiveStatus({requestId:id,state:'ended',message:'종료'});},
   finishContractLiveTurn(){finishes++;},requestLiveQuotaStatus(){}};
  const emit=(state,message)=>window.onFirstHyundaiContractLiveStatus({requestId:id,state,message});
  for(const k of ['property','address','unit','exclusiveArea','supplyInfo'])get('ct_'+k).value='';
  const live=FirstHyundaiContractLive,dialog=get('cl_dialog');
  live.open();check(get('cl_turnBox').hidden,'No turn box before starting');
  get('cl_consent').checked=true;live.start();
  check(!get('cl_turnBox').hidden&&get('cl_done').disabled,'Connecting: visible, button not yet usable');
  emit('listening','계약 조건을 말씀하세요.');
  check(!get('cl_done').disabled&&get('cl_turn').textContent.includes('듣고 있어요'),'User turn enables 다 말했어요');
  check(get('cl_done').getBoundingClientRect().height>=56,'Large finish button');
  get('cl_done').click();
  check(finishes===1&&get('cl_done').disabled&&get('cl_turn').textContent.includes('정리하는 중'),'Finish sends one signal and waits');
  emit('ai_speaking','AI가 질문 중입니다.');
  check(get('cl_done').disabled&&dialog.dataset.turn==='ai','Cannot finish while AI speaks');
  emit('proposal',JSON.stringify({property:'퍼스트파크 15블럭',unit:'1502동 3004호',areaType:'35평 A타입'}));
  check(get('cl_pick_areaType'),'Spoken 평형 shown as a review candidate');
  emit('listening','AI 질문이 끝났습니다. 이제 답변을 말씀해 주세요.');
  check(!get('cl_done').disabled,'User turn again');
  get('cl_stop').click();
  check(get('cl_turnBox').hidden||getComputedStyle(get('cl_turnBox')).display==='none','Turn box hidden at review');
  window.confirm=()=>true;get('cl_apply').click();
  check(get('ct_exclusiveArea').value==='84.9'&&get('ct_supplyInfo').value.startsWith('117A타입'),'Live 35평 A타입 → verified 117A');
  check(get('ct_selectedComplexContext').textContent.includes('117A'),'Visible note of what was linked');
  out.textContent='PASS verified pyeong linking, 평형 in contract text, Live finish-turn';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-pyeong-live-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 fs.writeFileSync(path.join(dir,'catalog-fixture.js'),'window.__CATALOG__='+JSON.stringify(catalog)+';');
 html=html.replace('</body>','<script src="catalog-fixture.js"></script><script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [360,600]){
  const result=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100','--virtual-time-budget=15000','--dump-dom','file://'+file],{encoding:'utf8',timeout:40000,maxBuffer:16*1024*1024});
  assert.equal(result.status,0,result.stderr.slice(-900));
  const found=result.stdout.match(/<pre id="pyeong-live-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not finish '+result.stdout.slice(-300));assert(found[1].startsWith('PASS'),width+'px '+found[1]);console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
