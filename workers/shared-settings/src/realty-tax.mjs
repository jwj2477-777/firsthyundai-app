/* Server-only Korean realty tax estimates. No key, customer, account or result persistence. */
const provider='https://calcapi.fran.kr/v1/';
const allowedTypes=new Set(['acquisition','transfer']);
function own(type,s){const values=type==='acquisition'?['one','two','three','more']:['one','two','more'];return values.includes(s)?s:null;}
function cashWan(raw,positive=true){
 if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<0||raw>1000000000||(positive&&raw===0))throw Error('invalid_amount');
 return raw*10000; // Under JS MAX_SAFE_INTEGER.
}
function yesNo(value){if(value!=='Y'&&value!=='N')throw Error('invalid_boolean');return value;}
function date(raw){
 if(typeof raw!=='string'||!/^(?:19|20)\d{6}$/.test(raw))throw Error('invalid_date');
 const y=+raw.slice(0,4),m=+raw.slice(4,6),d=+raw.slice(6,8);
 const x=new Date(Date.UTC(y,m-1,d));
 if(x.getUTCFullYear()!==y||x.getUTCMonth()+1!==m||x.getUTCDate()!==d)throw Error('invalid_date');
 return raw;
}
function payload(type,input){
 if(!allowedTypes.has(type)||!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_type');
 if(type==='acquisition'){
  const permitted=['amount','areaType','own','conArea','firstOfLife','metro'];
  if(Object.keys(input).some(k=>!permitted.includes(k)))throw Error('unexpected_field');
  if(!['40','60','85','big'].includes(input.areaType)||!own(type,input.own))throw Error('invalid_housing_condition');
  return {amount:cashWan(input.amount),realEstateType:'house',how:'buy',areaType:input.areaType,own:input.own,
   conArea:yesNo(input.conArea),firstOfLife:yesNo(input.firstOfLife),metro:yesNo(input.metro)};
 }
 const permitted=['buyAmt','sellAmt','buyDate','sellDate','own','conArea','liveYear','cost','jointOwnership','jointRate'];
 if(Object.keys(input).some(k=>!permitted.includes(k)))throw Error('unexpected_field');
 const buyDate=date(input.buyDate),sellDate=date(input.sellDate);
 if(sellDate<buyDate)throw Error('invalid_date_order');
 if(!own(type,input.own))throw Error('invalid_housing_condition');
 const living=input.liveYear;
 if(typeof living!=='number'||!Number.isFinite(living)||living<0||living>100)throw Error('invalid_living_years');
 const body={buyAmt:cashWan(input.buyAmt),sellAmt:cashWan(input.sellAmt),buyDate,sellDate,
  realEstateType:'house',own:input.own,conArea:yesNo(input.conArea),baseDeduct:'Y',liveYear:living};
 if(input.cost!==undefined)body.cost=cashWan(input.cost,false);
 if(input.jointOwnership!==undefined){
  body.jointOwnership=yesNo(input.jointOwnership);
  if(body.jointOwnership==='Y'){
   if(typeof input.jointRate!=='number'||input.jointRate<=0||input.jointRate>=100)throw Error('invalid_joint_rate');
   body.jointRate=input.jointRate;
  }
 }
 return body;
}
function cleanRows(value){
 if(!Array.isArray(value)||value.length>100)throw Error('invalid_provider_response');
 return value.map(row=>{
  if(!row||typeof row!=='object')throw Error('invalid_provider_response');
  const take=(key,max)=>typeof row[key]==='string'?row[key].slice(0,max):'';
  return {label:take('적요',100),value:take('값',140),note:take('비고',240)};
 }).filter(row=>row.label);
}
async function calculateTax(req,env,caller,fetcher=fetch){
 if(req.method!=='POST')return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'Content-Type':'application/json'}});
 if(!env.CALC_API_KEY)return new Response(JSON.stringify({error:'tax_api_not_configured'}),{status:503,headers:{'Content-Type':'application/json'}});
 if(!env.AUTH_LIMITER)return new Response(JSON.stringify({error:'rate_limit_unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
 if(!(await env.AUTH_LIMITER.limit({key:'tax:'+caller.member.id})).success)
  return new Response(JSON.stringify({error:'rate_limited'}),{status:429,headers:{'Content-Type':'application/json'}});
 let input;
 try{
  const bytes=await req.arrayBuffer();
  if(bytes.byteLength>1400)throw Error('too_large');
  input=JSON.parse(new TextDecoder().decode(bytes));
 }catch(e){return new Response(JSON.stringify({error:'invalid_request'}),{status:400,headers:{'Content-Type':'application/json'}});}
 const type=input?.type;
 let data;
 try{data=payload(type,input?.values);}
 catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}
 try{
  const response=await fetcher(provider+type,{method:'POST',
   headers:{Authorization:'Bearer '+env.CALC_API_KEY,'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(response.status===429)return new Response(JSON.stringify({error:'provider_rate_limited'}),{status:429,headers:{'Content-Type':'application/json'}});
  if(response.status===401)return new Response(JSON.stringify({error:'provider_auth_error'}),{status:503,headers:{'Content-Type':'application/json'}});
  if(!response.ok)return new Response(JSON.stringify({error:'provider_unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
  const raw=await response.text();
  if(raw.length>60000)throw Error('too_large');
  const result=JSON.parse(raw);
  if(result?.success!==true||!Array.isArray(result.data))
   return new Response(JSON.stringify({error:'provider_requires_review'}),{status:422,headers:{'Content-Type':'application/json'}});
  const rows=cleanRows(result.data);
  return new Response(JSON.stringify({ok:true,rows,basis:typeof result.basis==='string'?result.basis.replace(/<[^>]*>/g,' ').slice(0,1500):'',
   source:'부동산계산기.com'}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({error:'provider_unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});}
}
export {payload,cleanRows,calculateTax};
