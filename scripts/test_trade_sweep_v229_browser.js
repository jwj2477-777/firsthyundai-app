'use strict';
/* v2.2.9 real-browser regression (fictional data only):
   - 새 거래 opens on the latest day that has records when today has none yet,
     the date list shows weekday and count, and a date the user picked is kept.
   - A failed month whose earlier data is still shown gets a calm pill, not the
     orange "최신성 주의" that is reserved for buckets with no data at all.
   - 실거래/오피스텔 상세 검색: every box stays inside the panel; the officetel
     date buttons are styled like the 실거래 ones.
   - 오늘 요약 small links are at least 44px tall. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
async function verify(){
 const out=document.createElement('pre');out.id='trade-sweep-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const day=n=>kstDateOffset(n);
  const row=(id,d,type)=>({id:'fictional-'+id,first_seen_date:d,first_seen_at:d+'T09:00:00+09:00',type,building:'가상단지'+id,
   district:'송도동',area_m2:84.9,floor:10,amount_10k:type==='매매'?90000:0,deposit_10k:type==='매매'?0:50000,monthly_10k:type==='월세'?100:0,
   contract_date:d,building_year:2015,status:'정상',source:'test',source_month:d.slice(0,7).replace('-','')});
  // 1) 새 거래: nothing seen today, two records two days ago.
  remote.new_trades={state:'ready',checked_at:day(0)+'T09:00:00+09:00',records:[row(1,day(2),'매매'),row(2,day(2),'전세'),row(3,day(5),'월세')]};
  newDateTouched=false;newAlertFocusIds=null;
  switchPage('new');await wait(40);renderNew();
  const select=document.getElementById('newDate');
  check(select.value===day(2),'Latest day with records is chosen when today has none: '+select.value);
  const picked=[...select.options].find(o=>o.value===day(2)).textContent;
  check(/\((?:일|월|화|수|목|금|토)\)/.test(picked)&&picked.includes('2건'),'Date option shows weekday and count: '+picked);
  check([...select.options].find(o=>o.value===day(0)).textContent.includes('없음'),'Empty day says 없음');
  check(document.getElementById('newMeta').textContent.includes('오늘 확인분이 아직 없어'),'Header explains why another day is shown');
  check(document.querySelectorAll('#newContent article').length===2,'The chosen day lists its two fictional trades');
  // The user deliberately picks today: keep it, even though it is empty.
  select.value=day(0);select.dispatchEvent(new Event('change'));await wait(20);
  check(select.value===day(0)&&newDateTouched,'A date the user picked is kept');
  check(!document.getElementById('newMeta').textContent.includes('오늘 확인분이 아직 없어'),'No auto-pick note after a manual choice');
  // 2) Partial collection wording.
  const calm=partialTradeNote({state:'partial',errors:['202605:매매: URLError'],missing_buckets:[]});
  check(calm.includes('26년 5월 매매')&&calm.includes('이전 자료로 표시')&&!calm.includes('orange'),'Failed month with old data stays calm: '+calm);
  check(partialTradeNote({state:'partial',errors:['202611:임대: x'],missing_buckets:['202611:임대']}).includes('orange'),'Missing bucket still warns');
  check(partialTradeNote({state:'ready'})==='','Ready data has no note');
  // 3) 상세 검색 panels stay inside their card.
  for(const page of ['trades','officetel']){
   switchPage(page);await wait(40);
   const panel=document.querySelector('#'+page+' details.tradeAdvanced');check(panel,page+' panel missing');
   panel.open=true;await wait(30);
   const edge=panel.getBoundingClientRect().right;
   for(const box of panel.querySelectorAll('input,select')){
    const r=box.getBoundingClientRect();if(!r.width)continue;
    check(r.right<=edge-8,page+' #'+box.id+' sticks out of 상세 검색 ('+Math.round(r.right)+' > '+Math.round(edge)+')');
   }
   for(const b of panel.querySelectorAll('.tradeDateActions button'))
    check(b.getBoundingClientRect().height>=40&&getComputedStyle(b).borderRadius!=='0px',page+' date buttons are styled touch buttons');
  }
  // 4) 오늘 요약 links are big enough for a thumb.
  switchPage('overview');await wait(40);
  for(const sel of ['.overviewMemoOpenCalendar','.overviewNewsMore']){
   const b=document.querySelector('#overview '+sel);if(!b||!b.getClientRects().length)continue;
   check(b.getBoundingClientRect().height>=44,sel+' is at least 44px tall');
  }
  check(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  out.textContent='PASS 새 거래 auto day + counts, manual day kept, partial wording, 상세 검색 fit, 44px links';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-trade-sweep-'));
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
  const found=r.stdout.match(/<pre id="trade-sweep-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
