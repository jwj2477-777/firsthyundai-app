import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';

const t=service._test;
const acquired={kind:'acquisition',amount:1400000000,own:'one',areaType:'85',conArea:'N',metro:'Y',firstOfLife:'N'};
const transferred={kind:'transfer',buyAmt:700000000,sellAmt:950000000,buyDate:'20200115',
 sellDate:'20260628',own:'one',conArea:'N',liveYear:2,cost:10000000};
assert.equal(t.validTaxDate('20240229'),true);
assert.equal(t.validTaxDate('20250229'),false);
assert.equal(t.validTaxDate('20261301'),false);
assert.equal(t.validTaxDate('2020113'),false);
assert.equal(t.validTaxBody(acquired).realEstateType,'house');
assert.equal(t.validTaxBody(acquired).temp1221,'N','Unpassed legislation not assumed');
assert.equal(t.validTaxBody(transferred).baseDeduct,'Y');
assert.equal(t.validTaxBody(transferred).cost,10000000);
assert.equal(t.validTaxBody(transferred).taxReform2026,'N');
for(const invalid of [
 {...acquired,amount:'1400000000'},
 {...acquired,firstOfLife:''},
 {...acquired,own:'five'},
 {...acquired,bankAccount:'12345'},
 {...transferred,buyDate:'20230229'},
 {...transferred,sellDate:'20190101'},
 {...transferred,cost:-1},
 {...transferred,liveYear:2.5},
 {...transferred,recipientName:'PRIVATE'}
])assert.throws(()=>t.validTaxBody(invalid),'Reject malformed / personal / unsafe provider inputs');
assert.throws(()=>t.validTaxBody({kind:'land',amount:1000000}));

const store=new Map();
const env={
 SETTINGS:{
  async get(k,format){const val=store.get(k);return val===undefined?null:format==='json'?JSON.parse(val):val},
  async put(k,v){store.set(k,v)},
  async delete(k){store.delete(k)},
  async list({prefix='',limit=100}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(name=>({name}))}}
 },
 FIRSTHYUNDAI_ACCESS_CODE:'testOfficeCredential',
 FIRSTHYUNDAI_ADMIN_CODE:'testAdminCredential',
 CALC_API_KEY:'testServerOnlyKeyNeverSentToUI',
 AUTH_LIMITER:{async limit(){return {success:true}}}
};
const base='https://firsthyundai-shared-settings.jwj2477.workers.dev',route='/board/calculator/tax';
const send=(method='POST',data=acquired,token='',origin='')=>{
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(origin)headers.Origin=origin;
 if(data!==null)headers['Content-Type']='application/json';
 return service.fetch(new Request(base+route,{method,headers,
  body:method==='GET'||data===null?undefined:JSON.stringify(data)}),env);
};
assert.equal((await send()).status,401,'Must enroll handset before tax API usage');
assert.equal((await send('POST',acquired,'','https://third-party.invalid')).status,403,
 'A browser/third-party origin must not use native-only tax proxy');
const choices=await service.fetch(new Request(base+'/board/choices',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({code:'testOfficeCredential'})}),env);
assert.equal(choices.status,200);
const account=(await choices.json()).accounts[0];
const session=await service.fetch(new Request(base+'/board/session',{method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({code:'testOfficeCredential',member_id:account.id,device:'d'.repeat(32)})}),env);
const bearer=(await session.json()).token;
assert(bearer?.length>40);
assert.equal((await send('GET',null,bearer)).status,405);
assert.equal((await send('POST',{...acquired,account:'some-secret'},bearer)).status,400);

const originalFetch=globalThis.fetch;
const captured=[];
globalThis.fetch=async (url,opts)=>{
 captured.push({url,headers:opts.headers,body:JSON.parse(opts.body)});
 return new Response(JSON.stringify({success:true,data:[
  {'적요':'취득세','값':'42,000,000','비고':'예상값'},
  {'적요':'세율','값':'3%','비고':'적용 세율'}
 ]}),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
 const estimate=await send('POST',acquired,bearer);
 assert.equal(estimate.status,200);
 const reply=await estimate.json();
 assert.equal(reply.ok,true);
 assert.equal(reply.rows.length,2);
 assert.equal(reply.rows[0].value,'42,000,000');
 assert(!JSON.stringify(reply).includes(env.CALC_API_KEY),'Never expose upstream key in reply');
 assert.equal(captured.length,1);
 assert.equal(captured[0].url,'https://calcapi.fran.kr/v1/acquisition');
 assert.equal(captured[0].headers.Authorization,'Bearer '+env.CALC_API_KEY);
 assert.equal(captured[0].body.amount,1400000000);
 assert.equal(Object.hasOwn(captured[0].body,'account'),false);
 const second=await send('POST',transferred,bearer);
 assert.equal(second.status,200);
 assert.equal(captured[1].url,'https://calcapi.fran.kr/v1/transfer');
 assert.equal(captured[1].body.buyDate,'20200115');
 assert.equal(captured[1].body.liveYear,2);
 const limits=env.AUTH_LIMITER;env.AUTH_LIMITER={async limit(){return {success:false}}};
 assert.equal((await send('POST',acquired,bearer)).status,429);
 env.AUTH_LIMITER=limits;
 const key=env.CALC_API_KEY;delete env.CALC_API_KEY;
 assert.equal((await send('POST',acquired,bearer)).status,503);
 env.CALC_API_KEY=key;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:false,code:'missing_field'}),{status:400});
 assert.equal((await send('POST',acquired,bearer)).status,502);
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:[{'적요':'금액','값':'100'}]}),{status:200});
 assert.equal((await send('POST',acquired,bearer)).status,200);
}finally{globalThis.fetch=originalFetch}
console.log('PASS private tax API: auth, origin policy, provider shaping, key isolation, schema validation and quota errors');
