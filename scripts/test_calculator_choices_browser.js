'use strict';
/* v2.2.7 real-browser regression: calculator drop-downs became one-tap choice buttons.
   The hidden <select> stays the single value holder, so every existing rule still runs.
   Checks 320/360/412px: buttons for every small choice, ≥44px touch height, no overflow,
   tapping updates results, 일시적 2주택 reset clears its buttons, contextual helper text. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
async function verify(){
 const out=document.createElement('pre');out.id='calc-choice-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const tap=(id,value)=>{const b=document.querySelector('#'+id+' + .fhcChips button[data-value="'+value+'"]');check(b,id+' '+value+' button missing');b.click();};
  const type=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
  switchPage('calculators');await wait(60);
  FirstHyundaiCalculators.select('fee');await wait(40);
  const ids=['fhc_feeKind','fhc_feeDeal','fhc_feeVat','fhc_loanMethod','fhc_taxArea','fhc_taxOwn','fhc_taxTemporaryTwo','fhc_taxConArea',
   'fhc_taxFirstLife','fhc_taxFirstHomeType','fhc_taxMetro','fhc_taxTransferOwn','fhc_taxExemptionVerified','fhc_taxTransferConArea'];
  FirstHyundaiCalculators.select('acquisition');FirstHyundaiCalculators.select('transfer');FirstHyundaiCalculators.select('loan');
  for(const id of ids){
   const select=document.getElementById(id),group=select.nextElementSibling;
   check(group&&group.classList.contains('fhcChips'),id+': choice buttons missing');
   check(group.children.length===[...select.options].filter(o=>o.value).length,id+': one button per real option');
   check(select.getAttribute('aria-hidden')==='true','Hidden select is not read twice');
  }
  // Fee: 월세 shows the rent box; 4% shows its hint; result follows the taps.
  FirstHyundaiCalculators.select('fee');await wait(20);
  const pressed=id=>[...document.querySelector('#'+id+' + .fhcChips').children].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.value).join(',');
  check(pressed('fhc_feeDeal')==='sale'&&pressed('fhc_feeVat')==='0','Defaults are shown as pressed');
  check(document.getElementById('fhc_useContract').hidden,'No contract amount → no contract button');
  tap('fhc_feeDeal','rent');type('fhc_feeAmount','1000');type('fhc_feeRent','60');
  check(!document.getElementById('fhc_feeRentWrap').hidden,'월세 tap shows the rent box');
  check(document.getElementById('fhc_feeVatHint').hidden,'VAT hint hidden until 4%');
  tap('fhc_feeVat','4');
  check(!document.getElementById('fhc_feeVatHint').hidden,'4% shows its one-line reason');
  check(document.getElementById('fhc_feePrimary').textContent==='291,200원','월세 1,000/60 → 28만원 + 4% · '+document.getElementById('fhc_feePrimary').textContent);
  check(pressed('fhc_feeDeal')==='rent'&&pressed('fhc_feeVat')==='4','Pressed state follows taps');
  const chips=[...document.querySelectorAll('#fhc_feePane .fhcChip')];
  check(chips.every(b=>b.getBoundingClientRect().height>=44),'Choice buttons are at least 44px tall');
  document.getElementById('ct_price').value='85000';FirstHyundaiCalculators.update();
  const fromContract=document.getElementById('fhc_useContract');
  check(!fromContract.hidden&&fromContract.textContent.includes('8억 5,000만원'),'Contract amount offered only when it exists');
  document.getElementById('ct_price').value='';
  // 취득세: 2주택 + 조정 shows 일시적 2주택; changing 주택 수 clears that answer and its buttons.
  FirstHyundaiCalculators.select('acquisition');await wait(20);
  type('fhc_taxAmount','85000');tap('fhc_taxArea','85');tap('fhc_taxOwn','two');tap('fhc_taxConArea','Y');
  check(!document.getElementById('fhc_taxTempTwoField').hidden,'일시적 2주택 question appears');
  tap('fhc_taxTemporaryTwo','Y');tap('fhc_taxFirstLife','N');tap('fhc_taxMetro','Y');
  FirstHyundaiCalculators.calculateTax();
  check(document.querySelector('#fhc_taxRows .fhcTaxRow strong').textContent==='24,964,500원','Tapped answers give the same tax');
  tap('fhc_taxOwn','one');tap('fhc_taxOwn','two');
  check(document.getElementById('fhc_taxTemporaryTwo').value===''&&pressed('fhc_taxTemporaryTwo')==='','Old 일시적 2주택 answer is not reused');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS choice buttons, pressed state, fee/tax results, resets, contextual helpers, touch size';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-calc-choices-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360,412]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--user-data-dir='+path.join(tmp,'profile-'+width),'--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=15000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="calc-choice-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
