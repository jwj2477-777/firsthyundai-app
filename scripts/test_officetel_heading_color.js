'use strict';
/* v2.0.44: screenshot-reported officetel-only gradient should be solid blue.
 * Do not change accent size, alignment, page geometry or other page colors. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const marker='/* v2.0.44 · 오피스텔 제목 강조선';
const pos=css.lastIndexOf(marker);
assert(pos>=0,'Missing v2.0.44 solid-accent fix');
const layer=css.slice(pos).trim();
const rule=/body\[data-section="officetel"\] \.page#officetel>\.sectionTitle:before\s*\{\s*background:\s*var\(--ui2-trades\);\s*\}/;
assert(rule.test(layer),'Officetel accent must use the same flat trades hue as apartment.');
assert(css.includes('body[data-section="trades"] .page#trades>.sectionTitle:before') &&
       css.includes('background:var(--ui2-trades)'),
       'Apartment must retain existing flat blue accent.');
const body=layer.slice(layer.indexOf('{')+1,layer.indexOf('}'));
const declarations=body.split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(declarations.length,1,'Only the color may change.');
assert(/^background:\s*var\(--ui2-trades\)$/.test(declarations[0]),
 'Accent geometry, padding, pseudo-element length and positioning must stay unchanged.');
assert(html.includes('id="officetel" class="page hidden"') &&
       html.includes('<h2>송도동 오피스텔 실거래가</h2>') &&
       html.includes('<h2>송도동 아파트 실거래가</h2>'),
       'Both trade screens stay intact.');
console.log('Officetel heading fixed to solid trades blue; no layout or other color changes.');
