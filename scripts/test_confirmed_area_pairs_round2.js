'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/complexes.json'),'utf8'));
const rows=catalog.records.filter(x=>!x.aggregate_only);
assert.equal(catalog.records.length,95);
assert.equal(rows.length,93);
assert.ok(rows.filter(x=>x.area_type_pairs?.length).length>=70,'Keep first 70 completed complexes');
const list={
 'kapt-a40673903':7,'verified-extra-02':8,'verified-extra-03':6,
 'kapt-a40673923':5,'kapt-a40673922':6,'kapt-a10020527':3,
 'kapt-a10022954':7,'kapt-a40673916':6,'kapt-a40673920':18,
 'verified-extra-04':8,'kapt-a10022964':6,'kapt-a10020712':9,
 'kapt-a10020539':6,'verified-extra-08':2,
 'kapt-a10020270':7,'verified-extra-01':7,'verified-extra-10':5,
 'kapt-a10021000':19,'kapt-a10022353':5
};
let count=0;
for(const [id,size] of Object.entries(list)){
 const p=rows.find(x=>x.id===id);
 assert.ok(p,id+' exists');
 assert.equal(p.area_type_pairs.length,size,'All individually sourced types '+id);
 assert.equal(p.area_type_pairs_precision,'published_original_0.001m2');
 assert.match(p.area_type_pairs_source,/^https:\/\/aptgin\.com\/home\/popup\/pp_danji\/apt\/am\d+em\d+$/);
 assert.equal(p.area_type_pairs_checked_at,'2026-10-20');
 const seen=new Set();
 for(const t of p.area_type_pairs){
  assert.ok(Number.isFinite(t.supply_m2)&&Number.isFinite(t.exclusive_m2));
  assert.ok(t.supply_m2>=t.exclusive_m2&&t.exclusive_m2>=15&&t.supply_m2<=500);
  assert.match(t.supply_label,/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,5}$/);
  assert.equal(t.source_url,p.area_type_pairs_source);
  assert.ok(!seen.has(t.supply_label),'No subtype duplicated: '+id+' '+t.supply_label);
  seen.add(t.supply_label);
 }
 count+=size;
}
// Explicitly exclude O/T rows and type ranges which don't distinguish per-subtype areas.
const ar=rows.find(x=>x.id==='kapt-a10020712');
assert.equal(ar.area_type_pairs.find(x=>x.supply_label==='113A').exclusive_m2,84.2);
assert.ok(!ar.area_type_pairs.some(x=>x.supply_label.startsWith('190')));
const xi=rows.find(x=>x.id==='kapt-a10021000');
assert.ok(!xi.area_type_pairs.some(x=>['118A1','118B','140C','140T1'].includes(x.supply_label)),
 'Merged source rows must not masquerade as separate A/B units');
const ivy=rows.find(x=>x.id==='kapt-a10022353');
assert.equal(ivy.area_type_pairs.find(x=>x.supply_label==='84A').supply_m2,84.179);
assert.equal(count,140);
console.log('PASS: 19 additional directly sourced complexes, 140 pair records, 70/93 coverage.');
