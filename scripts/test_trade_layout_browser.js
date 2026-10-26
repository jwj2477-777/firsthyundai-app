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
  publicServices={schema_version:1,schools:{state:'awaiting_approval',records:[]},subscriptions:{state:'verified',updated_at:time,window_start:'2025-08-30',records:[]},office_sales:{state:'verified',updated_at:time,records:[]},office_rents:{state:'verified',updated_at:time,records:[]}};
  // Opening the real office route refreshes its provider. Serve the same
  // deterministic snapshot there as well; CI network access must not replace
  // fixtures with live government timestamps partway through a layout test.
  const providerSnapshot=structuredClone(publicServices);
  fetchRemote=async filename=>filename==='public_services'?structuredClone(providerSnapshot):null;
  renderTrades();
  const stableTypeRow=(page,selector,paint)=>{
   switchPage(page);
   const bar=document.querySelector(selector),buttons=Array.from(bar.querySelectorAll('button'));
   const initial=buttons.map(box),row=box(bar);
   for(const n of [0,1,10000,250000]){
    paint({'':n,매매:n,전세:n,월세:n});
    buttons.forEach((button,i)=>{
     close('type button unchanged '+page+' '+n+' '+i,box(button),initial[i]);
     const label=button.querySelector('.typeLabel'),count=button.querySelector('.typeCount');
     check('count below label '+page,!!label&&!!count&&count.getBoundingClientRect().top>=label.getBoundingClientRect().bottom);
     check('count formatting '+page,count.textContent===n.toLocaleString('ko-KR')+'건');
    });
    close('type row unchanged '+page+' '+n,box(bar),row);
   }
  };
  stableTypeRow('trades','#tradeTypeBar',c=>renderTypeButtons('tradeTypeBar','',c));
  stableTypeRow('officetel','#officeTypeBar',c=>renderTypeButtons('officeTypeBar','',c));
  stableTypeRow('new','#newTypeBar',c=>updateNewQuickFilters(c));
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
     check('collection metadata retained without clipping',meta&&meta.textContent.includes('2026.10.25 04:56')&&meta.scrollHeight<=meta.clientHeight+1);
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
  check('news header shows actual compact time',document.getElementById('newsFamilyMeta').textContent==='최종 갱신 2026.10.25 04:56');
  check('news header has no large administrative blank',document.querySelector('#news>.sectionTitle').offsetHeight<=(innerWidth>380?56:82));
  document.getElementById('newsTabSubscriptions').click();await tick();scrollTo(0,0);
  close('news sibling tabs remain anchored',box(document.querySelector('.newsCategoryTabs')),news);
  check('subscription header is useful rather than empty',document.getElementById('subscriptionsMeta').textContent==='청약홈 · 확인 2026.10.25 04:56'&&getComputedStyle(document.getElementById('subscriptionsMeta')).display!=='none');
  const source=document.querySelector('.subscriptionSourceDetails');
  check('source coverage retained without expanded filler',source&&!source.open&&source.textContent.includes('2025-08-30'));
  document.getElementById('newsTabArticles').click();await tick();scrollTo(0,0);
  close('return to news retains anchor',box(document.querySelector('.newsCategoryTabs')),news);
  // Real non-empty sibling feeds share their filters, context row, count and list anchors.
  const categories=['개발·교통','분양·입주','세금·대출','정책·규제'];
  remote.news.briefs=categories.map((category,i)=>({id:'fixture-'+i,title:'검사용 뉴스 '+i,category,
   summary_method:i%2?'headline_only':'gemini_article',article_count:1,sources:[],last_published_at:time,
   summary:i%2?'':'첫 번째 검사용 사실입니다.\n두 번째 검사용 사실입니다.\n세 번째 검사용 사실입니다.'}));
  const sampleNotice=(kind,name,start,end)=>({kind,name,notice_date:kstDateOffset(0),apply_start:start,apply_end:end,
   address:'검사용 공급위치',households:100,notice_url:'https://www.applyhome.co.kr/ai/aia/test.do'});
  providerSnapshot.subscriptions.records=[
   ...['아파트','무순위·잔여세대','오피스텔·도시형 등'].map((kind,i)=>sampleNotice(kind,'검사용 예정 공고 '+i,kstDateOffset(-1),kstDateOffset(-2))),
   sampleNotice('아파트','검사용 마감 공고',kstDateOffset(2),kstDateOffset(1)),
   sampleNotice('아파트','검사용 미확인 공고','','')];
  publicServices=structuredClone(providerSnapshot);
  function feedGeometry(){
   const pane=document.querySelector('#news>section:not(.hidden)'),panel=pane.querySelector('.newsFeedPanel');
   const details=panel.querySelector('details'),count=panel.querySelector('.feedResultCount');
   const first=panel.querySelector('.newsCard,.subscriptionListingCard');
   return {panel:box(panel).slice(0,3),filters:box(panel.querySelector('.newsFilterRow')),
    summary:box(details.querySelector('summary')),count:box(count),first:first&&box(first)[1]};
  }
  function labelsFit(){
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   for(const select of document.querySelectorAll('#news>section:not(.hidden) .newsFilterRow>select')){
    const style=getComputedStyle(select);ctx.font=style.font;
    check('selected filter wording fits without clipping '+select.id,
     ctx.measureText(select.selectedOptions[0].textContent).width<=select.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)+1);
    check('all filter touch targets retain at least 50px',select.offsetHeight>=50);
    check('filter keeps a visible dropdown affordance',style.backgroundImage.includes('data:image/svg+xml'));
   }
  }
  for(const mode of ['family','admin']){
   document.body.dataset.officeRole=mode;
   switchNewsPane('articles');document.getElementById('newsCategory').value='';renderNews();await tick();scrollTo(0,0);
   const base=feedGeometry();labelsFit();
   check('feed context starts collapsed',!document.querySelector('#newsArticlesPane details').open);
   for(const category of categories){
    document.getElementById('newsCategory').value=category;renderNews();await tick();
    const g=feedGeometry();close('news topic does not move filters',g.filters,base.filters);
    close('news topic does not move count',g.count,base.count);check('news topic does not move first result',Math.abs(g.first-base.first)<.6);labelsFit();
   }
   document.querySelector('#newsArticlesPane details').open=true;await tick();
   check('full original caution remains accessible',document.querySelector('#newsArticlesPane details').textContent.includes('중요한 정보는 원문에서 확인하세요.'));
   close('opening news guidance leaves filters fixed',feedGeometry().filters,base.filters);
   document.querySelector('#newsArticlesPane details').open=false;
   switchNewsPane('subscriptions');await tick();
   let g=feedGeometry();labelsFit();
   close('sibling feed panels start together',g.panel,base.panel);
   close('sibling filter rows share position and height',g.filters,base.filters);
   close('sibling context summaries share position and height',g.summary,base.summary);
   close('sibling result counts share position and height',g.count,base.count);
   check('sibling first result cards start together',Math.abs(g.first-base.first)<.6);
   for(const status of ['valid','past','unknown','all'])for(const kind of ['','아파트','무순위·잔여세대','오피스텔·도시형 등']){
    document.getElementById('subscriptionStatusFilter').value=status;document.getElementById('subscriptionKindFilter').value=kind;
    renderPublicSubscriptions();await tick();g=feedGeometry();labelsFit();
    close('status/type filtering keeps controls anchored',g.filters,base.filters);
    close('status/type filtering keeps result count anchored',g.count,base.count);
    const expectedStages=kind==='아파트'?[1,1,1]:kind?[1,0,0]:[3,1,1];
    const expectedCount=status==='all'?expectedStages.reduce((a,b)=>a+b,0):expectedStages[{valid:0,past:1,unknown:2}[status]];
    const countText=document.querySelector('#publicSubscriptions>.feedResultCount').textContent;
    check('count describes exact selected result and status',countText.startsWith('공고 '+expectedCount+'건 · ')&&countText.includes({valid:'예정·진행',past:'접수 마감',unknown:'일정 미확인',all:'전체 상태'}[status]));
    check('full stage counts and source coverage preserved',document.querySelector('.subscriptionSourceDetails').textContent.includes('접수 예정/진행')&&document.querySelector('.subscriptionSourceDetails').textContent.includes('일정 미확인')&&document.querySelector('.subscriptionSourceDetails').textContent.includes('2025-08-30'));
    if(g.first)check('filtered first result retains list anchor',Math.abs(g.first-base.first)<.6);
   }
   document.querySelector('.subscriptionSourceDetails').open=true;await tick();
   close('opening source context leaves filters fixed',feedGeometry().filters,base.filters);
  }
  // The eight apartment-detail siblings keep their shared address, shortcut and tab grid.
  switchPage('complexes');await tick();selectComplex('f13');await tick();
  const tabBoxes=()=>[...document.querySelectorAll('#complexSheet .complexTabBar>button')].map(box);
  const tabs=tabBoxes();check('all eight detail destinations remain available',tabs.length===8);
  for(let i=0;i<8;i++){
   document.querySelectorAll('#complexSheet .complexTabBar>button')[i].click();await tick();
   tabBoxes().forEach((r,j)=>close('detail sibling '+i+' preserves tab '+j,r,tabs[j]));
  }
  closeApartmentSheet();
  check('date-only directory source never invents collection time',document.getElementById('complexCollectionMeta').textContent==='송도동 · 자료 기준 2026.10.20');
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
   '--window-size='+width+',1100','--virtual-time-budget=180000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1200));
  const m=r.stdout.match(/<pre id="layout-test">([\s\S]*?)<\/pre>/);
  assert(m,'Layout browser did not finish: '+r.stdout.slice(-600));
  assert(m[1].startsWith('PASS '),width+'px '+m[1]);console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
