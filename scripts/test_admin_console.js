'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'admin-center.js'),'utf8');
const css=fs.readFileSync(path.join(root,'admin-center.css'),'utf8');
new vm.Script(js);
for(const id of ['adminCenter','adminFeeds','adminAttention','adminFreshnessLevel','adminAuditHistory','adminReportFallback','adminConnectionState'])
 assert(html.includes('id="'+id+'"'),'Missing real console control '+id);
assert(html.includes("switchPage(role==='admin'?'adminCenter':'nearby')"));
assert(html.includes("const PRIVATE_PAGES=new Set(['settings','notes','security','apiGuide','adminCenter'])"));
assert(css.includes('#adminCenter .adminFeedDetail'));
const nodes=new Map(),store=new Map(),actions=[];
function el(id){
 if(!nodes.has(id))nodes.set(id,{id,textContent:'',innerHTML:'',className:'',value:'',open:false,hidden:true,
  click(){this.clicked=(this.clicked||0)+1},scrollIntoView(){},focus(){},select(){}});
 return nodes.get(id);
}
let fakeNow=Date.parse('2026-10-25T10:00:00+09:00');
const native={getInstalledAppVersion:()=> '2.0.94'};
const ctx=vm.createContext({
 document:{getElementById:el},window:{FirstHyundaiNative:native},navigator:{onLine:true},
 role:'admin',remote:{
 trades:{state:'ok',checked_at:'2026-10-25T08:00:00+09:00',records:[{type:'매매',building:'A',contract_date:'2026-10-24'}]},
 new_trades:{state:'partial',checked_at:'2026-10-25T08:00:00+09:00',errors:[],records:[]},
 news:{state:'ok',checked_at:'2026-10-25T08:00:00+09:00',briefs:[{title:'기사'}]},
 complexes:{state:'verified_partial',updated_at:'2026-10-20',records:[{id:'a',label:'A'}]}},
 publicServices:{
 office_sales:{state:'verified',updated_at:'2026-10-25T08:00:00+09:00',records:[]},
 office_rents:{state:'awaiting_approval'},
 subscriptions:{state:'verified',updated_at:'2026-10-25T08:00:00+09:00',records:[]},
 schools:{state:'verified',updated_at:'2026-10-25T08:00:00+09:00',records:[{name:'학교'}]}},
 issues:{trades:'',new_trades:'',news:'',complexes:''},
 repository:'public/repository',number:n=>Number(n).toLocaleString('ko-KR'),
 compactTradeCollectedAt:s=>s,installedAppVersionLabel:()=> '설치 버전 v2.0.94',
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 Date,confirm:()=>true,refreshAll:async()=>[{ok:true}],refreshOne:async()=>({ok:true}),
 refreshPublicServices:async()=>{},switchPage:p=>actions.push(p)
});
vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiAdminCenter;
assert(api,'API bound to window');
assert(el('adminFeeds').innerHTML.includes('오피스텔 전월세'));
assert(el('adminFeeds').innerHTML.includes('연동 대기'));
assert(el('adminAttention').innerHTML.includes('일부 오류'));
assert(el('adminFeeds').innerHTML.includes('0건 게시'),'Verified empty source is zero');
assert(el('adminSystemStatus').textContent.includes('점검 필요'));
assert(!api._test.reportText().includes('public/repository'),'Report must omit repository');
assert(!api._test.reportText().includes('contract')&&!api._test.reportText().includes('API KEY'));
assert.equal(api._test.ageHours('2026-10-25T08:00:00+09:00',fakeNow),2);
assert.equal(api._test.qualityIssues([{type:'매매',building:'A',contract_date:'2026-10-24'},{type:'전세'}],'trades'),1);
const stale=api._test.classify(ctx.remote.news,'','news',fakeNow+11*3600000);
assert.equal(stale.label,'갱신 지연');
const future=api._test.classify(ctx.remote.news,'','news',fakeNow-6*3600000);
assert.equal(future.label,'시각 점검');
api.levelChanged('relaxed');
assert.equal(store.get('firsthyundai-admin-freshness-v1'),'relaxed');
assert.equal(api._test.classify(ctx.remote.news,'','news',fakeNow+11*3600000).tone,'ok');
api.resetLevel();
assert.equal(store.has('firsthyundai-admin-freshness-v1'),false);
api.go('trades');assert.equal(actions[0],'trades');
api.go('unknown');assert.equal(actions.length,1,'Unknown source cannot navigate');
api.expand('office_rents');
assert(el('adminFeeds').innerHTML.includes('open ontoggle'),'Requested details must open');
api.selfTest();assert(el('adminSelfTestResult').textContent.includes('기본 화면 10곳'));
api.detailsChanged(true);assert.equal(store.get('firsthyundai-admin-developer-expanded'),'1');
let checks=0;
ctx.refreshOne=async k=>{checks++;return {ok:true}};
ctx.refreshAll=async()=>{checks++;return [{ok:true}]};
ctx.refreshPublicServices=async()=>{checks++};
(async()=>{
 await api.retry('news');
 assert.equal(checks,1);
 await api.retry('office_rents');
 assert.equal(checks,2);
 await api.refresh();assert.equal(checks,4);
 assert(el('adminAuditHistory').innerHTML.includes('전체 점검'));
 assert(JSON.parse(store.get('firsthyundai-admin-audit-v1')).length>=3);
 api.checkUpdate();assert.equal(el('appUpdateCheck').clicked,1);
 await api.copyReport();assert.equal(el('adminReportFallback').hidden,false,'Selectable fallback when clipboard unavailable');
 assert(el('adminReportFallback').value.includes('시스템 진단 요약'));
 api.clearAudit();assert.equal(store.has('firsthyundai-admin-audit-v1'),false);
 ctx.role='family';await api.refresh();await api.retry('trades');api.levelChanged('strict');
 assert.equal(checks,4,'Family cannot invoke administrator actions');
 assert.equal(store.has('firsthyundai-admin-freshness-v1'),false);
 console.log('Extended administrator console checks passed: freshness, filters, alerts, audit, per-source refresh, report privacy and role guards.');
})().catch(e=>{console.error(e);process.exitCode=1});