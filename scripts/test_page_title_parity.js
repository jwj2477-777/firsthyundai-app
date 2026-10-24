'use strict';
/* 2026-10-24: regression guard for equal-tier headings after motion cleanup. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const pages=['trades','nearby','new','officetel','complexes','news'];
const common=':is('+pages.map(x=>'#'+x).join(',')+').page>.sectionTitle:first-child';
const marker='/* v2.0.72 · ONE source of truth for equal-rank page headings.';
const last=css.lastIndexOf(marker);
assert(last>0,'Equal-rank style block must be the final typography authority');
const rules=css.slice(last);
for(const p of pages){
 const start=html.indexOf('<div id="'+p+'" class="page');
 assert(start>=0,'Page missing '+p);
 const heading=html.slice(start,start+600);
 assert(heading.includes('class="sectionTitle'),'SectionTitle missing: '+p);
 assert(heading.includes('<h2'),'H2 missing: '+p);
 if(p!=='nearby')assert(heading.includes('class="tiny'),'Subtitle missing: '+p);
 assert(heading.includes('refreshAction'),'Refresh action missing: '+p);
 assert(rules.includes('#'+p),'Shared selector omitted '+p);
}
assert(rules.includes(common+' h2{'),'One authoritative same-rank heading style');
assert(rules.includes('font-size:20px;')&&rules.includes('line-height:1.4;') &&
 rules.includes('font-weight:820;'),'Base heading font sizing must be consistent');
assert(rules.includes(common+' p.tiny{'),'Subhead metadata must share one style');
for(const token of ['font-size:14px;','line-height:1.5;','font-weight:500;','min-height:42px;',
 'overflow-wrap:break-word;','color:#536A71;'])
 assert(rules.includes(token),'Missing shared metadata type '+token);
assert(!css.includes('#trades .sectionTitle #tradesMeta{font-size:13px'),
 'Legacy high-specificity apartment metadata mismatch must stay removed');
assert(!/v2\.0\.70 · Apartment\/officetel heading rhythm/.test(css),
 'Do not introduce a separate heading scale for two of six equal-level pages');
assert(rules.includes('@media(max-width:380px)') &&
 rules.includes('font-size:19px;'),'All six pages must share the same mobile breakpoint');
assert(html.includes("newsPane='articles'")||html.includes("pane==='articles'"),
 'News and subscription stay in one unchanged page');
assert(html.includes("('tradesMeta').textContent=") &&
 html.includes("('newsFamilyMeta').textContent="),
 'Live status counts and collection timestamps must remain');
console.log('Equal-level heading regression passed: all six page headings 20px (19px narrow), all metadata 14px and status feeds intact.');
