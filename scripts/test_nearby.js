// Android UI favorite mapping must match official names from actual MOLIT JSON.
// Run: node scripts/test_nearby.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const start = html.indexOf('/* FAVORITES_MAPPING_START:');
const endMarker = '/* FAVORITES_MAPPING_END */';
const end = html.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'Missing favorite mapping');
const source = html.slice(start, end + endMarker.length);
const result = vm.runInNewContext(source + '\n({groups:FAVORITE_APTS, lookup:favoriteIdForBuilding})');
const {groups, lookup} = result;
assert.equal(groups.length, 13, 'Prime View 20 and 25 must be independent favorite groups');
assert.equal(new Set(groups.map(g => g.id)).size, 13, 'Favorite IDs must be distinct');

const expected = [
 ['f13','송도더샵퍼스트파크F13-1BL'],
 ['f14','송도더샵퍼스트파크F14BL'],
 ['f15','송도더샵퍼스트파크F15BL'],
 ['m21','송도더샵마스터뷰21BL'],
 ['m22','송도더샵마스터뷰22BL'],
 ['m23','송도더샵마스터뷰23-1BL'],
 ['avenue','송도더샵파크애비뉴'],
 ['centennial','더샵송도센터니얼'],
 ['prime20','더샵송도프라임뷰20BL'],
 ['prime25','더샵송도프라임뷰25BL'],
 ['skcentral','송도SK뷰센트럴'],
 ['artwin','송도아트윈푸르지오'],
 ['central3','더샵송도센트럴파크Ⅲ']
];
for(const [id,name] of expected){
 assert.equal(lookup(name), id, 'Official building missing: '+name);
}
assert.equal(lookup('송도SKVIEW'), '', 'Do not combine different SK VIEW apartment');
assert.equal(lookup('더샵센트럴파크2'), '', 'Do not combine central park 2 and 3');
assert.equal(lookup('송도더샵센트럴시티'), '', 'Do not conflate nearby buildings');

const data = JSON.parse(fs.readFileSync(path.join(root,'data/trades.json'),'utf8'));
let matchCount = 0;
const matched = new Set();
for(const row of data.records || []){
 const id = lookup(row.building);
 if(id){
  matched.add(id);
  matchCount++;
 }
}
assert.equal(matched.size, 13, 'All 13 favorite apartments need matching real transactions');
assert.ok(matchCount > 100, 'Most likely official name mapping or source JSON regression');
console.log('Favorite mapping tests passed: '+groups.length+' groups, '+matchCount+' matching real transactions');
