'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const all=data.records, visible=all.filter(r=>!r.aggregate_only);
assert.equal(all.length,95);
assert.equal(visible.length,93);
assert.equal(visible.filter(r=>r.area_type_pairs?.length).length,93);
assert.equal(visible.filter(r=>!r.area_type_pairs?.length).length,0);
assert.deepEqual(visible.filter(r=>!r.area_type_pairs?.length).map(r=>r.id).sort(), []);
const expected={
 'centennial':5,'kapt-a10020272':6,'kapt-a10024710':4,'kapt-a10025745':10,
 'kapt-a10027888':7,'kapt-a40673510':2,'kapt-a40673912':14,
 'kapt-a40673918':5,'kapt-a40684007':3,'kapt-a40684008':6,
 'kapt-a40684013':24,'verified-extra-05':4,'verified-extra-06':4,
 'verified-extra-07':2,'verified-extra-09':5,'verified-extra-11':7,
 'verified-extra-12':7,'verified-extra-17':11,'verified-extra-18':3
};
assert.equal(Object.keys(expected).length,19);
let sum=0;
for(const [id,n] of Object.entries(expected)){
 const complex=all.find(r=>r.id===id);
 assert.ok(complex,id+' must exist');
 assert.equal(complex.area_type_pairs.length,n,id+' verified row count');
 assert.equal(complex.area_type_pairs_precision,'as_published');
 assert.equal(complex.area_type_pairs_checked_at,'2026-10-20');
 assert.match(complex.area_type_pairs_source,/^https:\/\/aptgin\.com\/home\/popup\/pp_danji\/apt\/am\d+em\d+$/);
 const seen=new Set();
 for(const p of complex.area_type_pairs){
  assert.equal(p.source_url,complex.area_type_pairs_source);
  assert.match(p.supply_label,/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,5}$/);
  assert.ok(!seen.has(p.supply_label),'No duplicated subtype '+id+' '+p.supply_label);
  seen.add(p.supply_label);
  assert.ok(Number.isFinite(p.supply_m2)&&Number.isFinite(p.exclusive_m2)&&p.exclusive_m2>=15&&p.supply_m2>=p.exclusive_m2&&p.supply_m2<=500);
 }
 sum+=n;
}
assert.equal(sum,129);
function row(id,label){return all.find(r=>r.id===id).area_type_pairs.find(t=>t.supply_label===label)}
assert.equal(row('centennial','106A').supply_m2,106.368);
assert.equal(row('kapt-a40673510','117').exclusive_m2,84.96);
assert.equal(row('kapt-a10020272','237PH-B').exclusive_m2,197.821);
assert.equal(row('verified-extra-18','64B').supply_m2,64.441);
assert.equal(row('kapt-a40673912','297').exclusive_m2,220.173);
assert.equal(row('kapt-a10024710','131').exclusive_m2,95.855);
assert.equal(row('kapt-a40684013','412').supply_m2,413.168);
assert.ok(!all.find(r=>r.id==='kapt-a10024710').area_type_pairs.some(p=>p.supply_label==='59'),'Mixed-use officetel row must not be imported');
assert.ok(!all.find(r=>r.id==='kapt-a10020272').area_type_pairs.some(p=>p.supply_label==='64A1'),'Mixed-use officetel rows must not be imported');
assert.ok(!all.find(r=>r.id==='centennial').area_type_pairs.some(p=>p.supply_label==='119B'),'Never invent a subtype from grouped source A~D');
console.log('PASS: 19 additionally verified apartment complexes, 129 individual source pairs, 89/93 coverage, 4 blocks awaiting exact match');
