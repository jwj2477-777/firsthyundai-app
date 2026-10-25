'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'office-board.css'),'utf8');
new vm.Script(js);
for(const field of ['officeBoard','officeBoardDraft','officeBoardPost','officeBoardList','officeBoardAuth'])
 assert(html.includes('id="'+field+'"'),field+' missing');
assert(html.includes("['officeBoard','사무실 메모']"));
assert(css.includes('.officeBoardNote'));
assert(!/localStorage|sessionStorage|\bfetch\(/.test(js),'Sensitive note content must not go to public storage/fetch');
const elements=new Map(),calls=[];
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,
 classList:{add(){},remove(){}},addEventListener(){},querySelector(){return null},focus(){}});return elements.get(id)}
const ctx=vm.createContext({
 window:{FirstHyundaiNative:{officeBoardAction:(action,data,id)=>calls.push({action,data,id}),
 requestOfficeBoardAccess(){}}},document:{getElementById:el},
 currentPage:'officeBoard',Date,Promise,setTimeout,clearTimeout,setInterval:()=>0,confirm:()=>true
});
vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiOfficeBoard;
assert(api._test.phones('010-1234-5678').includes('tel:01012345678'));
assert(!api._test.phones('<img src=x>').includes('<img'));
el('officeBoardDraft').value='3시 30분 방문';
api.post();
assert.equal(calls[0].action,'post');
const note={id:'mhad4vwu-00000000-0000-0000-0000-000000000001',text:'3시 30분 방문',
 created_at:'2026-10-25T01:00:00Z',updated_at:'2026-10-25T01:00:00Z',done:false};
ctx.window.onFirstHyundaiOfficeBoardResult({requestId:calls[0].id,ok:true,data:{ok:true,note}});
await new Promise(done=>setTimeout(done,10));
assert(el('officeBoardList').innerHTML.includes('3시 30분 방문'));
assert.equal(el('officeBoardDraft').value,'');
console.log('Office board UX, native bridge, freeform post and escaping passed.');
