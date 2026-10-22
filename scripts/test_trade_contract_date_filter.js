// Contract-date filtering must use the government's contract_date, not upload/collection dates.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
for(const id of ['tradeDateFrom','tradeDateTo','tradeDateError']){
 assert(html.includes('id="'+id+'"'),'Contract-date input/feedback must exist: '+id);
}
assert(html.includes('type="date"'),'Native mobile date picker required');
assert(html.includes('계약일 검색'));
assert(html.includes('onclick="sameTradeDateOnly()"'));
assert(html.includes('onclick="resetTradeDateFilter()"'));
const start=script.indexOf('function tradeContractDateMatches(');
const end=script.indexOf('function renderTrades(){',start);
assert(start>=0&&end>start,'Extract the actual date filter and date UI helpers');
const elements={tradeDateFrom:{value:''},tradeDateTo:{value:''}};
let redraw=0;
const ctx=vm.createContext({$:id=>elements[id],renderTrades:()=>redraw++});
vm.runInContext(script.slice(start,end),ctx);
const matches=(value,from='',to='')=>vm.runInContext(
 'tradeContractDateMatches('+JSON.stringify(value)+','+JSON.stringify(from)+','+JSON.stringify(to)+')',ctx);
assert(matches('2026-10-22'),'Blank range returns all dated records');
assert(matches(null),'Blank range keeps unknown record rows as before');
assert(matches('2026-10-22','2026-10-22','2026-10-22'),'Exact day and both inclusive boundaries');
assert(matches('2026-10-21','2026-10-20','2026-10-22'),'Date in range');
assert(matches('2026-10-20','2026-10-20','2026-10-22'),'Inclusive start');
assert(matches('2026-10-22','2026-10-20','2026-10-22'),'Inclusive end');
assert(!matches('2026-10-19','2026-10-20','2026-10-22'),'Before interval');
assert(!matches('2026-10-23','2026-10-20','2026-10-22'),'After interval');
assert(matches('2026-10-25','2026-10-20',''),'Start-only upper open bound');
assert(!matches('2026-10-19','2026-10-20',''),'Start-only rejects earlier');
assert(matches('2026-10-19','','2026-10-20'),'End-only lower open bound');
assert(!matches('2026-10-21','','2026-10-20'),'End-only rejects later');
assert(!matches(null,'2026-10-01','2026-10-31'),'Unknown date is not silently included');
assert(!matches('2026/10/22','2026-10-01','2026-10-31'),'Reject unsupported date formatting');
elements.tradeDateFrom.value='2026-10-22';
vm.runInContext('sameTradeDateOnly()',ctx);
assert.equal(elements.tradeDateTo.value,'2026-10-22','Single-day shortcut fills inclusive end');
assert.equal(redraw,1);
vm.runInContext('resetTradeDateFilter()',ctx);
assert.equal(elements.tradeDateFrom.value,'');
assert.equal(elements.tradeDateTo.value,'');
assert.equal(redraw,2);
elements.tradeDateTo.value='2026-10-09';
vm.runInContext('sameTradeDateOnly()',ctx);
assert.equal(elements.tradeDateFrom.value,'2026-10-09','A chosen end date can define a single day');
assert.equal(redraw,3);
const render=script.slice(end,script.indexOf('function renderNews(){',end));
assert(render.includes("const dateFrom=$('tradeDateFrom').value,dateTo=$('tradeDateTo').value"),'Read controls');
assert(render.includes('dateFrom>dateTo'),'Reversed interval must be surfaced');
assert(render.includes("dateError.classList.toggle('hidden',!reversed)"),'Show invalid range warning');
assert(render.includes('tradeContractDateMatches(x.contract_date,dateFrom,dateTo)'),'Apply to real contract_date');
for(const required of ['favoriteOnly','selectedTradeBuilding','selectedTradeArea','statusFilter','typeFilter']){
 assert(render.includes(required),'Preserve existing filter '+required);
}
const detailStart=script.indexOf('function showComplexTrades(');
const detailEnd=script.indexOf('function clearTradeFocus()',detailStart);
const detail=script.slice(detailStart,detailEnd);
assert(detail.includes("$('tradeDateFrom').value=''")&&detail.includes("$('tradeDateTo').value=''"),
 'Deep-linking to a complex must reset stale date restrictions');
console.log('Contract-date range + inclusive/single-day/clearing/reversed range and existing-filter integrations verified.');
