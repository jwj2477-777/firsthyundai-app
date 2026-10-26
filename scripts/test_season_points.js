'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
// AndroidX's numeric tokenizer differs from SVG's compact arc-flag grammar.
// Validate every shared nature path with Android-compatible numeric arguments.
const sizes={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0};
function validate(data,label){
 const pieces=data.match(/[a-df-z][^a-df-z]*/ig)||[];assert(pieces.length,label);
 for(const piece of pieces){
  const kind=piece[0].toUpperCase(),step=sizes[kind];assert.notEqual(step,undefined,label+' command');
  const nums=(piece.slice(1).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/ig)||[]).map(Number);
  assert(nums.every(Number.isFinite),label+' finite');
  if(step===0){assert.equal(nums.length,0,label+' close');continue;}
  assert(nums.length>=step&&nums.length%step===0,label+' '+piece+' has incomplete arguments');
  if(kind==='A')for(let n=0;n<nums.length;n+=7){assert([0,1].includes(nums[n+3]),label+' arc large flag');assert([0,1].includes(nums[n+4]),label+' arc sweep flag');}
 }
}
let count=0;
for(const kind of ['spring','summer','autumn','winter','rain','snow']){
 const svg=fs.readFileSync(path.join(assets,'season-point-'+kind+'.svg'),'utf8');
 for(const m of svg.matchAll(/\sd="([^"]+)"/g)){validate(m[1],kind);count++;}
}
const native=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/ThemeAppearance.java'),'utf8');
for(const m of native.matchAll(/(?:fill|stroke)\(c,"([^"]+)"/g)){validate(m[1],'Native');count++;}
assert(count>=20,'Validate all web and native point paths');
assert.throws(()=>validate('M4 15a8 8 0 0016 0','compact arc'),'Compact SVG flags must not reach Android PathParser');
console.log('Season points passed: '+count+' web/native vector paths, complete numeric commands and Android-safe arc flags.');
