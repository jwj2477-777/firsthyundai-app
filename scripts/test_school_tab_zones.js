// School tab: original-precision 학구도 (10 m), school names, joint-zone choices, middle-school group.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const start=html.indexOf('function verifiedSchoolZoneReference');
const end=html.indexOf('\n}',start)+2;
const ctx=vm.createContext({});vm.runInContext(html.slice(start,end),ctx);
const ok=ctx.verifiedSchoolZoneReference;
const base={kind:'elementary_zone_reference',method:'verified_exact_kakao_road_address',zone_id:'Z000106155',
 zone_name:'인천예송초통학구역',reference_date:'2026-09-20'};
assert.equal(ok({...base,boundary_clearance_m:40},'2026-09-20'),true,'Legacy records (no marker) keep the 35 m rule');
assert.equal(ok({...base,boundary_clearance_m:20},'2026-09-20'),false,'Legacy 20 m is not enough');
assert.equal(ok({...base,boundary_clearance_m:20,min_required_clearance_m:10},'2026-09-20'),true,'Original precision: 10 m rule');
assert.equal(ok({...base,boundary_clearance_m:9,min_required_clearance_m:10},'2026-09-20'),false);
assert.equal(ok({...base,boundary_clearance_m:5,min_required_clearance_m:3},'2026-09-20'),false,'Unknown markers fall back to 35 m');
assert.equal(ok({...base,boundary_clearance_m:50},'2026-03-01'),false,'Reference date must match');
for(const text of ['초등학교 · 공식 통학구역','초등학교 · 공동통학구역','중학교 · 공식 학교군',
  '중학교는 학교군 안의 여러 학교 중에서 배정됩니다','x.kind===\'middle_school_group\'','schoolNames(match.schools)'])
 assert(html.includes(text),'Missing school tab element: '+text);
// Real data (if refreshed) must keep favorites resolved and never invent a single school for a joint zone.
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/school_districts.json'),'utf8'));
for(const r of data.zone_review?.records||[]){
 if(r.reason==='joint_zone')assert(!data.elementary_zones.records.some(x=>x.complex_id===r.complex_id),'Joint zone never single-assigned');
}
console.log('School tab zones passed: 10 m original-precision rule, legacy 35 m, school names, joint choices, middle group.');
