'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const rows=new Map(data.records.map(x=>[x.id,x]));
assert.equal(rows.size,data.records.length);
const audited={
 'kapt-a40684004':{count:3,one:['107',107.6,84.89]},
 'kapt-a10025886':{count:5,one:['95B-1',95.51,70.23]},
 'kapt-a10020744':{count:18,one:['116E',116.67,84.99]},
 'kapt-a10022395':{count:1,one:['156',156.812,131.76]}
};
let total=0;
for(const [id,{count,one}] of Object.entries(audited)){
 const row=rows.get(id);
 assert.ok(row,id+' apartment exists');
 assert.equal(row.area_type_pairs.length,count,id+' matched pair count');
 assert.equal(row.supply_type_labels.length,count,id+' supply label count');
 const seen=new Set();
 for(const p of row.area_type_pairs){
   assert.ok(p.exclusive_m2>0&&p.supply_m2>=p.exclusive_m2);
   assert.match(p.source_url,/^https:\/\//);
   assert.match(p.supply_label,/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z0-9-]{0,5}$/);
   const key=p.supply_label+':'+p.exclusive_m2+':'+p.supply_m2;
   assert.ok(!seen.has(key),'duplicate supply-exclusive mapping '+id+key);
   seen.add(key);
 }
 const match=row.area_type_pairs.find(p=>p.supply_label===one[0]&&
    Math.abs(p.supply_m2-one[1])<.005&&Math.abs(p.exclusive_m2-one[2])<.005);
 assert.ok(match,id+' has exact original listing values');
 assert.ok(row.area_type_pairs_checked_at,'source audit date present');
 total+=count;
}
assert.equal(total,27);
assert.match(html,/complexPairList/);
assert.match(html,/complexPairTable/);
assert.match(html,/<th scope="col">타입<\/th>/);
assert.match(html,/<th scope="col">공급면적<\/th>/);
assert.match(html,/<th scope="col">전용면적<\/th>/);
assert.match(html,/<th scope="col">평형<\/th>/);
assert.match(html,/v\.supply_m2>=v\.exclusive_m2/);
assert.match(html,/source_url\|\|p\.area_type_pairs_source/);
assert.match(html,/pairSources=\[\.\.\.new Set/);
assert.doesNotMatch(html,/complexTypeCard/,'No tall card per subtype');
assert.doesNotMatch(html,/complexTypeValues/,'No duplicated area values');
assert.doesNotMatch(html,/complexTypeRooms/,'Compact listing only contains four fields');
assert.doesNotMatch(html,/complexTypeSource/,'No per-row links');
assert.match(html,/평형은 공급면적을 기준으로 환산한 참고값입니다/);
const artwin=data.records.find(x=>x.id==='artwin');
assert.ok(artwin?.area_type_pairs?.length>=5);
for(const label of ['120B','120B-H','120B-S','121A','121A-H']){
 assert.ok(artwin.area_type_pairs.some(x=>x.supply_label===label),'Preserve separately verified subtype '+label);
}
const fav=['f13','f14','f15','m21','m22','m23','avenue','centennial','prime20','prime25','skcentral','artwin','central3'];
for(const id of fav)assert.ok(rows.has(id));
console.log('Verified 27 source-backed pairs across four complexes; no duplicates.');
