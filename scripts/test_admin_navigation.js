'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const code=fs.readFileSync(path.join(dir,'admin-settings-navigator.js'),'utf8');
new vm.Script(code);
for(const id of ['adminCenter','adminControlSearch','adminSearchResult','adminSearchClear','adminToolsPanel','adminSharedSettingsPanel','adminFeedsPanel'])
 assert(html.includes('id="'+id+'"'));
const groups=['view','view','trade','memo','trade'].map((category,i)=>{
 const row={hidden:false,textContent:i===3?'포스트잇 메모 갱신 주기':'거래와 글씨 설정',
 querySelector(){return {id:i===3?'adminMemoRefresh':'adminReadingSize'}}};
 return {dataset:{adminCategory:category},hidden:false,open:false,tagName:'DETAILS',
 querySelectorAll:q=>q==='.adminPrefRow,.adminAlertPref'?[row]:[],scrollIntoView(){this.scrolled=true}};
});
const tools=['API 연동','앱 업데이트'].map(textContent=>({hidden:false,textContent}));
const elements=new Map(),buttons=['all','view','trade','memo','tools'].map(c=>({dataset:{adminFilter:c},setAttribute(k,v){this[k]=v}}));
function node(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,
 querySelectorAll:q=>q==='.adminSettingsGroup'?groups:q==='.adminCategoryFilters button'?buttons:[],
 scrollIntoView(){this.scrolled=true},focus(){}});return elements.get(id)}
const root=node('adminCenter');root.querySelectorAll=q=>q==='.adminSettingsGroup'?groups:q==='.adminCategoryFilters button'?buttons:[];
node('adminToolsPanel').querySelectorAll=q=>q==='.adminToolGrid>button'?tools:[];
const ctx=vm.createContext({role:'admin',window:{},document:{getElementById:node}});
vm.runInContext(code,ctx);const api=ctx.window.FirstHyundaiAdminNavigator;
assert(api.search('포스트잇')&&groups.filter(g=>!g.hidden).length===1);
assert(api.clear()&&groups.every(g=>!g.hidden));
assert(api.filter('tools')&&groups.every(g=>g.hidden));
assert(api.jump('memo')&&groups[3].open&&groups[3].scrolled);
assert(api.jump('feeds')&&node('adminFeedsPanel').scrolled);
ctx.role='family';assert.equal(api.search('secret'),false);
console.log('Admin search, filters, category jumps and general-mode access checks passed.');