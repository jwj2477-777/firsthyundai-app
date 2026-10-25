/* Public settings reader; authenticated administrator writer. */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type","X-Content-Type-Options":"nosniff"};
const key="office-general-settings-v1", enc=new TextEncoder();
const BOARD_PREFIX="office-postit-v1:", BOARD_MAX_CHARS=1600;
const BOARD_LIFETIME_DAYS=365;
const res=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:HEAD});
function b64(buf){const x=buf instanceof Uint8Array?buf:new Uint8Array(buf);return btoa(String.fromCharCode(...x)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decoded(x){if(!/^[A-Za-z0-9_-]+$/.test(x)||x.length>1200)throw Error("bad_token");const b=atob(x.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-x.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function hkey(secret){return crypto.subtle.importKey("raw",enc.encode("fhd-shared:v1:"+secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
async function token(secret){const part=b64(enc.encode(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,nonce:b64(crypto.getRandomValues(new Uint8Array(16)))})));return part+"."+b64(await crypto.subtle.sign("HMAC",await hkey(secret),enc.encode(part)))}
async function checkToken(value,secret){try{if(!value||value.length>1100)return false;const parts=value.split(".");if(parts.length!==2)return false;const p=JSON.parse(new TextDecoder().decode(decoded(parts[0])));const now=Math.floor(Date.now()/1000);if(!Number.isSafeInteger(p.exp)||p.exp<now||p.exp>now+3700)return false;return await crypto.subtle.verify("HMAC",await hkey(secret),decoded(parts[1]),enc.encode(parts[0]))}catch(e){return false}}
async function same(a,b,min=12){if(typeof a!=="string"||a.length<min||a.length>64||!b)return false;const [x,y]=await Promise.all([a,b].map(async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))));let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function boardToken(secret){
 const part=b64(enc.encode(JSON.stringify({scope:"board",exp:Math.floor(Date.now()/1000)+60*60*24*60,
  nonce:b64(crypto.getRandomValues(new Uint8Array(16)))})));
 const signature=b64(await crypto.subtle.sign("HMAC",await hkey("board:"+secret),enc.encode(part)));
 return part+"."+signature;
}
async function validBoardToken(value,secret){
 try{
  if(!secret||!value||value.length>1100)return false;
  const bits=value.split(".");if(bits.length!==2)return false;
  const obj=JSON.parse(new TextDecoder().decode(decoded(bits[0])));
  const now=Math.floor(Date.now()/1000);
  if(obj.scope!=="board"||!Number.isSafeInteger(obj.exp)||obj.exp<now||obj.exp>now+60*60*24*61)return false;
  return crypto.subtle.verify("HMAC",await hkey("board:"+secret),decoded(bits[1]),enc.encode(bits[0]));
 }catch(e){return false}
}
function validBoardText(text){
 if(typeof text!=="string")throw Error("not_string");
 const normalized=text.replace(/\r\n?/g,"\n").trim();
 if(!normalized||normalized.length>BOARD_MAX_CHARS)throw Error("bad_length");
 return normalized;
}
const validBoardId=x=>typeof x==="string"&&/^([a-z0-9]{8,14})-([0-9a-f-]{36})$/.test(x);
async function boardList(env){
 const keys=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
 // Each post-it has its own KV key, so simultaneous posts never overwrite one another.
 const latest=keys.keys.slice(-100);
 const notes=await Promise.all(latest.map(async item=>{
  try{return await env.SETTINGS.get(item.name,"json")}catch(e){return null}
 }));
 return notes.filter(x=>x&&validBoardId(x.id)&&typeof x.text==="string"&&
  typeof x.done==="boolean").sort((a,b)=>b.created_at.localeCompare(a.created_at));
}
async function boardCommand(req,env,url){
 if(!env.FIRSTHYUNDAI_ACCESS_CODE)return res({error:"board_auth_not_configured"},503);
 // All board data (including phone numbers) is private, on GET as well as writes.
 if(req.headers.has("origin"))return res({error:"native_only"},403);
 if(url.pathname==="/board/session"&&req.method==="POST"){
  if(!env.AUTH_LIMITER)return res({error:"rate_limit_unavailable"},503);
  const rate=await env.AUTH_LIMITER.limit({key:"board-session"});
  if(!rate.success)return res({error:"rate_limited"},429);
  let data;try{data=await body(req)}catch(e){return res({error:"bad_request"},400)}
  if(!await same(data?.code,env.FIRSTHYUNDAI_ACCESS_CODE,8))return res({error:"unauthorized"},401);
  return res({token:await boardToken(env.FIRSTHYUNDAI_ACCESS_CODE),expires_in:5184000});
 }
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||
  !await validBoardToken(auth.slice(7),env.FIRSTHYUNDAI_ACCESS_CODE))
  return res({error:"board_auth_required"},401);
 if(url.pathname==="/board"&&req.method==="GET")return res({schema:1,notes:await boardList(env)});
 if(url.pathname==="/board/updates"&&req.method==="GET"){
  const list=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
  const items=list.keys.slice(-120).filter(x=>validBoardId(x.name.slice(BOARD_PREFIX.length)))
   .map(x=>({id:x.name.slice(BOARD_PREFIX.length),device:x.metadata?.device||""}));
  return res({schema:1,items});
 }
 if(url.pathname==="/board"&&req.method==="POST"){
  let data,content;try{data=await body(req);content=validBoardText(data?.text)}
  catch(e){return res({error:"invalid_note"},400)}
  const device=typeof data?.device==="string"&&/^[a-f0-9]{32}$/.test(data.device)?data.device:"";
  const id=Date.now().toString(36).padStart(9,"0")+"-"+crypto.randomUUID(),now=new Date().toISOString();
  const record={id,text:content,done:false,created_at:now,updated_at:now};
  await env.SETTINGS.put(BOARD_PREFIX+id,JSON.stringify(record),
   {expirationTtl:BOARD_LIFETIME_DAYS*86400,metadata:{device}});

  return res({ok:true,note:record},201);
 }
 const match=url.pathname.match(/^\/board\/([a-z0-9-]{45,51})$/);
 if(match&&validBoardId(match[1])){
  const memoKey=BOARD_PREFIX+match[1];
  if(req.method!=="PATCH"&&req.method!=="DELETE")return res({error:"method_not_allowed"},405);
  const saved=await env.SETTINGS.get(memoKey,"json");
  if(!saved)return res({error:"not_found"},404);
  if(req.method==="DELETE"){await env.SETTINGS.delete(memoKey);return res({ok:true})}
  let data;try{data=await body(req)}catch(e){return res({error:"bad_request"},400)}
  if(!data||typeof data!=="object")return res({error:"invalid_note"},400);
  const patchKeys=Object.keys(data);
  if(!patchKeys.length||patchKeys.some(k=>!["text","done"].includes(k))||
   (data.done!==undefined&&typeof data.done!=="boolean"))return res({error:"invalid_patch"},400);
  if(data.text!==undefined){
   try{saved.text=validBoardText(data.text)}catch(e){return res({error:"invalid_note"},400)}
  }
  if(data.done!==undefined)saved.done=data.done;
  saved.updated_at=new Date().toISOString();
  await env.SETTINGS.put(memoKey,JSON.stringify(saved),
   {expirationTtl:BOARD_LIFETIME_DAYS*86400});
  return res({ok:true,note:saved});
 }
 return res({error:"not_found"},404);
}
function validate(x){
 if(!x||x.schema!==1||x.type!=="firsthyundai-ui-settings"||typeof x.tradePopup!=="boolean"||x.preferences?.schema!==1)throw Error("schema");
 const allowed={
  start:["nearby","trades","new","complexes","news","contracts","overview","officetel","officeBoard"],
  density:["standard","compact","roomy"],reading:["standard","large","xlarge"],
  motion:["full","reduced"],contrast:["standard","high"],
  quickOrder:["standard","contractsFirst","memoFirst"],accent:["brand","teal","bronze"],
  tradeAmount:["standard","bold"],cancelled:["standard","subtle"],
  memoOrder:["newest","oldest"],memoCompleted:["hide","show"],
  memoRefresh:["30","45","120"],memoClock:["12","24"],memoPhones:["on","off"],
  tapSize:["standard","large"],memoLayout:["standard","compact","roomy"]
 };
 const defaults={quickOrder:"standard",accent:"brand",tradeAmount:"standard",cancelled:"standard",
  memoOrder:"newest",memoCompleted:"hide",memoRefresh:"45",memoClock:"12",memoPhones:"on",
  tapSize:"standard",memoLayout:"standard"};
 const p={schema:1};
 for(const [k,values]of Object.entries(allowed)){
  const raw=x.preferences[k]===undefined?defaults[k]:x.preferences[k];
  if(!values.includes(raw))throw Error("invalid_"+k);
  p[k]=raw;
 }
 return {schema:1,type:"firsthyundai-ui-settings",preferences:p,tradePopup:x.tradePopup};
}
async function body(req){if(Number(req.headers.get("content-length")||0)>2400)throw Error("large");const s=await req.text();if(s.length>2400)throw Error("large");return JSON.parse(s)}
export default {async fetch(req,env){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 const url=new URL(req.url);
 if(!env.SETTINGS)return res({error:"kv_not_configured"},503);
 if(url.pathname==="/health"&&req.method==="GET")return res({ok:true,storage:true,
  authConfigured:!!env.FIRSTHYUNDAI_ADMIN_CODE,boardAuthConfigured:!!env.FIRSTHYUNDAI_ACCESS_CODE});
 if(url.pathname.startsWith("/board"))return boardCommand(req,env,url);
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
},_test:{validate,token,checkToken,same,validBoardToken,boardToken,validBoardText,boardList}};
