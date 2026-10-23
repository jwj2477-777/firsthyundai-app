/* v2.0.31: stable top-of-page controls and equal-level news/subscription titles. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const code=html.split('<script>')[1]?.split('</script>')[0];
assert(code);new vm.Script(code);
const page=(id,end)=>html.slice(html.indexOf('<div id="'+id+'" class="page'),html.indexOf(end,html.indexOf('<div id="'+id+'" class="page')));
for(const id of ['trades','nearby','new','officetel','complexes','news']){
 const section=page(id,id==='nearby'?'<div id="apiGuide"':id==='new'?'<div id="trades"':id==='trades'?'<div id="officetel"':id==='officetel'?'<div id="news"':id==='news'?'<div id="contracts"':'<dialog id="complexEditor"');
 const title=section.indexOf('class="sectionTitle');
 const contentStart=section.indexOf('class="panel');
 assert(title>=0 && (contentStart<0||title<contentStart),'Same title-before-content hierarchy: '+id);
 assert(/<h2(?:\s[^>]*)?>/.test(section.slice(title,title+120)),'All page titles are h2: '+id);
 assert(section.includes('refreshAction'),'Refresh stays available in header: '+id);
 if(['trades','nearby','new','officetel'].includes(id)){
  const toggle=section.indexOf('class="propertyTypeSwitch sectionSubnav sectionModeSwitch"');
  assert(toggle>title && (contentStart<0||toggle<contentStart),'Property switch after title, before contents: '+id);
  assert(section.includes('onclick="openTradeLatest()"')&&section.includes('onclick="switchPage(\'officetel\')"'),'Retain apartment and office mode: '+id);
 }
}
const nav=code.slice(code.indexOf('const NAV_CATEGORIES=['),code.indexOf('// A detail sheet is its own full-screen view'));
assert(nav.includes("$('nav').innerHTML=primary+tools;"),'Top three categories and two common shortcuts only');
assert(!nav.includes('primary+tools+propertySwitch'),'No condition-specific nav above page title');
const news=page('news','<div id="contracts"');
const head=news.indexOf('class="sectionTitle newsUnifiedHeading"');
const tabs=news.indexOf('class="controls newsCategoryTabs sectionModeSwitch"');
assert(head>=0&&tabs>head,'News heading above tabs, consistent with other pages');
assert.equal((news.match(/id="newsMeta"/g)||[]).length,1);
assert.equal((news.match(/id="newsFamilyMeta"/g)||[]).length,1);
assert(news.includes('id="newsSectionTitle"'));
assert(news.includes('id="newsRefreshArticles"')&&news.includes('id="newsRefreshSubscriptions"'),'Keep both actual refresh routes');
assert(news.includes('refreshOne(\'news\',true)')&&news.includes('refreshPublicServices(true)'));
assert(!news.includes('<h3>인천광역시 청약·분양</h3>'),'Subscription title must not shrink inside a card');
assert(!news.includes('<h3>송도·부동산 뉴스 브리핑</h3>'),'News article title uses shared h2');
assert(!news.includes('>공고 갱신</button>'),'No secondary duplicate subscription refresh');
assert(css.includes('#news.page>.sectionTitle:first-child h2')&&css.includes('font-size:22px'),'Equal heading typography in all three tabs');
assert(css.includes('#news .newsCategoryTabs{margin:0 0 14px'),'Same subsection spacing');
const nodes=new Map();
function el(id){
 if(!nodes.has(id)){
  const flags=new Set(id==='newsSubscriptionsPane'||id==='newsRefreshSubscriptions'?['hidden']:[]);
  nodes.set(id,{className:'',textContent:'',classList:{toggle(name,on){if(on)flags.add(name);else flags.delete(name)},contains(name){return flags.has(name)}},
   setAttribute(name,val){this[name]=val}});
 }
 return nodes.get(id);
}
let refreshedSubscription=0;
const ctx=vm.createContext({$:el,renderPublicSubscriptions(){refreshedSubscription++;}});
const a=code.indexOf('function switchNewsPane(pane){'),b=code.indexOf('function switchPage(id){',a);
assert(a>=0&&b>a);vm.runInContext(code.slice(a,b),ctx);
const switcher=mode=>vm.runInContext('switchNewsPane('+JSON.stringify(mode)+')',ctx);
switcher('subscriptions');
assert.equal(el('newsSectionTitle').textContent,'인천광역시 청약·분양');
assert(el('newsRefreshArticles').classList.contains('hidden'));
assert(!el('newsRefreshSubscriptions').classList.contains('hidden'));
assert(el('newsMeta').classList.contains('hidden'));
assert.equal(el('newsTabSubscriptions')['aria-selected'],'true');
assert.equal(refreshedSubscription,1);
switcher('articles');
assert.equal(el('newsSectionTitle').textContent,'송도·부동산 뉴스 브리핑');
assert(!el('newsRefreshArticles').classList.contains('hidden'));
assert(el('newsRefreshSubscriptions').classList.contains('hidden'));
assert(!el('newsMeta').classList.contains('hidden'));
assert.equal(el('newsTabArticles')['aria-selected'],'true');
console.log('Unified top layout tests passed: title-first sections, all four property switches, equal news headings and refresh routes.');
