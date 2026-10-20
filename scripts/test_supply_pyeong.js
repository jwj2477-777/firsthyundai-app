// Regression: never label the EXCLUSIVE area as its pyeong-type.
// Apartment "pyeong-type" references source-verified SUPPLY areas only.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8')).records;
const rows=catalog.filter(p=>!p.aggregate_only);
const observed=rows.filter(p=>Array.isArray(p.area_types_m2)&&p.area_types_m2.length);
const paired=rows.filter(p=>Array.isArray(p.area_type_pairs)&&p.area_type_pairs.length);
assert(rows.length>=93,'All original 93 standalone Songdo apartment profiles must survive');
assert(observed.length>=93,'Source-backed exclusive types must survive for the original 93 profiles');
assert(paired.length>=20,'At least twenty source-matched exclusive/supply apartment profiles must survive');
assert(rows.filter(p=>p.supply_type_labels?.length).length>=49,'Retain at least 49 verified supply-type inventories');
let count=0;
for(const apt of observed){
 assert(apt.area_types_source?.includes('실거래'),apt.id+' exclusive type source needed');
 for(const exclusive of apt.area_types_m2){
  assert(Number.isFinite(exclusive)&&exclusive>=10&&exclusive<500,apt.id+' invalid observed exclusive size');
 }
 assert.equal(new Set(apt.area_types_m2).size,apt.area_types_m2.length,apt.id+' duplicated area');
 for(const p of apt.area_type_pairs||[]){
  assert(p.exclusive_m2>0&&p.supply_m2>p.exclusive_m2,apt.id+' wrong side of supply vs exclusive');
  assert(p.source_url?.startsWith('https://'),apt.id+' pairing needs primary web evidence');
  assert(apt.supply_type_labels.includes(p.supply_label),apt.id+' unmatched area label');
  count++;
 }
}
assert(count>=136,'Expected at least 136 source-verified exclusive/supply pairings');
const centennial=rows.find(p=>p.id==='centennial');
assert.equal(centennial.exclusive_plan_labels.length,7);
assert(centennial.exclusive_plan_source_url.startsWith('https://'));
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>',2)[1].split('</script>',1)[0];
new vm.Script(script);
assert(script.includes('const matchedTypes=canonicalAreaTypes(p)'),'Every building type list must use the deduplicated canonical paired types');
assert(!script.includes('const exclusiveAreas='),'Never separately list trade-exclusive observations as additional housing types');
assert(!script.includes('const supplyOnly='),'Never separately list the very same supply housing types');
assert(script.includes('한 주택형을 한 번만 표시합니다.'),'Clearly explain one record per home type');
assert(script.includes('추가 대조 대상'),'Unmatched inventories are counted, not represented as false extra types');
assert(script.includes('한 주택형을 한 번만 표시합니다.'),'Housing types must not be duplicated from separate area inventories');
assert(!script.includes('Math.round(g.area/3.305785)'),'Exclusive-to-pyeong shortcut forbidden');
const normalization=script.slice(script.indexOf('function normalizeAptName('),script.indexOf('const FAVORITE_MATCH='));
const funcs=script.slice(script.indexOf('function verifiedSupplyPairs('),script.indexOf('function displayComplexValue('));
const env={catalogRows:()=>rows,number:n=>String(n),console};
for(const id of ['f13','f14','f15','skcentral','artwin','central3']){
 const p=rows.find(x=>x.id===id);
 env['apt_'+id]=p;
}
vm.createContext(env);
vm.runInContext(normalization+funcs,env);
function get(expr){return vm.runInContext(expr,env);}
env.kb_skview=rows.find(x=>x.id==='kapt-a10025399');
env.kb_greenwalk=rows.find(x=>x.id==='kapt-a10027884');
env.kb_lake3=rows.find(x=>x.id==='kapt-a10022954');
env.kb_worldmark=rows.find(x=>x.id==='kapt-a10020270');
assert.equal(get("displayExclusiveArea(84.9,apt_f13)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("displayExclusiveArea(84.9,apt_f14)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("displayExclusiveArea(84.9,apt_f15)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("canonicalAreaTypes(apt_f15).length"),9,'F15 must list nine source-matched housing types only');
assert.equal(get("canonicalAreaTypes(apt_f15).filter(x=>x.supply_label==='88A').length"),1,'F15 88A supply/exclusive is one row');
assert.equal(get("canonicalAreaTypes(apt_f15).find(x=>x.supply_label==='88A').exclusive_m2"),59.89,'Naver 88A is exclusive 59.89, not 59.98');
assert.equal(get("canonicalAreaTypes(apt_f15).find(x=>x.supply_label==='87B').exclusive_m2"),59.98,'KB 87B is exclusive 59.98');
assert.equal(get("canonicalAreaTypes(apt_f15).find(x=>x.supply_label==='129B').supply_m2"),129.65,'KB exact 129B supply 129.65㎡');
assert.equal(get("canonicalAreaTypes(apt_f13).length"),7,'F13 seven distinct types');
assert.equal(get("canonicalAreaTypes(apt_f14).length"),6,'F14 only verified six pairs, no unpaired supply rows');

assert.equal(get("displayExclusiveArea(84.65,apt_skcentral)"),'전용 84.65㎡ (약 33평형)');
assert.equal(get("displayExclusiveArea(84.65,kb_skview)"),'전용 84.65㎡ (약 34평형)');
assert.equal(get("displayExclusiveArea(84.73,kb_greenwalk)"),'전용 84.73㎡ (약 34평형)');
assert.equal(get("displayExclusiveArea(84.57,kb_lake3)"),'전용 84.57㎡');
assert.equal(get("displaySupplyType(kb_worldmark,'233PH-A')"),'공급 233PH-A타입 (약 70평형) · 전용㎡ 대응 확인 중');
assert.equal(get("displaySupplyType(kb_lake3,'112D0')"),'공급 112D0타입 (약 34평형) · 전용㎡ 대응 확인 중');

assert.equal(get("displayExclusiveArea(84.98,apt_artwin)"),'전용 84.98㎡ (약 36평형)');
assert.equal(get("displayExclusiveArea(80.05,apt_central3)"),'전용 80.05㎡ (약 33평형)');
assert.equal(get("displaySupplyType(apt_central3,'111')"),'전용 80.05㎡ (약 33평형) · 공급 111㎡');
assert.equal(get("displaySupplyType(apt_artwin,'152')"),'전용 106.78㎡ (약 45평형) · 공급 152㎡');
const pOther=rows.find(x=>x.id==='kapt-a10020270');
env.unknown=pOther;
assert.equal(get("canonicalAreaTypes(unknown).length"),0,'No fictitious matching from standalone areas');
assert.equal(get("displayExclusiveArea(84.9,unknown)"),'전용 84.9㎡','Never invent supply pyeong for unverified area');
assert.equal(get("displaySupplyType(apt_artwin,'120B')"),'전용 84.98㎡ (약 36평형) · 공급 120B㎡');
assert.equal(get("displaySupplyType(apt_skcentral,'109B')"),'전용 84.78㎡ (약 33평형) · 공급 109B㎡');
function canonical(s){return String(s||'').normalize('NFKC').toUpperCase().replace(/[^0-9A-Z가-힣]/g,'').replace(/^송도/,'').replace(/아파트$/,'')}
const names=new Map();
for(const row of rows)for(const n of [row.label,...row.aliases||[]]){
 const k=canonical(n);
 if(!names.has(k))names.set(k,new Set());
 names.get(k).add(row.id);
}
for(const [key,ids] of names)assert.equal(ids.size,1,key+' multiple apartment blocks collide under normalized trade matching');
console.log('Verified exclusive observations for '+observed.length+' complexes and '+count+' exact supply/exclusive pairings; sales-filter pyeong guard passed.');
