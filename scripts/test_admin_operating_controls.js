'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../app/src/main/assets');
const code=fs.readFileSync(path.join(dir,'office-board.js'),'utf8');
const pref=fs.readFileSync(path.join(dir,'admin-preferences.js'),'utf8');
new vm.Script(code);
let configured={memoOrder:'newest',memoCompleted:'hide',memoRefresh:'45',memoClock:'12',memoPhones:'on'};
const els=new Map();const installed=[];
function el(id){
 if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',value:'',disabled:false,
 classList:{add(){},remove(){}},querySelector(){return null},addEventListener(){},setAttribute(){}});
 return els.get(id);
}
const ctx=vm.createContext({document:{getElementById:el},
 window:{FirstHyundaiUIOptions:{get:()=>({...configured})},FirstHyundaiNative:{officeBoardAction(){}}},
 currentPage:'officeBoard',Date,Promise,setTimeout,clearTimeout,
 setInterval:(fn,ms)=>{installed.push(ms);return installed.length},
 clearInterval:(id)=>{installed.push(-id)}});
vm.runInContext(code,ctx);
const board=ctx.window.FirstHyundaiOfficeBoard;
board.settingsChanged();
assert.equal(installed[0],45000,'Default polling interval is 45sec');
configured={...configured,memoOrder:'oldest',memoCompleted:'show',
 memoRefresh:'120',memoClock:'24',memoPhones:'off'};
board.settingsChanged();
assert(installed.includes(120000),'Polling interval changed to 120sec');
assert(el('officeBoardShowDone').textContent.includes('완료 숨기기'),'Completed notes shown by default');
const note=(id,created)=>({id,text:'010-1234-5678',done:false,created_at:created,updated_at:created});
const a=note('mhad4vwu-00000000-0000-0000-0000-000000000001','2026-10-24T00:00:00Z');
const b=note('mhad4vwu-00000000-0000-0000-0000-000000000002','2026-10-25T00:00:00Z');
board._test.merge([b,a]);
const markup=el('officeBoardList').innerHTML;
assert(markup.indexOf(a.id)<markup.indexOf(b.id),'Oldest first');
assert(!markup.includes('href="tel:"'),'Phone numbers rendered as text when turned off');
assert(markup.includes('010-1234-5678'));
console.log('Office board shared settings live behavior: order, done, polling, phone links passed.');
