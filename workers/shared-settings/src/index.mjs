/* Public settings reader; authenticated administrator writer. */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type","X-Content-Type-Options":"nosniff"};
const key="office-general-settings-v1", enc=new TextEncoder();
const res=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:HEAD});
function b64(buf){const x=buf instanceof Uint8Array?buf:new Uint8Array(buf);return btoa(String.fromCharCode(...x)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decoded(x){if(!/^[A-Za-z0-9_-]+$/.test(x)||x.length>1200)throw Error("bad_token");const b=atob(x.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-x.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function hkey(secret){return crypto.subtle.importKey("raw",enc.encode("fhd-shared:v1:"+secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
async function token(secret){const part=b64(enc.encode(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,nonce:b64(crypto.getRandomValues(new Uint8Array(16)))})));return part+"."+b64(await crypto.subtle.sign("HMAC",await hkey(secret),enc.encode(part)))}
async function checkToken(value,secret){try{if(!value||value.length>1100)return false;const parts=value.split(".");if(parts.length!==2)return false;const p=JSON.parse(new TextDecoder().decode(decoded(parts[0])));const now=Math.floor(Date.now()/1000);if(!Number.isSafeInteger(p.exp)||p.exp<now||p.exp>now+3700)return false;return await crypto.subtle.verify("HMAC",await hkey(secret),decoded(parts[1]),enc.encode(parts[0]))}catch(e){return false}}
async function same(a,b){if(typeof a!=="string"||a.length<12||a.length>64||!b)return false;const [x,y]=await Promise.all([a,b].map(async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))));let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
function validate(x){if(!x||x.schema!==1||x.type!=="firsthyundai-ui-settings"||typeof x.tradePopup!=="boolean"||x.preferences?.schema!==1)throw Error("schema");const allowed={start:["nearby","trades","new","complexes","news","contracts","overview","officetel"],density:["standard","compact"],reading:["standard","large"],motion:["full","reduced"],contrast:["standard","high"]};const p={schema:1};for(const [k,values]of Object.entries(allowed)){if(!values.includes(x.preferences[k]))throw Error("invalid_"+k);p[k]=x.preferences[k]}return {schema:1,type:"firsthyundai-ui-settings",preferences:p,tradePopup:x.tradePopup}}
async function body(req){if(Number(req.headers.get("content-length")||0)>2400)throw Error("large");const s=await req.text();if(s.length>2400)throw Error("large");return JSON.parse(s)}
export default {async fetch(req,env){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 const url=new URL(req.url);
 if(!env.SETTINGS)return res({error:"kv_not_configured"},503);
 if(url.pathname==="/health"&&req.method==="GET")return res({ok:true,storage:true,authConfigured:!!env.FIRSTHYUNDAI_ADMIN_CODE});
 if(url.pathname==="/settings"&&req.method==="GET")return res((await env.SETTINGS.get(key,"json"))||{schema:1,status:"not_configured"});
 if(req.headers.has("origin"))return res({error:"native_only"},403);
 if(!env.FIRSTHYUNDAI_ADMIN_CODE)return res({error:"auth_not_configured"},503);
 if(url.pathname==="/session"&&req.method==="POST"){
  if(!env.AUTH_LIMITER)return res({error:"limiter_not_configured"},503);
  if(!(await env.AUTH_LIMITER.limit({key:"admin-shared-settings-login"})).success)return res({error:"rate_limited"},429);
  let data;try{data=await body(req)}catch(e){return res({error:"bad_request"},400)}
  if(!await same(data?.code,env.FIRSTHYUNDAI_ADMIN_CODE))return res({error:"unauthorized"},401);
  return res({token:await token(env.FIRSTHYUNDAI_ADMIN_CODE),expires_in:3600});
 }
 if(url.pathname==="/settings"&&req.method==="PUT"){
  const header=req.headers.get("authorization")||"";
  if(!header.startsWith("Bearer ")||!await checkToken(header.slice(7),env.FIRSTHYUNDAI_ADMIN_CODE))return res({error:"session_expired"},401);
  let settings;try{settings=validate(await body(req))}catch(e){return res({error:"invalid_settings"},400)}
  const record={schema:1,status:"ok",revision:crypto.randomUUID(),updated_at:new Date().toISOString(),settings};
  await env.SETTINGS.put(key,JSON.stringify(record));return res(record);
 }
 return res({error:"not_found"},404);
},_test:{validate,token,checkToken,same}};
