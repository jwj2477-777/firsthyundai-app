'use strict';
/* Two contextual switch families share one visual component, but keep actions. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const main=html.split('<script>')[1]?.split('</script>')[0];
assert(main);new vm.Script(main);
const trade=html.match(/<div class="propertyTypeSwitch sectionSubnav sectionModeSwitch" data-tone="teal"[^>]*>[\s\S]*?<\/div>/g)||[];
assert.equal(trade.length,4,'All three apartment trade views and officetel share segmented switch markup');
const news=html.match(/<div class="controls newsCategoryTabs sectionModeSwitch" data-tone="purple"[^>]*>[\s\S]*?<\/div>/g)||[];
assert.equal(news.length,1,'News/subscription view has the identical switch container');
for(const panel of trade){
 assert(panel.includes('role="group"'));
 assert(panel.includes('onclick="openTradeLatest()"')&&panel.includes('onclick="switchPage(\'officetel\')"'),
  'Both existing apartment/officetel routes remain functional');
 assert(panel.includes('aria-pressed="true"')&&panel.includes('aria-pressed="false"'));
 assert(panel.includes('>아파트</button>')&&panel.includes('>오피스텔</button>'));
}
const selected=trade.filter(p=>p.includes('class="selected" aria-pressed="true" onclick="openTradeLatest()"'));
assert.equal(selected.length,3,'Apartment active across trade, favorites and new pages');
assert(trade[3].includes('class="selected" aria-pressed="true" onclick="switchPage(\'officetel\')"'),
 'Office remains selected on office page');
assert(news[0].includes('role="tablist"'));
assert(news[0].includes('aria-selected="true"')&&news[0].includes('aria-selected="false"'));
assert(news[0].includes("switchNewsPane('articles')")&&news[0].includes("switchNewsPane('subscriptions')"));
assert(news[0].includes('aria-controls="newsArticlesPane"')&&news[0].includes('aria-controls="newsSubscriptionsPane"'));
assert(css.includes('.page .sectionModeSwitch[data-tone="teal"]'));
assert(css.includes('.page .sectionModeSwitch[data-tone="purple"]'));
assert(css.includes('--segment-active:#006A6B')&&css.includes('--segment-active:#6547A5'),
 'Preserve original teal and purple themes');
const rules=[
 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr))',
 'gap:5px;padding:6px;margin:0 0 14px;width:100%',
 'border-radius:18px;background:var(--segment-bg)',
 'appearance:none;min-width:0;width:100%;min-height:62px',
 'border:2px solid transparent;border-radius:13px',
 'font-family:inherit;font-size:16px;font-weight:850',
 '#news .newsCategoryTabs.sectionModeSwitch>button[aria-selected="true"]',
 '.propertyTypeSwitch.sectionModeSwitch>button.selected',
 'prefers-reduced-motion:reduce'
];
for(const rule of rules)assert(css.includes(rule),'Shared visual switch contract: '+rule);
assert(css.includes('content:none;display:none;'),'No duplicate old news check-mark prefix');
assert(css.includes('@media(max-width:410px)'),'Responsive tap and text sizing');
const elements={};let refreshed=0;
function el(id){
 if(!elements[id]){const flags=new Set(id==='newsSubscriptionsPane'?['hidden']:[]);
  elements[id]={textContent:'',className:'',attributes:{},
   classList:{toggle(k,on){if(on)flags.add(k);else flags.delete(k)},contains:k=>flags.has(k)},
   setAttribute(k,v){this.attributes[k]=v}}}
 return elements[id];
}
const start=main.indexOf('function switchNewsPane(pane){');
const end=main.indexOf('function switchPage(id){',start);
assert(start>=0&&end>start);
const ctx=vm.createContext({$:el,renderPublicSubscriptions(){refreshed++}});
vm.runInContext(main.slice(start,end),ctx);
vm.runInContext("switchNewsPane('subscriptions')",ctx);
assert.equal(el('newsSectionTitle').textContent,'인천광역시 청약·분양');
assert.equal(el('newsTabSubscriptions').attributes['aria-selected'],'true');
assert(el('newsRefreshArticles').classList.contains('hidden'));
assert(!el('newsRefreshSubscriptions').classList.contains('hidden'));
assert.equal(refreshed,1);
vm.runInContext("switchNewsPane('articles')",ctx);
assert.equal(el('newsSectionTitle').textContent,'송도 뉴스');
assert.equal(el('newsTabArticles').attributes['aria-selected'],'true');
assert(!el('newsRefreshArticles').classList.contains('hidden'));
assert(el('newsRefreshSubscriptions').classList.contains('hidden'));
console.log('Segmented switches: identical geometry, accessible active states, preserved teal/purple identity, routes and refresh.');
