// v1.6 regression: one-tap basic facts, no repeated area lines, verified school UI.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1]?.split('</script>')[0];
new vm.Script(js);
const complexes=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const f13=complexes.records.find(p=>p.id==='f13');
assert.equal(f13.ev_chargers,14);assert.equal(f13.management_phone,'032-834-8996');
assert.equal(f13.heating_detail,'지역난방 / 열병합');assert.equal(f13.buildings,5);
assert.equal(f13.parking_total,1233);assert.equal(f13.approved_date,'2017-11-17');
assert.equal(f13.households,856);assert.equal(f13.address,'인천광역시 연수구 컨벤시아대로252번길 70');
const java=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
assert(java.includes('Intent.ACTION_DIAL'),'Clicking office phone must open dial pad safely');
const els=new Map(),store=new Map(),saved=[];
function el(id){
 if(!els.has(id)){
  const set=new Set(id==='complexAdmin'?['hidden']:[]);
  els.set(id,{value:'',innerHTML:'',textContent:'',options:[{}],open:false,
   classList:{toggle(x,v){if(v)set.add(x);else set.delete(x)},remove(x){set.delete(x)},contains(x){return set.has(x)}},
   showModal(){this.open=true},close(){this.open=false},scrollIntoView(){},reset(){}});
 }
 return els.get(id);
}
const feeds={
 'complexes.json':complexes,
 'trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'new_trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'news.json':{schema_version:1,state:'ok',briefs:[],checked_at:'2026-10-19T00:00:00Z'}
};
const win={FirstHyundaiNative:{getMode:()=> 'admin',fetch:(repo,f,id)=>win.onFirstHyundaiResult({ok:true,requestId:id,payload:feeds[f]}),saveCatalog:t=>saved.push(JSON.parse(t))}};
const ctx=vm.createContext({window:win,document:{getElementById:el},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 alert(){},confirm:()=>true,console,URL:{},Date,Blob:{}});
vm.runInContext(js,ctx);
(async()=>{
 for(let i=0;i<25;i++)await Promise.resolve();
 const ev=q=>vm.runInContext(q,ctx);
 ev("switchPage('complexes')");ev("selectComplex('f13')");
 const basic=el('complexDetails').innerHTML;
 assert(basic.includes('856세대')&&basic.includes('1,233대'));
 assert(basic.includes('14대')&&basic.includes('2017-11-17'));
 assert(basic.includes('지역난방 / 열병합'));
 assert(basic.includes('tel:0328348996'));
 assert(!basic.includes('실거래 관측 전용면적'));
 assert(!basic.includes('확인된 전용면적 유형'));
 assert(!basic.includes('전용면적별 실거래 조회'),'Basic tab must not repeat per-area trades');
 assert((basic.match(/setComplexDetailTab\(/g)||[]).length===5,'Five accessible tap targets');
 ev("setComplexDetailTab('schools')");
 assert(el('complexDetails').innerHTML.includes('배정학교는 아직 검증되지 않았습니다'));
 ev('openComplexEditor()');
 assert.equal(el('complexEvChargers').value,14);
 assert.equal(el('complexManagerPhone').value,'032-834-8996');
 el('complexSchools').value='초등 | 예시학교 | 배정확인 | https://school.example.go.kr/zone';
 assert.equal(ev('saveComplexDraft()'),true);
 ev("setComplexDetailTab('schools')");
 assert(el('complexDetails').innerHTML.includes('예시학교'));
 assert(el('complexDetails').innerHTML.includes('배정학교 확인'));
 ev('exportComplexCatalog()');
 assert.equal(saved.length,1);
 const stored=saved[0].records.find(p=>p.id==='f13');
 assert.equal(stored.ev_chargers,14);
 assert.equal(stored.management_phone,'032-834-8996');
 assert.equal(stored.parking_total,1233);
 assert.equal(stored.schools[0].classification,'assigned');
 ev("window.onRoleChanged('family')");
 ev("switchPage('complexes')");ev("selectComplex('f13')");ev("setComplexDetailTab('schools')");
 assert(!el('complexDetails').innerHTML.includes('예시학교'),
  'Unpublished school assignment cannot leak to family mode');
 console.log('v1.6 simple UI, verified F13 facts, click-to-dial and school isolation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
