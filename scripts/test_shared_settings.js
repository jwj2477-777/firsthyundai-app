'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../app/src/main/assets');
const pref=fs.readFileSync(path.join(root,'admin-preferences.js'),'utf8');
const shared=fs.readFileSync(path.join(root,'shared-settings.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
new vm.Script(pref);new vm.Script(shared);
for(const x of ['id="adminSharedSyncStatus"','id="adminSharedUpdatedAt"','shared-settings.js'])
 assert(html.includes(x),'Missing shared settings control '+x);
const elements=new Map(),store=new Map(),reads=[],writes=[];
function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',checked:false,open:false,focus(){},select(){}});return elements.get(id)}
const native={fetchSharedSettings:id=>reads.push(id),publishSharedSettings:(json,id)=>writes.push({json,id})};
let popup=true;
const ctx=vm.createContext({role:'family',document:{getElementById:el,body:{setAttribute(){}}},window:{
 FirstHyundaiNative:native,FirstHyundaiTradeAlerts:{enabled:()=>popup,setEnabled:x=>{popup=x}},
 addEventListener(){},setInterval(){}},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 setTimeout,clearTimeout,Date,Promise});
vm.runInContext(pref,ctx);vm.runInContext(shared,ctx);
assert.equal(reads.length,1);
const remote={schema:1,status:'ok',revision:'rev-one',updated_at:'2026-10-25T01:00:00Z',
 settings:{schema:1,type:'firsthyundai-ui-settings',preferences:{
 schema:1,start:'news',density:'compact',reading:'large',motion:'reduced',contrast:'high'},tradePopup:false}};
ctx.window.onFirstHyundaiSharedSettingsFetched({requestId:reads[0],ok:true,payload:remote});
(async()=>{
 await new Promise(r=>setTimeout(r,0));
 assert.equal(ctx.window.FirstHyundaiUIOptions.get().start,'news');
 assert.equal(popup,false,'Regular mode accepts shared popup policy');
 ctx.role='admin';
 assert(ctx.window.FirstHyundaiUIOptions.set('reading','standard'));
 await new Promise(r=>setTimeout(r,580));
 assert.equal(writes.length,1,'Admin change publishes to native bridge');
 assert.equal(JSON.parse(writes[0].json).preferences.reading,'standard');
 ctx.window.onFirstHyundaiSharedSettingsPublished({requestId:writes[0].id,ok:true,
  payload:{...remote,revision:'rev-two'}});
 await new Promise(r=>setTimeout(r,5));
 assert(el('adminSharedSyncStatus').textContent.includes('게시 성공'));
 ctx.role='family';
 assert.equal(ctx.window.FirstHyundaiUIOptions.set('reading','large'),false);
 console.log('Shared preferences: normal read, admin write, status and role restrictions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
