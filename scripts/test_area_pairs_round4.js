'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const independent=doc.records.filter(x=>!x.aggregate_only);
assert.equal(independent.length,93);
assert.ok(independent.every(x=>x.area_type_pairs?.length>=1),'All 93 separate apartments need at least one matched type');
const final={
 'verified-extra-13':{
   title:'인천송도힐스테이트3단지',address:'컨벤시아대로 70',households:118,
   url:'https://aptapp.co.kr/chart/28185106/136541/137418/',
   types:[['154A3',154.85,131.365],['160',160.225,135.925],['167A3',167.536,142.128],['167B3',167.809,142.359],['282',282.582,239.72]]},
 'verified-extra-14':{
   title:'인천송도힐스테이트4단지',address:'컨벤시아대로 80',households:118,
   url:'https://aptapp.co.kr/chart/28185106/136542/137421/',
   types:[['154',154.461,131.365],['167A',167.116,142.128],['167B',167.388,142.359],['199',199.954,170.055],['281',281.874,239.72]]},
 'verified-extra-15':{
   title:'인천송도힐스테이트5단지',address:'컨벤시아대로 90',households:118,
   url:'https://aptapp.co.kr/chart/28185106/136543/137427/',
   types:[['154',154.702,131.365],['167A',167.376,142.128],['167B',167.649,142.359],['200',200.265,170.055],['282',282.308,239.72]]},
 'verified-extra-16':{
   title:'인천송도힐스테이트6단지',address:'컨벤시아대로 100',households:122,
   url:'https://aptapp.co.kr/chart/28185106/136535/137382/',
   types:[['155',155.024,131.365],['167A',167.725,142.128],['167B',167.998,142.359],['204',204.506,173.295],['282',282.899,239.72]]}
};
const samples={};
for(const [id,expected] of Object.entries(final)){
 const item=independent.find(x=>x.id===id);
 assert.ok(item,id+' must exist');assert.equal(item.label,expected.title);
 assert.ok(item.address?.includes(expected.address));
 assert.equal(item.households,expected.households);
 assert.equal(item.area_type_pairs_source,expected.url);
 assert.equal(item.area_type_pairs_checked_at,'2026-10-20');
 assert.equal(item.area_type_pairs_precision,'published_original_0.001m2');
 assert.equal(item.area_type_pairs.length,expected.types.length);
 const labels=new Set();
 for(const [name,supply,exclusive] of expected.types){
   const pair=item.area_type_pairs.find(x=>x.supply_label===name);
   assert.ok(pair,'Required true type '+id+' '+name);
   assert.equal(pair.supply_m2,supply);
   assert.equal(pair.exclusive_m2,exclusive);
   assert.equal(pair.source_url,expected.url);
   assert.ok(supply>=exclusive&&exclusive>=15);
   assert.ok(!labels.has(name),'Duplicate subtype '+name);
   labels.add(name);
 }
 samples[id]=item.area_type_pairs.find(x=>x.exclusive_m2===142.128).supply_m2;
}
assert.equal(new Set(Object.values(samples)).size,4,'Each block must have its own supply value for 142.128m²');
console.log('PASS: four individual Songdo Hillstate blocks, 20 exact source pairs; 93/93 apartment profiles have paired types.');
