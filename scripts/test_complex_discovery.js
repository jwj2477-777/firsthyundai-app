// v1.5: Discover Songdo apartments from official transaction JSON, never scrape Naver.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'..','app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','data/complexes.json'),'utf8'));
const sales=[
 {building:'더샵송도프라임뷰20BL',area_m2:84.95,contract_date:'2026-10-01',type:'매매',amount_10k:79000},
 {building:'더샵송도프라임뷰25BL',area_m2:101.5,contract_date:'2026-10-02',type:'전세',deposit_10k:45000},
 {building:'송도테스트신규아파트',area_m2:84.999,contract_date:'2026-10-11',type:'매매',amount_10k:60000},
 {building:'송도테스트신규아파트',area_m2:84.996,contract_date:'2026-10-12',type:'전세',deposit_10k:40000},
 {building:'송도테스트신규아파트',area_m2:103.1,contract_date:'2026-10-13',type:'월세',deposit_10k:10000,monthly_10k:100}
];
const responses={
 'complexes.json':catalog,
 'trades.json':{schema_version:1,state:'ok',records:sales,checked_at:'2026-10-19T00:00:00Z'},
 'new_trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'news.json':{schema_version:1,state:'ok',briefs:[],checked_at:'2026-10-19T00:00:00Z'}
};
const elems=new Map();
function el(id){
 if(!elems.has(id)){
  const classes=new Set(id==='complexAdmin'?['hidden']:[]);
  elems.set(id,{value:'',textContent:'',innerHTML:'',options:[{}],open:false,
    classList:{toggle(n,yes){if(yes)classes.add(n);else classes.delete(n)},remove(n){classes.delete(n)},contains(n){return classes.has(n)}},
    scrollIntoView(){},reset(){},showModal(){this.open=true;},close(){this.open=false;}});
 }
 return elems.get(id);
}
const alerts=[],writes=[];
const window={FirstHyundaiNative:{getMode:()=> 'admin',saveCatalog:s=>writes.push(JSON.parse(s)),
 fetch:(repo,name,id)=>window.onFirstHyundaiResult({ok:true,payload:responses[name],requestId:id})}};
const store=new Map();
const ctx=vm.createContext({window,document:{getElementById:el},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 alert:m=>alerts.push(m),confirm:()=>true,console,Date,URL:{},Blob:{}});
vm.runInContext(js,ctx);
(async()=>{
 for(let k=0;k<25;k++)await Promise.resolve();
 const run=x=>vm.runInContext(x,ctx);
 assert.equal(run('catalogRows().length'),14,'New transaction-only apartment discovered without separate API key');
 const added=run("catalogRows().find(x=>x.label==='송도테스트신규아파트')");
 assert(/^trade-[0-9a-f]{8}$/.test(added.id));
 assert.equal(added.households,null,'Never invent unknown households');
 assert.equal(added.source_url,null,'Do not disguise public sale record as apartment facts source');
 run("switchPage('complexes')");
 assert(el('complexCards').innerHTML.includes('송도테스트신규아파트'));
 run("setComplexDetailTab('sources')");
 assert(el('complexDetails').innerHTML.includes('네이버페이 부동산'));
 el('complexScope').value='favorites';run('renderComplexes()');
 assert(!el('complexCards').innerHTML.includes('송도테스트신규아파트'));
 el('complexScope').value='all';run('renderComplexes()');
 run("selectComplex('"+added.id+"')");
 run("setComplexDetailTab('deals')");
 const h=el('complexDetails').innerHTML;
 assert(h.includes('전용 85㎡')&&h.includes('전용 103.1㎡'));
 run("setComplexDealType('매매')");
 assert(el('complexDetails').innerHTML.includes('1건')&&!el('complexDetails').innerHTML.includes('전용 103.1㎡'),
   'Trade filter only shows selected contract type');
 run("showComplexTrades('"+added.id+"',85,'매매')");
 assert.equal(run('currentPage'),'trades');
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>1건</b>'));
 assert(el('tradesContent').innerHTML.includes('6억'));
 run('clearTradeFocus()');
 assert(el('tradesContent').innerHTML.includes('검색 결과 <b>5건</b>'));
 run("switchPage('complexes')");
 run("selectComplex('"+added.id+"')");
 run('openComplexEditor()');
 el('complexSource').value='https://www.data.go.kr/';
 el('complexVerified').value='2026-10-19';
 el('complexHouseholds').value='200';
 el('complexNaver').value='https://example.com/complexes/1234';
 assert.throws(()=>run('saveComplexDraft()'),/네이버 단지 링크/,'Reject untrusted URL as Naver deep link');
 el('complexNaver').value='https://new.land.naver.com/complexes/123456';
 assert.equal(run('saveComplexDraft()'),true);
 assert(run("catalogRows().find(x=>x.label==='송도테스트신규아파트').naver_complex_url").includes('new.land.naver.com'));
 run('exportComplexCatalog()');
 assert.equal(writes.length,1);
 assert.equal(writes[0].records.length,14,'New apartment can be kept in durable public catalog');
 assert.equal(writes[0].records.find(x=>x.id===added.id).households,200);
 run("window.onRoleChanged('family')");
 assert.equal(run("catalogRows().find(x=>x.id==='"+added.id+"').households"),null,'Unpublished admin facts hidden from family');
 assert(el('complexAdmin').classList.contains('hidden'));
 console.log('v1.5 catalog discovery passed: no Naver scraping, area filter, admin verified draft, privacy');
})().catch(e=>{console.error(e);process.exitCode=1});
