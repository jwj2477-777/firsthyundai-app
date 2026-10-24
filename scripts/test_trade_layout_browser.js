'use strict';
/* Real app routes and click handlers: shared navigation anchors cannot jump. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chrome required for shared transaction layout regression');
async function checkLayouts(){
 const checks=[],check=(label,ok)=>{checks.push(label);if(!ok)throw Error(label)};
 const box=el=>{const r=el.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height]};
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<.6);
 const close=(label,a,b)=>check(label+' '+JSON.stringify({a,b}),same(a,b));
 const tick=async()=>{await new Promise(r=>setTimeout(r,1000));
  // Dump-DOM virtual time does not advance compositor sheet transitions.
  // Compare settled geometry; the separate motion suite tests animation.
  document.getAnimations().forEach(a=>{try{a.finish()}catch{}});
 };
 try{
  await document.fonts.ready;
  const time='2026-10-25T04:56:50+09:00';
  remote.trades={state:'ok',area:'인천 연수구 송도동',checked_at:time,records:[]};
  remote.new_trades={state:'ok',checked_at:time,records:[]};
  remote.news={state:'ok',checked_at:time,briefs:[]};
  remote.complexes={updated_at:'2026-10-20',records:[]};
  publicServices={subscriptions:{state:'verified',updated_at:time,window_start:'2025-08-30',records:[]},office_sales:{state:'verified',updated_at:time,records:[]},office_rents:{state:'verified',updated_at:time,records:[]}};
  renderTrades();
  for(const officeRole of ['family','admin']){
   document.body.dataset.officeRole=officeRole;
   for(const partial of [false,true]){
    remote.trades.state=partial?'partial':'ok';renderTrades();
    switchPage('trades');await tick();scrollTo(0,0);
    const read=()=>{
     const page=document.querySelector('.page:not(.hidden)');
     return {property:box(page.querySelector('.propertyTypeSwitch')),nav:box(page.querySelector('.tradeStarter')),
      button:box(page.querySelector('.tradeStarter>button')),type:page.querySelector('.tradeTypeBar,.newTypeChips')&&box(page.querySelector('.tradeTypeBar,.newTypeChips'))};
    };
    const base=read(),apartmentAdvanced=box(document.getElementById('tradeAdvanced'));
    document.querySelector('#tradeTypeBar>button:nth-child(3)').click();await tick();scrollTo(0,0);
    close('active filter summary does not push advanced menu',box(document.getElementById('tradeAdvanced')),apartmentAdvanced);
    document.querySelector('#tradeTypeBar>button:first-child').click();await tick();
    const head=document.querySelector('#trades>.sectionTitle');
    check('heading reserves only compact title/meta rows',head.offsetHeight<=(innerWidth>380?56:82));
    check('partial failure warning remains with results',!partial||document.getElementById('tradesContent').textContent.includes('일부 수집 실패'));
    for(const target of [1,2,0]){
     document.querySelector('.page:not(.hidden) .apartmentTradeNav').children[target].click();await tick();scrollTo(0,0);
     const page=document.querySelector('.page:not(.hidden)'),r=read();
     close(officeRole+' apartment property row stable '+target,r.property,base.property);
     close('apartment three-way navigation stable '+target,r.nav,base.nav);
     close('apartment first button stable '+target,r.button,base.button);
     if(target!==1)close('new/latest transaction types share anchor',r.type,base.type);
     const meta=page.querySelector('.sectionTitle p.tiny');
     check('collection metadata retained without clipping',meta&&meta.textContent.includes('26.10.25 04:56')&&meta.scrollHeight<=meta.clientHeight+1);
     check('page has no horizontal overflow',page.scrollWidth<=page.clientWidth+1);
    }
    document.querySelector('#trades .propertyTypeSwitch>button:last-child').click();await tick();scrollTo(0,0);
    let r=read();close('office property row stable',r.property,base.property);
    close('office navigation top/height matches apartment',[r.nav[0],r.nav[1],r.nav[2],r.nav[3]],base.nav);
    close('office button height matches apartment',[r.button[1],r.button[3]],[base.button[1],base.button[3]]);
    close('office type row matches apartment',r.type,base.type);
    const advanced=box(document.getElementById('officeAdvanced'));
    close('apartment/office advanced summary shares full geometry',advanced,apartmentAdvanced);
    document.getElementById('officeModeSearch').click();await tick();scrollTo(0,0);
    r=read();close('office chooser does not push common menu',r.nav,base.nav);
    close('office chooser does not push type row',r.type,base.type);
    close('office chooser does not push advanced filters',box(document.getElementById('officeAdvanced')),advanced);
    check('office chooser is visible below shared filters',!document.getElementById('officeSearchPanel').classList.contains('hidden')&&box(document.getElementById('officeSearchPanel'))[1]>advanced[1]);
    document.getElementById('officeModeLatest').click();await tick();
    close('closing chooser keeps type row fixed',read().type,base.type);
    document.querySelector('#officetel .propertyTypeSwitch>button').click();await tick();scrollTo(0,0);
    close('return to apartment keeps submenu anchor',read().nav,base.nav);
   }
  }
  // Existing sibling news navigation must also remain stable when metadata hides.
  switchPage('news');await tick();scrollTo(0,0);
  const news=box(document.querySelector('.newsCategoryTabs'));
  check('news header shows actual compact time',document.getElementById('newsFamilyMeta').textContent==='갱신 26.10.25 04:56');
  check('news header has no large administrative blank',document.querySelector('#news>.sectionTitle').offsetHeight<=(innerWidth>380?56:82));
  document.getElementById('newsTabSubscriptions').click();await tick();scrollTo(0,0);
  close('news sibling tabs remain anchored',box(document.querySelector('.newsCategoryTabs')),news);
  check('subscription header is useful rather than empty',document.getElementById('subscriptionsMeta').textContent==='청약홈 · 확인 26.10.25 04:56'&&getComputedStyle(document.getElementById('subscriptionsMeta')).display!=='none');
  const source=document.querySelector('.subscriptionSourceDetails');
  check('source coverage retained without expanded filler',source&&!source.open&&source.textContent.includes('2025-08-30'));
  document.getElementById('newsTabArticles').click();await tick();scrollTo(0,0);
  close('return to news retains anchor',box(document.querySelector('.newsCategoryTabs')),news);
  // The eight apartment-detail siblings keep their shared address, shortcut and tab grid.
  switchPage('complexes');await tick();selectComplex('f13');await tick();
  const tabBoxes=()=>[...document.querySelectorAll('#complexSheet .complexTabBar>button')].map(box);
  const tabs=tabBoxes();check('all eight detail destinations remain available',tabs.length===8);
  for(let i=0;i<8;i++){
   document.querySelectorAll('#complexSheet .complexTabBar>button')[i].click();await tick();
   tabBoxes().forEach((r,j)=>close('detail sibling '+i+' preserves tab '+j,r,tabs[j]));
  }
  closeApartmentSheet();
  check('date-only directory source never invents collection time',document.getElementById('complexCollectionMeta').textContent==='송도동 · 자료 기준 26.10.20');
  check('invalid/missing directory dates remain unknown',complexCollectionLabel({updated_at:'2026-02-31'}).includes('확인 필요')&&complexCollectionLabel(null).includes('확인 전'));
  document.body.innerHTML='<pre id="layout-test">PASS '+checks.length+' shared layout assertions</pre>';
 }catch(e){document.body.innerHTML='<pre id="layout-test">FAIL '+e.message+'</pre>'}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-trade-layout-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+checkLayouts.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,380,393,430,600]){
  const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars',
   '--window-size='+width+',1100','--virtual-time-budget=100000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1200));
  const m=r.stdout.match(/<pre id="layout-test">([\s\S]*?)<\/pre>/);
  assert(m,'Layout browser did not finish: '+r.stdout.slice(-600));
  assert(m[1].startsWith('PASS '),width+'px '+m[1]);console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
