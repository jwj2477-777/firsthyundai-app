'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'admin-center.js'),'utf8');
const css=fs.readFileSync(path.join(root,'admin-center.css'),'utf8');
new vm.Script(js);
assert(html.includes('id="adminCenter" class="page hidden"'));
assert(html.includes("switchPage(role==='admin'?'adminCenter':'nearby')"));
assert(html.includes("const PRIVATE_PAGES=new Set(['settings','notes','security','apiGuide','adminCenter'])"));
assert(css.includes('#adminCenter .adminFeed'));
const nodes=new Map(),store=new Map();
function el(id){if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',className:'',open:false,
 click(){this.clicked=(this.clicked||0)+1},scrollIntoView(){}});return nodes.get(id)}
const ctx=vm.createContext({role:'admin',document:{getElementById:el},remote:{
 trades:{state:'ok',records:[{}]},new_trades:{state:'partial',records:[]},
 news:{state:'ok',briefs:[{}]},complexes:{records:[]}},
 publicServices:{office_sales:{state:'verified',records:[]},office_rents:{state:'awaiting_approval'},
 subscriptions:{state:'verified',records:[]},schools:{state:'verified',records:[]}},
 issues:{trades:'',new_trades:'',news:'',complexes:''},
 number:n=>Number(n).toLocaleString('ko-KR'),repository:'jwj2477-777/firsthyundai-app',
 compactTradeCollectedAt:x=>x,installedAppVersionLabel:()=> '설치 버전',
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 window:{FirstHyundaiNative:{}},Date,refreshAll:async()=>{},refreshPublicServices:async()=>{}});
vm.runInContext(js,ctx);
assert(el('adminFeeds').innerHTML.includes('오피스텔 전월세'));
assert(el('adminFeeds').innerHTML.includes('연동 대기'));
assert(el('adminSystemStatus').textContent.includes('점검 필요'));
ctx.issues.trades='수집 오류';vm.runInContext('FirstHyundaiAdminCenter.render()',ctx);
assert(el('adminFeeds').innerHTML.includes('조회 오류'));
vm.runInContext('FirstHyundaiAdminCenter.selfTest()',ctx);
assert(el('adminSelfTestResult').textContent.includes('기본 화면 10곳'));
vm.runInContext('FirstHyundaiAdminCenter.detailsChanged(true)',ctx);
assert.equal(store.get('firsthyundai-admin-developer-expanded'),'1');
let called=0;ctx.refreshAll=async()=>{called++};ctx.refreshPublicServices=async()=>{called++};
(async()=>{await vm.runInContext('FirstHyundaiAdminCenter.refresh()',ctx);
 assert.equal(called,2);
 vm.runInContext('FirstHyundaiAdminCenter.checkUpdate()',ctx);
 assert.equal(el('appUpdateCheck').clicked,1);
 ctx.role='family';await vm.runInContext('FirstHyundaiAdminCenter.refresh()',ctx);
 assert.equal(called,2);console.log('Admin console tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
