'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chromium required');
async function verify(){
 try{
  await document.fonts.ready;fetchRemote=async()=>null;switchPage('contracts');
  const check=(v,m)=>{if(!v)throw Error(m)},get=id=>document.getElementById(id);
  const live=window.FirstHyundaiContractLive,dialog=get('cl_dialog');
  check(!dialog.open,'Live must be closed by default');
  check(get('ct_rough')&&get('ct_specialMemo'),'Default memo inputs preserved');
  const privateKeys=['rough','specialMemo','bank','account','accountHolder','owner','buyer'];
  for(const k of privateKeys)get('ct_'+k).value='SYNTHETIC_LOCAL_'+k;
  get('ct_unit').value='SYNTHETIC_OLD_UNIT';
  get('ct_price').value='80000';get('ct_terms').value='기존 특약 보존.';
  window.confirm=()=>true;let id='',starts=0,stops=0;
  window.FirstHyundaiNative={startContractLiveVoice(...args){check(args.length===1&&/^cl-[0-9-]+$/.test(args[0]),'Only session ID sent');id=args[0];starts++;},
   stopContractLiveVoice(){stops++;window.onFirstHyundaiContractLiveStatus({requestId:id,state:'ended',message:'종료'});}};
  const emit=(state,message)=>window.onFirstHyundaiContractLiveStatus({requestId:id,state,message});
  get('ct_liveOpen').click();check(dialog.open,'Optional button opens dialog');
  get('cl_start').click();check(starts===0,'Consent not checked');
  get('cl_consent').checked=true;get('cl_start').click();check(starts===1,'Explicit start');
  emit('proposal',JSON.stringify({property:'파크애비뉴',unit:'1604동 2101호',price:980000000,contractDeposit:65000000,balanceDate:'2027-04-18',terms:'관리비는 잔금일까지 정산한다.'}));
  check(!!get('cl_pick_property')&&!!get('cl_pick_unit'),'Live review includes apartment and unit');
  check(get('ct_price').value==='80000','No automatic writes');
  check(get('cl_apply').disabled,'No apply with mic active');
  check(dialog.scrollWidth<=dialog.clientWidth+1,'Dialog horizontal overflow');
  for(const key of ['cl_start','cl_stop','cl_apply','cl_close'])check(get(key).getBoundingClientRect().height>=48,'Touch target '+key);
  get('cl_stop').click();check(stops===1&&!get('cl_apply').disabled,'Stop before review');
  get('cl_apply').click();check(!dialog.open,'Close after applying');
  check(get('ct_price').value==='98000','원 to 만원 conversion');
  check(get('ct_contractDeposit').value==='6500','Explicit deposit beats default');
  check(get('ct_balanceDate').value==='2027-04-18','Native date input accepts validated date');
  check(get('ct_property').value==='파크애비뉴','Spoken apartment flows into contract form');
  check(get('ct_unit').value==='1604동 2101호','Spoken dong-ho flows into contract form');
  for(const k of privateKeys)check(get('ct_'+k).value==='SYNTHETIC_LOCAL_'+k,'Local field preserved '+k);
  check(get('ct_terms').value.includes('기존 특약 보존.')&&get('ct_terms').value.includes('관리비는 잔금일까지 정산한다.'),'Keep and append terms');
  check(!get('ct_resultPanel').classList.contains('hidden'),'Existing preview flow');
  live.open();get('cl_consent').checked=true;live.start();check(firstHyundaiGoBack(),'Android Back handled');check(!dialog.open&&stops===2,'Back stops mic');
  live.open();get('cl_consent').checked=true;live.start();switchPage('news');check(!dialog.open&&stops===3,'Page change stops mic');
  document.body.innerHTML='<pre id="contract-live-test">PASS optional Live, consent, privacy, review, dates, existing fields, back and tab exit</pre>';
 }catch(e){document.body.innerHTML='<pre id="contract-live-test">FAIL '+e.message+'</pre>';}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-contract-live-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,393,600]){
  const result=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100','--virtual-time-budget=15000','--dump-dom','file://'+file],{encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr.slice(-900));
  const found=result.stdout.match(/<pre id="contract-live-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not finish');assert(found[1].startsWith('PASS'),width+'px '+found[1]);console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
