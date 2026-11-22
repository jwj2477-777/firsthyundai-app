'use strict';
/* v2.2.12 real-browser regression: 아파트정보 > 평면도·원문 (fictional complex data only).
   - Types are listed in pyeong order as chips; choosing one shows its 전용/공급 figures
     and turns the big button into a Naver image search for THAT type.
   - Without verified types, trade-observed 전용 areas are offered instead.
   - Source links say which site they open (KB부동산, K-apt, 하이라이트...), never a
     generic "출처".
   - Office-saved links are shown first; the admin button appears for admins only.
   - The 평형·타입 tab links to the finder. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),child=require('node:child_process');
const assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
async function verify(){
 const out=document.createElement('pre');out.id='floorplan-test';
 try{
  await document.fonts.ready;fetchRemote=async()=>null;
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const base={households:100,heating:'지역난방',buildings:2,approved_date:'2017-11-17',floors:'20~30층',address:'인천광역시 연수구 가상로 1',
   aliases:[],area_types_m2:[84.9],last_verified:'2026-11-01',parking_total:120,builder:'가상건설',ev_chargers:2,management_phone:'',schools:[]};
  remote.complexes={schema_version:1,state:'ok',records:[
   {...base,id:'zz1',label:'가상파크 1블럭',source_url:'https://kbland.kr/se/c/1',detail_source_url:'https://www.k-apt.go.kr/x',
    supply_type_labels:['117A','99A','129B'],floorplans:[{label:'117A',url:'https://example.com/plan-117a'}],
    area_type_pairs:[{exclusive_m2:84.9,supply_m2:117.09,supply_label:'117A',market_pyeong:35},
     {exclusive_m2:68.72,supply_m2:99.09,supply_label:'99A'},{exclusive_m2:95.87,supply_m2:129.55,supply_label:'129B'}]},
   {...base,area_types_m2:[],id:'zz2',label:'가상뷰 2블럭',source_url:'https://apt.hilite.co.kr/apt/x',supply_type_labels:[],area_type_pairs:[],floorplans:[]}]};
  remote.trades={state:'ok',records:[{building:'가상뷰 2블럭',area_m2:59.98,type:'매매',contract_date:'2026-10-01',amount_10k:50000,deposit_10k:0,monthly_10k:0}]};
  catalogCache.rows=null;
  switchPage('complexes');await wait(60);
  selectComplex('zz1');setComplexDetailTab('types');await wait(60);
  const sheet=document.getElementById('complexSheet');
  check([...sheet.querySelectorAll('button')].some(b=>b.textContent.includes('타입별 평면도 사진 찾기')),'평형·타입 links to the finder');
  setComplexDetailTab('sources');await wait(60);
  const chips=()=>[...sheet.querySelectorAll('.complexPlanTypes button')];
  check(chips().map(b=>b.textContent).join('|')==='30평 · 99A|35평 · 117A|39평 · 129B','Chips in pyeong order: '+chips().map(b=>b.textContent).join('|'));
  const big=()=>sheet.querySelector('.complexPlanSearch');
  check(big().textContent.includes('이 단지 평면도 사진 찾기'),'Whole-complex search before a type is chosen');
  setComplexPlanType('117A');await wait(40);
  check(chips()[1].classList.contains('active')&&chips()[1].getAttribute('aria-pressed')==='true','Chosen chip is marked');
  check(sheet.textContent.includes('117A타입 · 전용 84.9㎡ · 공급 117.09㎡ · 약 35평'),'Chosen type figures shown');
  const href=decodeURIComponent(big().getAttribute('href'));
  check(href.startsWith('https://search.naver.com/search.naver?where=image&query=')&&href.endsWith('송도 가상파크 1블럭 117A 35평 평면도'),'Type image search: '+href);
  check(big().textContent.includes('35평 · 117A 평면도 사진 찾기'),'Button names the type');
  setComplexPlanType('117A');await wait(40);
  check(!sheet.querySelector('.complexPlanTypes button.active'),'Tapping again clears the choice');
  const links=[...sheet.querySelectorAll('.complexQuickLinks a')].map(a=>a.textContent.trim());
  check(links[0]==='117A ↗'&&sheet.querySelector('.complexPlanSaved'),'Office-saved plan first: '+links.join('|'));
  check(links.includes('단지 기본정보 · KB부동산 ↗')&&links.includes('상세 정보 · K-apt 공동주택관리정보 ↗'),'Sources named by site: '+links.join('|'));
  check(!sheet.querySelector('.complexPlanEdit'),'No admin button for family');
  selectComplex('zz2');setComplexDetailTab('sources');await wait(60);
  check(chips().map(b=>b.textContent).join('|')==='전용 59.98㎡','Observed area offered: '+chips().map(b=>b.textContent).join('|'));
  setComplexPlanType(chips()[0].getAttribute('onclick').match(/'([^']+)'/)[1]);await wait(40);
  check(decodeURIComponent(big().getAttribute('href')).endsWith('송도 가상뷰 2블럭 59㎡ 평면도'),'Observed-area query');
  check([...sheet.querySelectorAll('.complexQuickLinks a')].some(a=>a.textContent.includes('하이라이트 아파트정보')),'hilite named');
  check(sheet.scrollWidth<=sheet.clientWidth+1,'No sideways scroll in the sheet');
  out.textContent='PASS chips in pyeong order, type image search, toggle, office links, named sources, observed areas';
 }catch(e){out.textContent='FAIL '+e.message}
 document.body.innerHTML='';document.body.appendChild(out);
}
const chrome=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'Chrome required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-floorplan-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--user-data-dir='+path.join(tmp,'profile-'+width),'--hide-scrollbars','--window-size='+width+',1000','--virtual-time-budget=12000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-600));
  const found=r.stdout.match(/<pre id="floorplan-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report '+r.stdout.slice(-400));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
