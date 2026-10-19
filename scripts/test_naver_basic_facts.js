// Cross-check the five user-supplied Naver Pay Real Estate screenshots (2026-10-19).
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const list=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8')).records;
const byId=Object.fromEntries(list.map(r=>[r.id,r]));
function fact(id,expected){const row=byId[id];assert(row,'Missing estate '+id);
 for(const [field,value] of Object.entries(expected))assert.equal(row[field],value,row.label+' / '+field);
 assert.equal(row.naver_sample_verified,'2026-10-19');
 assert(row.detail_source.includes('네이버페이 부동산'),'Photo provenance missing for '+row.label);
}
fact('verified-extra-03',{address:'인천광역시 연수구 컨벤시아대로42번길 95',households:461,buildings:6,
 approved_date:'2009-09-30',heating:'지역난방',parking_total:808});
fact('verified-extra-06',{address:'인천광역시 연수구 해돋이로171번길 9-4',households:90,buildings:1,
 approved_date:'2023-02-24',heating:'지역난방',parking_total:85});
fact('kapt-a10022395',{households:108,buildings:2,parking_total:257,management_phone:'032-203-8900',
 approved_date:'2006-04-25',floors:'19~20층',builder:'대우자동차판매(주)'});
fact('verified-extra-05',{households:64,buildings:1,parking_total:73,approved_date:'2021-11-22'});
fact('verified-extra-07',{address:'인천광역시 연수구 신송로 165-17',households:128,buildings:4,parking_total:145,
 approved_date:'2023-08-31',heating:'지역난방',builder:'(주)송학건설'});
assert(byId['verified-extra-07'].detail_note.includes('259대'),'Previous conflicting parking value should be documented');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
new vm.Script(html.split('<script>')[1].split('</script>')[0]);
const segment=html.slice(html.indexOf('  const optional=[['),html.indexOf('  const ev=Number.isInteger',html.indexOf('  const optional=[[')));
assert(segment.includes('도로명주소')&&segment.includes('시공사'),'Useful address and builder remain visible');
assert(!segment.includes('용적률')&&!segment.includes('건폐율'),'Nonessential ratios hidden in family basics');
const collector=fs.readFileSync(path.join(root,'scripts/collect_complexes.py'),'utf8');
assert(collector.includes('if prior.get("naver_sample_verified"):'),'User-confirmed source facts must survive API refresh');
console.log('Verified 5 Naver source profiles, 259=>145 parking conflict, useful basics kept, ratios hidden');
