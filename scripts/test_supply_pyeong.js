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
assert(paired.length>=12,'Retain twelve apartment-source private/supply paired profiles');
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
assert(count>=67,'Expected 67 area labels with verified pairings');
const centennial=rows.find(p=>p.id==='centennial');
assert.equal(centennial.exclusive_plan_labels.length,7);
assert(centennial.exclusive_plan_source_url.startsWith('https://'));
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>',2)[1].split('</script>',1)[0];
new vm.Script(script);
assert(script.includes('const exclusiveAreas='),'Every apartment needs visible exclusive-size options');
assert(script.includes('공급평형 확인 중'),'Unknown supply types must never be faked');
assert(script.includes('실거래 관측'),'Users must understand observed trade sizes are not complete legal types');
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
assert.equal(get("displayExclusiveArea(84.9,apt_f13)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("displayExclusiveArea(84.9,apt_f14)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("displayExclusiveArea(84.9,apt_f15)"),'전용 84.9㎡ (약 35평형)');
assert.equal(get("displayExclusiveArea(84.65,apt_skcentral)"),'전용 84.65㎡ (약 33평형)');
assert.equal(get("displayExclusiveArea(84.98,apt_artwin)"),'전용 84.98㎡ (약 37평형)');
assert.equal(get("displayExclusiveArea(80.05,apt_central3)"),'전용 80.05㎡ (약 34평형)');
const pOther=rows.find(x=>x.id==='kapt-a10020270');
env.unknown=pOther;
assert.equal(get("displayExclusiveArea(84.9,unknown)"),'전용 84.9㎡','Never invent supply pyeong for unverified area');
assert.equal(get("displaySupplyType(apt_artwin,'120B')"),'전용 84.98㎡ (약 37평형) · 공급 120B㎡');
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
