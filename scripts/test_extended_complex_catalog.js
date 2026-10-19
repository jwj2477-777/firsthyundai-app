// v1.9 audit: every latest MOLIT Songdo building name gets a verified base profile.
// Combined K-apt management entries are hidden, never counted twice.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const d=JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'));
const deals=JSON.parse(fs.readFileSync(path.join(root,'data/trades.json'),'utf8'));
const rows=d.records;
const norm=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[^0-9A-Z가-힣]/g,'');
const favorites=['f13','f14','f15','m21','m22','m23','avenue','centennial','prime20','prime25','skcentral','artwin','central3'];
assert.equal(rows.filter(x=>favorites.includes(x.id)).length,13);
assert.equal(rows.filter(x=>x.catalog_source==='kapt').length,64);
assert.equal(rows.filter(x=>x.catalog_source==='reference_verified').length,18);
assert.equal(rows.filter(x=>x.aggregate_only).length,2);
assert.equal(rows.length,95);
const visible=rows.filter(x=>!x.aggregate_only);
assert.equal(visible.length,93);
const allNames=new Map();
for(const apt of visible){
 assert(apt.households>0&&Number.isInteger(apt.households),'Missing real basic facts for '+apt.label);
 assert(/^https:\/\//.test(apt.source_url),'Source URL is mandatory for '+apt.label);
 for(const name of [apt.label,...apt.aliases]){
  const key=norm(name);
  if(allNames.has(key)&&allNames.get(key)!==apt.id)
   throw new Error('Ambiguous identical aliases: '+name+' ('+allNames.get(key)+' vs '+apt.id+')');
  allNames.set(key,apt.id);
 }
}
const dealsNames=[...new Set((deals.records||[]).map(r=>r.building).filter(Boolean))];
assert(dealsNames.length>=80,'Trades feed seems truncated; do not claim full coverage.');
const missing=dealsNames.filter(name=>!allNames.has(norm(name)));
console.log('Existing MOLIT trade names:',dealsNames.length);
console.log('Matched to complete building facts:',dealsNames.length-missing.length);
console.log('Missing from complete apartment basics:',missing.length,missing);
assert.deepEqual(missing,[], 'Some active trade buildings still have no basic data; do not claim finished');
const names=visible.filter(x=>x.catalog_source==='reference_verified').map(x=>x.label);
for(const prefix of ['더샵엑스포6단지','더샵엑스포9단지','더샵엑스포10단지','인천송도힐스테이트3단지',
 '인천송도힐스테이트4단지','인천송도힐스테이트5단지','인천송도힐스테이트6단지']){
 assert(names.includes(prefix),'Separate block must be independently registered: '+prefix);
}
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
new vm.Script(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes('if(row.aggregate_only)'),'No duplicated combined apartment listings');
console.log('v1.9 checked 93 independent profiles; verified 18 specific sites and exact aliases.');
