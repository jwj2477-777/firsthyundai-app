// v1.3: public apartment catalog and family-mode visibility tests.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/complexes.json'), 'utf8'));
assert.equal(catalog.schema_version, 1);
assert(catalog.records.length >= 13, 'Core thirteen complexes must remain after K-apt expansion');
assert.equal(new Set(catalog.records.map(x => x.id)).size, catalog.records.length);
assert(catalog.records.some(x=>x.id==='prime20'));
assert(catalog.records.some(x=>x.id==='prime25'));
assert.equal(catalog.records.find(x=>x.id==='f14').households,869);
assert.equal(catalog.records.find(x=>x.id==='m23').heating,'지역난방');
for (const row of catalog.records) {
 assert.match(row.id,/^[a-z0-9-]{1,32}$/);
 assert(row.aliases.length>0);
 if(row.catalog_source==='trades'){
  assert.equal(row.households,null,'Trade-only estate household counts must remain unknown');
  assert(/^https:\/\//.test(row.source_url));
  assert(/국토교통부/.test(row.detail_source),'Transaction-only estates must state evidence');
 }else assert(Number.isInteger(row.households) && row.households > 0,'Households must be verified positive integers');
 assert(row.source_url.startsWith('https://'),'Each household count must have a cited HTTPS source');
 assert.equal(row.last_verified,'2026-10-19');
 assert(row.heating===null || ['지역난방','개별난방','중앙난방'].includes(row.heating),'Heating values must be declared and source backed');
 assert(Array.isArray(row.supply_type_labels));
 assert.deepEqual(row.floorplans,[], 'Do not claim an unverified image is a floorplan');
}
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
assert(html.includes('id="complexes"'));
const javascript=html.split('<script>')[1]?.split('</script>')[0];
assert(javascript,'Web UI script exists');
new vm.Script(javascript);
const elements=new Map();
function element(id) {
 if(!elements.has(id)) {
  const classes=new Set(id==='complexAdmin'?['hidden']:[]);
  elements.set(id,{
   value:'',innerHTML:'',textContent:'',open:false,options:[{}],
   classList:{toggle(c,force){if(force)classes.add(c);else classes.delete(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);}},
   scrollIntoView(){},reset(){},showModal(){},close(){},elements:{}
  });
 }
 return elements.get(id);
}
const response={
 'complexes.json': catalog,
 'trades.json':{schema_version:1,state:'ok',records:[
  {building:'더샵송도프라임뷰20BL',area_m2:84.95,contract_date:'2026-10-01',type:'매매',amount_10k:50000},
  {building:'더샵송도프라임뷰25BL',area_m2:101.5,contract_date:'2026-10-02',type:'매매',amount_10k:60000}
 ],checked_at:'2026-10-19T00:00:00Z'},
 'new_trades.json':{schema_version:1,state:'ok',records:[],checked_at:'2026-10-19T00:00:00Z'},
 'news.json':{schema_version:1,state:'ok',briefs:[],checked_at:'2026-10-19T00:00:00Z'}
};
const context={
 document:{getElementById:element},
 window:{},
 localStorage:{getItem(){return null},setItem(){}},
 fetch:async url=>{
  const name=url.split('/').pop().split('?')[0];
  return {ok:true,json:async()=>response[name]};
 },
 alert:()=>{},confirm:()=>true,console,URL,Blob,
};
vm.createContext(context);
vm.runInContext(javascript+'\n globalThis.__test={catalogRows,complexAreaStats,renderComplexes,selectComplex,switchPage};',context);
(async()=>{
 await new Promise(r=>setImmediate(r));
 const {catalogRows,complexAreaStats,switchPage,selectComplex}=context.__test;
 assert(catalogRows().length>=13);
 assert(!element('nav').innerHTML.includes('보안 관리'), 'Family navigation hides admin tabs');
 switchPage('complexes');
 assert.equal(element('complexAdmin').classList.contains('hidden'),true,'Admin editor must be hidden in family mode');
 assert(element('complexDetails').innerHTML.includes('872세대'),'Verified F15 household data must render');
 const prime20=catalogRows().find(x=>x.id==='prime20');
 assert.equal(complexAreaStats(prime20).map(x=>x.area).join(','),'84.95','Observed areas are sourced from matching trades only');
 element('complexSearch').value='프라임뷰';
 context.__test.renderComplexes();
 assert.equal((element('complexCards').innerHTML.match(/class="nearbyCard/g)||[]).length,2,'Prime 20 and 25 appear as two distinct complexes');
 selectComplex('prime25');
 vm.runInContext("setComplexDetailTab('deals')",context);
 assert(element('complexDetails').innerHTML.includes('101.5㎡'));
 assert(!element('complexDetails').innerHTML.includes('84.95㎡'),'Prime 20 area must not leak into prime 25');
 console.log('Apartment catalog v1.6 checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
