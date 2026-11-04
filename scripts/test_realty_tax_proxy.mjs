import assert from 'node:assert/strict';
import fs from 'node:fs';
import {payload,cleanRows,calculateTax} from '../workers/shared-settings/src/realty-tax.mjs';
const buy=payload('acquisition',{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'});
assert.equal(buy.amount,1400000000);
assert.equal(buy.how,'buy');
assert.equal(buy.realEstateType,'house');
assert.equal(buy.metro,'Y');
assert(!Object.hasOwn(buy,'standardPrice'));
const sale=payload('transfer',{buyAmt:70000,sellAmt:95000,buyDate:'20200115',sellDate:'20260628',own:'one',conArea:'N',liveYear:2,cost:900});
assert.equal(sale.buyAmt,700000000);
assert.equal(sale.sellAmt,950000000);
assert.equal(sale.cost,9000000);
assert.equal(sale.baseDeduct,'Y');
for(const input of [
 {amount:0,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'},
 {amount:140000,areaType:'85',own:'one',conArea:'unknown',firstOfLife:'N',metro:'Y'},
 {amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y',account:'private'},
])assert.throws(()=>payload('acquisition',input),'Do not allow guesses/private fields');
for(const input of [
 {buyAmt:70000,sellAmt:95000,buyDate:'20260230',sellDate:'20260628',own:'one',conArea:'N',liveYear:2},
 {buyAmt:70000,sellAmt:95000,buyDate:'20260115',sellDate:'20250115',own:'one',conArea:'N',liveYear:2},
 {buyAmt:70000,sellAmt:95000,buyDate:'20200115',sellDate:'20260628',own:'one',conArea:'N',liveYear:-1},
])assert.throws(()=>payload('transfer',input));
assert.deepEqual(cleanRows([{적요:'취득세',값:'42,000,000',비고:'적용요율',옵션:'font-weight:bold'}]),
 [{label:'취득세',value:'42,000,000',note:'적용요율'}]);
assert.deepEqual(cleanRows([{적요:'지방교육세',값:500000,비고:0}]),
 [{label:'지방교육세',value:'500000',note:'0'}],'Provider may return numeric values; do not silently blank amounts');
assert.throws(()=>cleanRows([{적요:'예상세액',값:Infinity}]),/invalid_provider_response/,'Never display non-finite totals');

let sent=0,passedBody=null,auth='';
const fakeFetch=async (url,options)=>{
 sent++;assert.equal(url,'https://calcapi.fran.kr/v1/acquisition');
 auth=options.headers.Authorization;
 passedBody=JSON.parse(options.body);
 assert.equal(options.redirect,'error');
 return new Response(JSON.stringify({success:true,data:[{적요:'취득세',값:'42,000,000',비고:'참고'}],basis:'<b>계산 기준</b>'}),{status:200});
};
const call=(input,env,fetcher=fakeFetch,headers={})=>calculateTax(new Request('https://firsthyundai-shared-settings.jwj2477.workers.dev/board/tax/calculate',
 {method:'POST',headers,body:JSON.stringify(input)}),env,{member:{id:'demo-member'}},fetcher);
const env={CALC_API_KEY:'rck_FAKE_TEST_ONLY',AUTH_LIMITER:{async limit(){return {success:true}}}};
let response=await call({type:'acquisition',values:{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},env);
assert.equal(response.status,200);
let data=await response.json();
assert(data.ok&&data.rows.length===1);
assert(!JSON.stringify(data).includes('rck_'));
assert(!data.basis.includes('<b>'));
assert.equal(auth,'Bearer rck_FAKE_TEST_ONLY');
assert.equal(passedBody.amount,1400000000);
assert.equal(sent,1);
response=await call({type:'acquisition',values:{amount:0,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},env);
assert.equal(response.status,400);assert.equal(sent,1,'Invalid input does not call provider');
response=await call({type:'acquisition',values:{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},{...env,CALC_API_KEY:''});
assert.equal(response.status,503);assert.equal(sent,1);
response=await call({type:'acquisition',values:{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},
 {...env,AUTH_LIMITER:{async limit(){return {success:false}}}});
assert.equal(response.status,429);assert.equal(sent,1);
const other=async()=>new Response(JSON.stringify({success:false,code:'invalid_request'}),{status:400});
response=await call({type:'acquisition',values:{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},env,other);
assert.equal(response.status,503,'Provider failure must be clear, not a fabricated tax result');
const forbidden=async()=>new Response(JSON.stringify({success:false}),{status:403});
response=await call({type:'acquisition',values:{amount:140000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},env,forbidden);
assert.equal(response.status,503);
assert.equal((await response.json()).error,'provider_forbidden','Distinguish a real provider HTTP 403');
let tries=0;
const alternate=async(url,options)=>{
 tries++;
 if(tries===1){assert.equal(options.headers.Authorization,'Bearer rck_FAKE_TEST_ONLY');return new Response('',{status:403})}
 assert.equal(options.headers['X-Api-Key'],'rck_FAKE_TEST_ONLY');
 assert(!Object.hasOwn(options.headers,'Authorization'));
 return new Response(JSON.stringify({success:true,data:[{적요:'세액',값:'5,500,000',비고:'검증'}]}),{status:200});
};
response=await call({type:'acquisition',values:{amount:50000,areaType:'85',own:'one',conArea:'N',firstOfLife:'N',metro:'Y'}},env,alternate);
assert.equal(response.status,200,'Official alternate auth header should recover from one 403');
assert.equal(tries,2);
assert.equal((await response.json()).rows[0].value,'5,500,000');

const worker=fs.readFileSync(new URL('../workers/shared-settings/src/index.mjs',import.meta.url),'utf8');
const native=fs.readFileSync(new URL('../app/src/main/java/kr/co/firsthyundai/app/MainActivity.java',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../app/src/main/java/kr/co/firsthyundai/app/OfficeBoardClient.java',import.meta.url),'utf8');
assert(worker.includes("if(url.pathname==='/board/tax/calculate')return calculateTax(req,env,caller)"));
assert(worker.indexOf("const caller=auth.startsWith")<worker.indexOf("'/board/tax/calculate'"),'Authenticated member required');
assert(worker.includes('if(req.headers.has("origin"))return res({error:"native_only"},403);'));
assert(native.includes('@JavascriptInterface public void calculateRealtyTax(String payload,String requestId)'));
assert(client.includes('request("POST","/board/tax/calculate",payload,auth)'));
assert(!native.includes('CALC_API_KEY')&&!client.includes('CALC_API_KEY'));
assert(client.includes('connection.setReadTimeout("/board/tax/calculate".equals(path)?20000:9000)'),
 'Mobile read timeout must exceed Worker upstream timeout');
assert(client.includes('throw new Exception("tax_error:"+status+":"+code)'),
 'Do not conflate provider authorization, invalid inputs and mobile timeout');
assert(native.includes('.put("errorCode",code).put("httpStatus",http)'),
 'Return only safe tax diagnostic code and HTTP status to calculator UI');
const deploy=fs.readFileSync(new URL('../.github/workflows/deploy-shared-settings.yml',import.meta.url),'utf8');
assert(deploy.includes('python3 scripts/probe_realty_tax_api.py'),
 'Verify the actual key against the provider without printing it');

console.log('PASS private tax calculation validation, proxy, rate limit, provider isolation and native authenticated bridge');
