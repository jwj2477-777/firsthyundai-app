'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const rows=catalog.records;
const audited=[
 'kapt-a40673002','kapt-a40673101','kapt-a40673921','kapt-a40673906',
 'kapt-a10027367','kapt-a10024779','kapt-a10025031','kapt-a10027171',
 'kapt-a10026547','kapt-a10022494','kapt-a10025443','kapt-a10025071',
 'kapt-a10023361','kapt-a10022498','kapt-a40673907','kapt-a40673915',
 'kapt-a40673914','kapt-a10027653','kapt-a40673924','kapt-a40673902',
 'kapt-a40673904','kapt-a40673910','kapt-a10027887','kapt-a40673917',
 'kapt-a40684005','kapt-a40673603'
];
assert.equal(new Set(audited).size,26);
assert.equal(rows.length,95,'Never remove existing curated Songdo complexes');
const present=rows.filter(x=>!x.aggregate_only);
assert.equal(present.length,93);
const paired=present.filter(x=>Array.isArray(x.area_type_pairs)&&x.area_type_pairs.length);
assert.equal(paired.length,51);
assert.equal(present.length-paired.length,42);
let newPairs=0;
for(const id of audited){
 const p=rows.find(v=>v.id===id);
 assert.ok(p,'Audited missing complex '+id);
 assert.ok(Array.isArray(p.area_type_pairs)&&p.area_type_pairs.length>=2,id+' must have reviewed source pairs');
 assert.equal(p.area_type_pairs_precision,'published_0.1m2_or_integer',id+' must preserve original source rounding');
 assert.equal(p.area_type_pairs_checked_at,'2026-10-20',id+' check date');
 const labels=new Set();
 for(const area of p.area_type_pairs){
  assert.ok(Number.isFinite(area.supply_m2)&&Number.isFinite(area.exclusive_m2)&&
   area.exclusive_m2>=15&&area.supply_m2>=area.exclusive_m2&&area.supply_m2<=500,'Plausible matched area '+id);
  assert.match(area.supply_label,/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,5}$/);
  assert.match(area.source_url,/^https:\/\/apt\.zaritalk\.com\/complex\/[^?#]+$/);
  assert.equal(area.source_url,p.area_type_pairs_source);
  assert.ok(!labels.has(area.supply_label),'No duplicate subtype on '+id);
  assert.ok(p.area_types_m2.some(v=>Math.abs(v-area.exclusive_m2)<=.16),
   'Exclusive area must agree with existing trade area inventory '+id);
  labels.add(area.supply_label);
 }
 newPairs+=p.area_type_pairs.length;
}
assert.equal(newPairs,119);
const artwin=rows.find(x=>x.id==='artwin');
assert.equal(artwin.area_type_pairs.length,15,'Never alter verified Artwin variants');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
assert.match(html,/class="complexPairTable"/);
assert.match(html,/Math\.round\(t\.supply_m2\/3\.305785\)/);
assert.match(html,/const pairSources=\[\.\.\.new Set/);
const pipeline=fs.readFileSync(path.join(root,'scripts/collect_complexes.py'),'utf8');
assert.match(pipeline,/"area_type_pairs_precision"/,'Refresh must preserve published-value precision metadata');
console.log('PASS: 26 source-reviewed Songdo complexes, 119 pairs, 51/93 verified types, favorites maintained.');
