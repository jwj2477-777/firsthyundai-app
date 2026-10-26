/* v1.19.18: no duplicate/no-op menu rows; functional destination tests. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assets=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const css=fs.readFileSync(path.join(assets,'theme.css'),'utf8');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new vm.Script(js);
const begin=js.indexOf('const NAV_CATEGORIES=[');
const end=js.indexOf('// A detail sheet is its own full-screen view',begin);
assert(begin>=0&&end>begin,'Main navigation exists');
let focused=0,scrolled=0,nav='';
const search={focus(){focused++},scrollIntoView(){scrolled++}};
const ctx=vm.createContext({
 role:'family',currentPage:'nearby',newsPane:'subscriptions',
 $:id=>id==='nav'?{set innerHTML(v){nav=v},get innerHTML(){return nav}}:id==='complexSearch'?search:null
});
vm.runInContext(js.slice(begin,end),ctx);
function render(page){vm.runInContext('renderMainNavigation('+JSON.stringify(page)+')',ctx);return nav;}

function verifyShortcutPlacement(page){
 const menu=render(page);
 const primary=menu.indexOf('class="primaryNav"');
 const shortcuts=menu.indexOf('class="utilityNav"');
 const property=menu.indexOf('class="propertyTypeSwitch"');
 const secondary=menu.indexOf('class="secondaryNav"');
 assert(primary>=0&&shortcuts>primary,'Today/contract row follows the three main tabs on '+page);
 assert(menu.indexOf('오늘 요약',shortcuts)>shortcuts&&menu.indexOf('계약문자 만들기',shortcuts)>shortcuts,
  'Both shortcuts remain available on '+page);
 assert.equal(property,-1,'All pages use the same global header; property switch follows the local title on '+page);
 assert.equal(secondary,-1,'Do not duplicate trade destinations above the page content on '+page);
}
for(const page of ['trades','nearby','new','officetel','complexes','news','overview','contracts'])
 verifyShortcutPlacement(page);
ctx.role='admin';
verifyShortcutPlacement('trades');
assert(nav.includes('관리센터'),'Administrator console shortcut must be accessible');
ctx.role='family';
let n=render('complexes');
assert(n.includes('아파트정보')&&n.includes('계약문자 만들기'),'Main destinations visible');
assert(n.includes('openComplexHome()'),'Apartment button must jump to search');
assert(!n.includes('secondaryNav'),'Never display a redundant only-child apartment button');
assert(!n.includes('송도 단지 검색'),'Duplicate apartment search button removed');
assert.equal((n.match(/>아파트정보<\/span><\/button>/g)||[]).length,1);
n=render('news');
assert(n.includes('openNewsHome()'),'News button must open a real home destination');
assert(!n.includes('secondaryNav'),'Never display single redundant news subsection');
assert(!n.includes('부동산·송도 뉴스'),'Duplicate news row removed');
n=render('nearby');
assert(!n.includes('secondaryNav'),'Apartment trade options now appear once inside the selected page');
for(const [page,id] of [['trades','trades'],['nearby','nearby'],['new','new']]){
 const start=html.indexOf('<div id="'+id+'"');
 const next=html.indexOf('class="tradeStarter apartmentTradeNav"',start);
 assert(start>=0&&next>start,'Page has local trade controls: '+page);
 const row=html.slice(next,html.indexOf('</div>',next));
 assert(row.includes('전체 최신순')&&row.includes('관심 14개')&&row.includes('새 거래'),
   'Three trade destinations in one local row: '+page);
 assert(!row.includes('아파트 선택'),'Duplicate apartment selection is removed: '+page);
}
assert(!html.includes('id="tradeModeSearch"'),'Standalone apartment picker button removed');
assert(html.includes('id="aptFilter"'),'Direct apartment search is available in advanced filters');
const funcs=js.slice(js.indexOf('function openComplexHome(){'),js.indexOf('function switchNewsPane(',js.indexOf('function openComplexHome(){')));
assert(funcs.includes('function openNewsHome(){'));
vm.runInContext('function switchPage(id){currentPage=id;}',ctx);
vm.runInContext(funcs,ctx);
ctx.currentPage='complexes';
vm.runInContext('openComplexHome()',ctx);
assert.equal(focused,1,'Selected apartment menu focuses actual search, not no-op');
assert.equal(scrolled,1,'Selected apartment menu scrolls to search field');
ctx.currentPage='nearby';
vm.runInContext('openComplexHome()',ctx);
assert.equal(ctx.currentPage,'complexes','Apartment menu from another page navigates');
assert.equal(focused,1,'Changing pages should not forcibly open the keyboard');
ctx.newsPane='subscriptions';
vm.runInContext('openNewsHome()',ctx);
assert.equal(ctx.newsPane,'articles','Top news resets to actual news briefing');
assert.equal(ctx.currentPage,'news');
const complex=html.slice(html.indexOf('<div id="complexes"'),html.indexOf('<dialog id="complexEditor"'));
assert(!complex.includes('id="complexScope"'),'Redundant apartment scope selector must not appear');
assert(complex.includes('<label class="inputLabel" for="complexSearch">아파트 이름 입력</label>'));
assert(!complex.includes('어디에서 찾을까요?'),'No duplicate scope question');
assert(complex.includes('oninput="resetComplexLimit();renderComplexes()"'));
assert(!complex.includes('onchange="resetComplexLimit();renderComplexes()"'),'No scope dropdown onchange');
assert(!complex.includes('<option value="all">송도 전체 아파트</option>'));
assert(!complex.includes('<option value="favorites">★ 관심 14개 단지만</option>'));
const news=html.slice(html.indexOf('<div id="news"'),html.indexOf('<div id="contracts"'));
assert.equal((news.match(/id="newsTabArticles"/g)||[]).length,1);
assert.equal((news.match(/id="newsTabSubscriptions"/g)||[]).length,1);
assert(news.includes("switchNewsPane('articles')")&&news.includes("switchNewsPane('subscriptions')"));
assert(css.includes('.newsCategoryTabs>button[aria-selected="true"]'),'Active news tab visibly labeled by shape');
assert(css.includes('#complexes #complexSearch{'),'Apartment name search visibly full-width');
assert(css.includes('#nav .utilityNav{'),'Utility buttons grouped consistently');
console.log('Navigation and search regression passed: direct apartment lookup, no redundant scope selector, news and favorite navigation.');
