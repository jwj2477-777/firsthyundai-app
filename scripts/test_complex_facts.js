// v1.6.1 — Completeness and provenance checks for 13 verified Songdo apartment profiles.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const obj=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
assert(obj.records.length>=13);
const rows=obj.records.filter(x=>x.catalog_source!=='kapt'&&x.catalog_source!=='reference_verified');
assert.equal(rows.length,13,'All thirteen manually checked profiles must remain');
assert.equal(new Set(rows.map(x=>x.id)).size,13);
const required=['households','buildings','approved_date','parking_total','floors','floor_area_ratio',
 'building_coverage_ratio','address','builder','management_phone','ev_chargers','source_url'];
for(const row of rows){
 for(const key of required)assert(row[key]!==undefined&&row[key]!==null&&row[key]!=='' ,row.id+' missing '+key);
 assert(Number.isSafeInteger(row.households)&&row.households>0);
 assert(Number.isSafeInteger(row.buildings)&&row.buildings>0);
 assert(/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(row.approved_date));
 assert(Number.isSafeInteger(row.parking_total)&&row.parking_total>0);
 assert(Number.isSafeInteger(row.ev_chargers)&&row.ev_chargers>=0);
 assert(/^032-[0-9]{3,4}-[0-9]{4}$/.test(row.management_phone));
 assert(/^https:\/\//.test(row.source_url));
 assert(row.address.includes('연수구'),row.id+' has unexpected geographic address');
 if(row.id!=='f13'){
  assert(/^A[0-9]{8}$/.test(row.kapt_code),row.id+' has unknown K-apt complex id');
  assert.equal(row.detail_source_url,'https://apt.hilite.co.kr/apt/'+row.kapt_code+'/');
  assert.equal(row.detail_checked_at,'2026-10-19');
 }
 if(row.parking_alt_total!==undefined&&row.parking_alt_total!==null){
  assert(row.parking_alt_total>0 && row.parking_alt_total!==row.parking_total);
  assert(row.detail_note.includes('출처 불일치'));
 }
}
const p13=rows.find(x=>x.id==='f13'),m23=rows.find(x=>x.id==='m23'),c3=rows.find(x=>x.id==='central3');
assert.equal(p13.ev_chargers,14,'Preserve 13BL EV figure directly supplied by user');
assert.equal(p13.management_phone,'032-834-8996');
assert.equal(m23.heating,'지역난방','User supplied Naver screenshot confirms displayed heating as regional');
assert.equal(m23.heating_detail,'지역난방 / 열병합');
assert(m23.detail_note.includes('중앙난방') && m23.detail_note.includes('지역난방'));
assert(c3.detail_note.includes('층수 출처 불일치'));
assert.equal(rows.filter(x=>x.parking_alt_total!=null).length,4,'Four parking counts need manual K-apt reconciliation');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
assert(js.includes('자료 차이·확인사항 보기'),'Conflicts must be visible in the app');
assert(js.includes('parking_alt_total:p.parking_alt_total??null'),'Export must preserve alternate source amounts');
assert(js.includes('K-apt 기반 기본정보'),'Users need source link for K-apt figures');
console.log('Verified 13-complex completion, four parking conflicts, heating uncertainty and visible audit links');
