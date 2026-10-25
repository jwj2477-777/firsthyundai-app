'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'admin-settings-navigator.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'admin-center.css'),'utf8');
new vm.Script(js);
const ids=['adminControlSearch','adminSearchClear','adminSearchResult','adminCategoryFilters',
 'adminExperiencePanel','adminSharedSettingsPanel','adminFeedsPanel','adminToolsPanel',
 'adminTapSize','adminMemoLayout','adminUndoLast','adminLastChange'];
for(const id of ids)assert(html.includes('id="'+id+'"')||id==='adminCategoryFilters'&&html.includes('class="adminCategoryFilters"'),
 'Missing accessible admin UI: '+id);
assert(html.includes('<script src="admin-settings-navigator.js"></script>'));
assert.equal((html.match(/class="adminSettingsGroup"/g)||[]).length,5);
assert(css.includes('min-height:48px'),'Finger-friendly search and control height expected');
const registry={},scrolls=[];
function entry(id){return registry[id]||(registry[id]={id,hidden:false,value:'',disabled:false,
 textContent:'',setAttribute(k,v){this[k]=v},focus(){this.focused=true},
 scrollIntoView(){scrolls.push(id)}})}
const makeRow=(id,text)=>({textContent:text,hidden:false,querySelector(){return {id}}});
const view=[makeRow('adminReadingSize','글씨 가독성 부모님'),makeRow('adminTapSize','터치 버튼 크기')];
const trade=[makeRow('adminTradeAmountStyle','실거래 금액')];
const memo=[makeRow('adminMemoPhones','메모 전화번호 바로 걸기'),makeRow('adminMemoLayout','메모 카드 간격')];
const groups=[{cat:'view',rows:view},{cat:'trade',rows:trade},{cat:'memo',rows:memo}].map((item,i)=>({
 dataset:{adminCategory:item.cat},rows:item.rows,hidden:false,open:i===0,tagName:'DETAILS',
 querySelectorAll(selector){assert.equal(selector,'.adminPrefRow,.adminAlertPref');return this.rows},
 scrollIntoView(){scrolls.push(item.cat)}
}));
const buttons=['all','view','trade','memo','tools'].map(value=>({dataset:{adminFilter:value},setAttribute(k,v){this[k]=v}}));
const tools=[{textContent:'보안 비밀번호 관리',hidden:false},{textContent:'API 데이터 연결',hidden:false}];
Object.assign(entry('adminCenter'),{
 querySelectorAll(selector){
  if(selector==='.adminSettingsGroup')return groups;
  if(selector==='.adminCategoryFilters button')return buttons;
  throw Error('Unknown selector '+selector);
 }
});
Object.assign(entry('adminToolsPanel'),{
 querySelectorAll(selector){assert.equal(selector,'.adminToolGrid>button');return tools}
});
const ctx=vm.createContext({document:{getElementById:entry},window:{},role:'admin'});
vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiAdminNavigator;
assert(api&&api._test.matches('전화번호 누르기',['전화']));
assert(api.search('전화번호'));
assert.equal(memo[0].hidden,false);
assert.equal(view[0].hidden,true);
assert.equal(trade[0].hidden,true);
assert.equal(groups[2].open,true,'Search expands relevant collapsed group');
assert(entry('adminSearchResult').textContent.includes('설정 1개'));
assert(api.filter('tools'));
assert(entry('adminToolsPanel').hidden===true,'Unmatched tools do not appear for unrelated search');
assert(api.clear());
assert.equal(view[0].hidden,false);
assert.equal(entry('adminToolsPanel').hidden,false);
assert(api.filter('memo'));
assert.equal(view[0].hidden,true);
assert.equal(memo[0].hidden,false);
assert(api.jump('view'));
assert(scrolls.includes('view'));
assert(api.jump('sync'));
assert(scrolls.includes('adminSharedSettingsPanel'));
assert(api.jump('feeds'));
assert(scrolls.includes('adminFeedsPanel'));
assert(entry('adminFreshnessLevel').focused);
assert.equal(api.filter('unknown'),false);
ctx.role='family';
assert.equal(api.search('암호'),false,'Family user cannot invoke admin search');
assert.equal(api.jump('memo'),false,'Family user cannot open admin section');
console.log('Admin navigator: search, filters, jump, collapsed category, keyboard focus and role guards passed.');
