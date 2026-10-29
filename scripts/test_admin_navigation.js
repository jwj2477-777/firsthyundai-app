'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const code=fs.readFileSync(path.join(dir,'admin-settings-navigator.js'),'utf8');
new vm.Script(code);
for(const id of ['adminCenter','adminControlSearch','adminSearchResult','adminSearchClear','adminToolsPanel',
 'adminPeoplePanel','adminSharedSettingsPanel','adminFeedsPanel','adminCategoryGrid','adminSectionBar'])
 assert(html.includes('id="'+id+'"'),'Missing '+id);
for(const category of ['view','memo','trade','people','data','tools'])
 assert(html.includes('data-admin-select="'+category+'"'),'Missing hub category '+category);
const groups=['view','view','trade','memo','trade'].map((category,i)=>{
 const row={hidden:false,textContent:i===3?'포스트잇 메모 갱신 주기':'거래와 글씨 설정',
 querySelector(){return {id:i===3?'adminMemoRefresh':'adminReadingSize'}}};
 return {dataset:{adminCategory:category},hidden:false,open:false,tagName:'DETAILS',
 querySelectorAll:q=>q==='.adminPrefRow,.adminAlertPref'?[row]:[],scrollIntoView(){this.scrolled=true}};
});
const tools=[
 {textContent:'API 연동',dataset:{adminTool:'data'},hidden:true},
 {textContent:'보안·권한',dataset:{adminTool:'people'},hidden:true},
 {textContent:'앱 업데이트',dataset:{adminTool:'tools'},hidden:true},
 {textContent:'알림 설정',dataset:{adminTool:'trade'},hidden:true}
];
const cards=['view','memo','trade','people','data','tools'].map(c=>
 ({dataset:{adminSelect:c},setAttribute(k,v){this[k]=v}}));
const elements=new Map();
function node(id){
 if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,
 querySelectorAll:q=>q==='.adminSettingsGroup'?groups:q==='[data-admin-select]'?cards:[],
 querySelector(){return {hidden:false}},setAttribute(k,v){this[k]=v},
 scrollIntoView(){this.scrolled=true},focus(){}});
 return elements.get(id);
}
const root=node('adminCenter');
root.querySelectorAll=q=>q==='.adminSettingsGroup'?groups:q==='[data-admin-select]'?cards:[];
node('adminToolsPanel').querySelectorAll=q=>q==='.adminToolGrid>button'?tools:[];
const ctx=vm.createContext({role:'admin',window:{},document:{getElementById:node}});
vm.runInContext(code,ctx);const api=ctx.window.FirstHyundaiAdminNavigator;
assert.equal(node('adminCategoryGrid').hidden,false,'Show 6 cards by default');
assert(groups.every(g=>g.hidden),'No expanded settings in default hub');
assert.equal(node('adminPeoplePanel').hidden,true,'No long account panel in home');
assert(api.filter('memo')&&groups[3].hidden===false&&groups.filter((g,i)=>i!==3).every(g=>g.hidden),
 'Memo category must not show unrelated settings');
assert.equal(node('adminCategoryGrid').hidden,true);
assert(api.filter('people')&&node('adminPeoplePanel').hidden===false,
 'People category must show accounts');
assert.equal(tools[1].hidden,false,'People category shows existing security tool');
assert.equal(tools[0].hidden,true,'People must not show API tools');
assert(api.filter('data')&&node('adminFeedsPanel').hidden===false&&node('adminSharedSettingsPanel').hidden===false,
 'Data category must show feeds and shared settings');
assert(api.filter('tools')&&tools[2].hidden===false&&tools[0].hidden===true,
 'Tools category must show updates without API settings');
assert(api.search('포스트잇')&&groups.filter(g=>!g.hidden).length===1,
 'Memo search must find memo controls without opening unrelated groups');
assert(api.clear()&&groups.every(g=>g.hidden)&&node('adminCategoryGrid').hidden===false,
 'Clear returns to six-card hub');
assert(api.jump('memo')&&groups[3].open&&groups[3].scrolled);
assert(api.jump('feeds')&&node('adminFeedsPanel').scrolled);
ctx.role='family';assert.equal(api.search('secret'),false);assert.equal(api.filter('people'),false);
console.log('PASS admin 6-category dashboard, focused panels, search, navigation and family access guards.');
