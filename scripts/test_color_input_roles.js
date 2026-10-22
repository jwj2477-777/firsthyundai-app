/* Parent-friendly color roles regression; static checks complement phone review. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../app/src/main/assets');
const css=fs.readFileSync(path.join(dir,'theme.css'),'utf8');
const markup=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const contrast=(fg,bg)=>{
 const l=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const a=l(fg),b=l(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
for(const [fg,bg] of [
 ['#71573f','#fff5e8'],['#27383e','#fff5e8'],
 ['#ffffff','#925725'],['#ffffff','#155a66'],
 ['#244d58','#edf7f6'],['#20563b','#e8f5eb'],
 ['#74420f','#fff1de']
])assert(contrast(fg,bg)>=4.5,fg+' on '+bg+' violates 4.5:1 contrast ('+contrast(fg,bg).toFixed(2)+')');
for(const term of [
 '--fhd-write-bg:#fff5e8','--fhd-search-bg:#edf7f6',
 '--fhd-confirm-bg:#e8f5eb','--fhd-caution-bg:#fff1de',
 '#contracts .contractMemoInputArea{',
 '#contracts .contractMemoCard #ct_rough{',
 '#contracts .contractMemoCard #ct_rough::placeholder{',
 '#contracts .contractMemoCard #ct_rough:focus{',
 '#contracts .contractMemoCard #ct_rough:not(:placeholder-shown):not(:focus){',
 'select,input[type="search"]{',
 '#contracts #ct_resultPanel #ct_preview{',
 '.contractReview.ok,.refreshFeedback.success{',
 '.contractReview.bad,.refreshFeedback.warning{',
 '@media(prefers-contrast:more){'
])assert(css.includes(term),'Missing role-aware color '+term);
const contract=markup.slice(markup.indexOf('<div id="contracts"'),markup.indexOf('<div id="notes"'));
assert(contract.includes('✎ 계약 메모 입력칸'),'Input field must be labeled with pencil');
assert(contract.includes('여기부터 시작'),'Clear visual starting point');
assert(contract.includes('이 칸을 눌러 계약 내용을 적으세요.'),'Placeholder must explicitly be an instruction');
assert(contract.includes('예) 퍼팍 1502동 3004호'),'Illustrative example remains');
assert.equal((contract.match(/id="ct_rough"/g)||[]).length,1,'Single memo textarea');
assert(contract.includes('id="ct_rough" rows="10" maxlength="12000"'),'Input data contract must remain');
assert(contract.includes('onclick="FirstHyundaiEasy.compose()"'),'Main create action remains');
assert(contract.includes('onclick="FirstHyundaiContracts.voice()"'),'Dictation remains');
assert(contract.includes('id="ct_preview"')&&contract.includes('FirstHyundaiContracts.approve()'),'Safety confirmation remains');
assert(contract.includes('FirstHyundaiContractImage.open()'),'One-sheet image workflow remains');
assert(css.includes('body:not([data-office-role="admin"]) .adminExplain{display:none!important}'),'Family screen still compact');
console.log('Input/search/confirmed/warning colors, contrast, controls, accessible label and family mode checks passed.');
