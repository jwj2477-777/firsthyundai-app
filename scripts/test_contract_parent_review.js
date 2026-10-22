// v2.0.2 Parent-friendly warnings & safe red-marked contract preview.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/ui-v2.css');
const base=read('app/src/main/assets/contracts.js'),easy=read('app/src/main/assets/contracts-easy.js');
new vm.Script(base);new vm.Script(easy);
const section=html.slice(html.indexOf('<div id="contracts"'),html.indexOf('<div id="notes"'));
for(const hook of ['ct_previewHighlight','ct_togglePreviewEdit','ct_missing','ct_preview','ct_reviewDetails','ct_termDiff','FirstHyundaiContracts.togglePreviewEdit()'])
 assert(section.includes(hook),'Essential review control missing: '+hook);
for(const selector of [
 'body:not([data-office-role="admin"]) #ct_reviewDetails',
 'body:not([data-office-role="admin"]) #ct_termDiff',
 'body:not([data-office-role="admin"]) #ct_oneTapSummary',
 'body:not([data-office-role="admin"]) #ct_preview:not(.contractEditing)',
 '#contracts #ct_previewHighlight.hidden',
 '#contracts .contractNeedsCheck'
])assert(css.includes(selector),'Parent simplification or red styling missing '+selector);
assert(css.includes('color:#A91D26')&&css.includes('text-decoration:underline'),
 'Missing placeholders need legible red + non-color underline');
assert(!css.includes(':has(#ct_preview.contractEditing)'),'Do not depend on modern :has for switching');
assert(css.includes('body:not([data-office-role="admin"]) #ct_missing.ok'),'Hide green no-action warning when all required info is present');
assert(css.includes('body:not([data-office-role="admin"]) #ct_status'),'Hide repeated parent status note');
assert(!section.includes('ct_includeNotice')&&!section.includes('ct_noticeConfirmed'),'Remove redundant contract agreement controls');
const nodes=new Map(),warnings=[];
function E(id){
 if(!nodes.has(id)){
  const classes=new Set();
  const n={id,value:'',textContent:'',innerHTML:'',className:'',checked:false,open:false,
   attrs:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,yes)=>{
    if(yes)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},
   setAttribute(k,v){this.attrs[k]=v},focus(){this.focused=true},scrollIntoView(){},
   closest(){return null}};
  nodes.set(id,n);
 }
 return nodes.get(id);
}
E('ct_dealType').value='전세';
const body={getAttribute:name=>name==='data-office-role'?'family':null};
const ctx=vm.createContext({window:{},document:{getElementById:E,body},alert:x=>warnings.push(x),
 confirm:()=>true,navigator:{},console,Date});
vm.runInContext(base,ctx);vm.runInContext(easy,ctx);
const app=ctx.window.FirstHyundaiContracts,smart=ctx.window.FirstHyundaiEasy;
const txt='▶ 주소 : [주소 확인 필요]\n▶ 금액 : [확인 필요]\n▶ 특약 : <script>alert(1)</script> & 유의';
const h=app._test.highlightedNoticeHtml(txt);
assert.equal((h.match(/class="contractNeedsCheck"/g)||[]).length,2,'All placeholder spans must be marked');
assert(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),'User content must not be injected into HTML');
assert(h.includes('&amp; 유의'));
assert(!h.includes('<script>'));
E('ct_preview').value=txt;
app.refreshHighlightedNotice();
assert(E('ct_previewHighlight').innerHTML.includes('contractNeedsCheck'));
assert(app._test.previewContainsMissing());
app.togglePreviewEdit();
assert(E('ct_preview').classList.contains('contractEditing'),'Parent may explicitly edit original text');
assert(E('ct_previewHighlight').classList.contains('hidden'),'No duplicate colored/textarea views');
assert.equal(E('ct_togglePreviewEdit').attrs['aria-expanded'],'true');
assert(E('ct_preview').focused);
E('ct_preview').value='변경한 문장 [동·호수 확인 필요]';
app.edited();
app.togglePreviewEdit();
assert(!E('ct_preview').classList.contains('contractEditing'));
assert(E('ct_previewHighlight').innerHTML.includes('[동·호수 확인 필요]'));
assert.equal(E('ct_togglePreviewEdit').attrs['aria-expanded'],'false');
assert.equal(app.canShare(),false,'No preview placeholders may be sent');
app.approve();
assert(E('ct_status').textContent.includes('빨간 확인 필요'));
E('ct_preview').value='검토 완료 문구';app.refreshHighlightedNotice();
assert.equal(app._test.previewContainsMissing(),false);
assert(!E('ct_previewHighlight').innerHTML.includes('contractNeedsCheck'));
smart.refreshMissing();
assert(E('ct_missing').textContent.startsWith('⚠ 확인할 정보'));
assert(E('ct_missing').textContent.includes('동·호수'));
assert(E('ct_missing').textContent.includes('계약일'),'Missing contract date appears in the existing warning');
assert(css.includes('border:3px solid #D94D24'),'Warning emphasis must be visible');
assert(!E('ct_missing').textContent.includes('property')&&!E('ct_missing').textContent.includes('exclusiveArea'));
assert(E('ct_fixMissing').classList.contains('hidden')===false);
assert(E('ct_preview').value==='검토 완료 문구','Highlighted preview must NEVER modify SMS plaintext');
console.log('Parent contract review passed: 1 clear warning; safe red placeholders; read/edit toggle; no unfinished sharing.');
