// End-to-end regression simulation of admin-local catalog drafts and public family view.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
const editor=''; // editor functions are embedded in the WebView HTML script
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
new vm.Script(script);
assert(script.includes('function exportComplexCatalog()'));
const elements=new Map(),storage=new Map(),alerts=[];
function elt(id){
 if(!elements.has(id)){
  const classes=new Set(id==='complexAdmin'?['hidden']:[]);
  elements.set(id,{
   value:'',textContent:'',innerHTML:'',options:[{}],open:false,
   classList:{toggle(n,yes){if(yes)classes.add(n);else classes.delete(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);}},
   scrollIntoView(){},reset(){},showModal(){this.open=true;},close(){this.open=false;}
  });
 }
 return elements.get(id);
}
const data={
 'complexes.json':catalog,
 'trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'new_trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'news.json':{schema_version:1,state:'ok',briefs:[],checked_at:'2026-10-19T00:00:00Z'}
};
let exported=null;
const bridge={
 getMode(){return 'admin';},
 fetch(repository,filename,id){window.onFirstHyundaiResult({requestId:id,ok:true,payload:data[filename]});},
 saveCatalog(content){exported=content;}
};
const window={FirstHyundaiNative:bridge};
const context=vm.createContext({
 window,document:{getElementById:elt},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 alert:x=>alerts.push(x),confirm:()=>true,console,Date,URL:{},Blob:{}
});
vm.runInContext(script,context);
(async()=>{
 for(let i=0;i<25;i++)await Promise.resolve();
 const evalJS=q=>vm.runInContext(q,context);
 assert(evalJS('catalogRows().length')>=13);
 assert.equal(evalJS("catalogRows().find(x=>x.id==='f15').households"),872);
 evalJS("switchPage('complexes')");
 assert.equal(elt('complexAdmin').classList.contains('hidden'),false,'Admin editor is visible to authenticated admin');
 evalJS('openComplexEditor()');
 assert.equal(elt('complexEditor').open,true);
 elt('complexHouseholds').value='873';
 elt('complexFloorplans').value='84A | javascript:alert(1)';
 assert.throws(()=>evalJS('saveComplexDraft()'),/HTTPS/, 'Untrusted plan links rejected');
 elt('complexFloorplans').value='';
 assert.equal(evalJS('saveComplexDraft()'),true);
 assert.equal(evalJS("catalogRows().find(x=>x.id==='f15').households"),873,'Draft changes admin preview');
 assert.equal(catalog.records.find(x=>x.id==='f15').households,872,'Published source not mutated by draft');
 evalJS('exportComplexCatalog()');
 assert(exported?.includes('"households": 873'),'Android JSON export saves approved changes');
 const result=JSON.parse(exported);
 assert(result.records.length>=13);
 assert.equal(result.records.find(x=>x.id==='f15').households,873);
 assert.equal(result.records.find(x=>x.id==='f15').aliases[0],'송도더샵퍼스트파크F15BL');
 evalJS("window.onRoleChanged('family')");
 assert.equal(evalJS("catalogRows().find(x=>x.id==='f15').households"),872,'Unpublished admin draft must NOT be shown to family');
 assert.equal(elt('complexAdmin').classList.contains('hidden'),true);
 assert(!elt('nav').innerHTML.includes('보안 관리'));
 exported=null;evalJS('exportComplexCatalog()');assert.equal(exported,null,'Family cannot export catalog');
 assert(storage.has('firsthyundai-catalog-drafts-v14'),'Local draft persisted for admin before GitHub publication');
 console.log('Catalog editor v1.4 passed: JSON export, admin draft visibility, public family isolation, URL validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
