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
async function boardCommand(req,env,url,ctx){
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
 if(url.pathname==="/board/push/register"&&req.method==="POST")return pushRegister(req,env);
 if(url.pathname==="/board/push/status"&&req.method==="GET")return res({push_available:!!fcmConfig(env)});
 if(url.pathname==="/board"&&req.method==="GET")return res({schema:1,notes:await boardList(env)});
 if(url.pathname==="/board/updates"&&req.method==="GET"){
  const list=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
  const items=list.keys.slice(-120).filter(x=>validBoardId(x.name.slice(BOARD_PREFIX.length)))
   .map(x=>({id:x.name.slice(BOARD_PREFIX.length),device:x.metadata?.device||""}));
  return res({schema:1,items});
 }
 if(url.pathname==="/board"&&req.method==="POST"){
  let data,content;try{data=await body(req,7000);content=validBoardText(data?.text)}
  catch(e){return res({error:"invalid_note"},400)}
  const device=typeof data?.device==="string"&&/^[a-f0-9]{32}$/.test(data.device)?data.device:"";
  const id=Date.now().toString(36).padStart(9,"0")+"-"+crypto.randomUUID(),now=new Date().toISOString();
  const record={id,text:content,done:false,created_at:now,updated_at:now};
  await env.SETTINGS.put(BOARD_PREFIX+id,JSON.stringify(record),
   {expirationTtl:BOARD_LIFETIME_DAYS*86400,metadata:{device}});
  // Send after storage succeeds. Failure must never lose the saved memo.
  // Cloudflare waitUntil continues delivery without delaying the writer's screen.
  if(fcmConfig(env)){
   const task=sendPush(env,id,device).catch(()=>({sent:0}));
   if(ctx?.waitUntil)ctx.waitUntil(task);else await task;
  }
  return res({ok:true,note:record},201);
 }
 const match=url.pathname.match(/^\/board\/([a-z0-9-]{45,51})$/);
 if(match&&validBoardId(match[1])){
  const memoKey=BOARD_PREFIX+match[1];
  if(req.method!=="PATCH"&&req.method!=="DELETE")return res({error:"method_not_allowed"},405);
  const saved=await env.SETTINGS.get(memoKey,"json");
  if(!saved)return res({error:"not_found"},404);
  if(req.method==="DELETE"){await env.SETTINGS.delete(memoKey);return res({ok:true})}
  let data;try{data=await body(req,7000)}catch(e){return res({error:"bad_request"},400)}
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

/* FCM HTTP v1: server-only service account; no customer text or tokens in public settings. */
const PUSH_PREFIX="office-postit-push-v1:",PUSH_LIMIT=12,PUSH_TTL=90*86400;
let oauthCache={value:"",expires:0};
function fcmConfig(env){
 try{
  const raw=env.FHD_FCM_SERVICE_ACCOUNT_JSON;
  if(!raw||raw.length>16000)return null;
  const credentials=JSON.parse(raw);
  if(credentials.type!=="service_account"||
   !/^[A-Za-z0-9._-]{3,120}$/.test(credentials.project_id)||
   !/^[^@\s]{3,100}@[^@\s]{3,200}$/.test(credentials.client_email)||
   !credentials.private_key?.includes("BEGIN PRIVATE KEY"))return null;
  return credentials;
 }catch(e){return null}
}
function fcmTokenValid(value){
 return typeof value==="string"&&value.length>=32&&value.length<=4096&&
  /^[A-Za-z0-9_:.~-]+$/.test(value);
}
async function fcmOAuth(env){
 const now=Date.now();
 if(oauthCache.value&&now<oauthCache.expires)return oauthCache.value;
 const config=fcmConfig(env);if(!config)throw Error("fcm_unconfigured");
 const header=b64(enc.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claims=b64(enc.encode(JSON.stringify({
  iss:config.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",
  aud:"https://oauth2.googleapis.com/token",iat:Math.floor(now/1000),
  exp:Math.floor(now/1000)+3500
 })));
 const payload=header+"."+claims;
 const rawKey=config.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const bytes=Uint8Array.from(atob(rawKey),x=>x.charCodeAt(0));
 const privateKey=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const sig=b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,enc.encode(payload)));
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:payload+"."+sig}).toString()
 });
 if(!response.ok)throw Error("fcm_oauth_"+response.status);
 const doc=await response.json();
 if(typeof doc.access_token!=="string"||!doc.access_token)throw Error("fcm_oauth_empty");
 oauthCache={value:doc.access_token,expires:now+Math.max(60,Math.min(3300,Number(doc.expires_in)||3500)-90)*1000};
 return oauthCache.value;
}
async function sendPush(env,postId,fromDevice){
 const config=fcmConfig(env);
 if(!config)return {sent:0,reason:"fcm_unconfigured"};
 // Respect the office-wide new memo notification setting, without exposing notes.
 const office=await env.SETTINGS.get(key,"json");
 if(office?.settings?.preferences?.memoAlerts==="off")return {sent:0,reason:"disabled"};
 const keys=await env.SETTINGS.list({prefix:PUSH_PREFIX,limit:100});
 const recipients=keys.keys.filter(k=>k.name!==PUSH_PREFIX+fromDevice).slice(0,PUSH_LIMIT);
 if(!recipients.length)return {sent:0,reason:"no_devices"};
 const auth=await fcmOAuth(env);
 let sent=0;
 for(const device of recipients){
  const obj=await env.SETTINGS.get(device.name,"json");
  if(!obj?.fcm||!fcmTokenValid(obj.fcm))continue;
  // Data-only message: the Android service owns the private lock-screen notification.
  const response=await fetch("https://fcm.googleapis.com/v1/projects/"+config.project_id+"/messages:send",{
   method:"POST",headers:{"Authorization":"Bearer "+auth,"Content-Type":"application/json; charset=utf-8"},
   body:JSON.stringify({message:{token:obj.fcm,data:{kind:"office_note",note_id:postId},
     android:{priority:"HIGH",ttl:"86400s"}}})
  });
  if(response.ok){sent++;continue}
  // Permanently invalid registration tokens are deleted; temporary failures are retained.
  if(response.status===404||response.status===410){
   await env.SETTINGS.delete(device.name);
  }else if(response.status===400){
   const detail=await response.text();
   if(/UNREGISTERED|registration.token|invalid registration|UNREGISTERED/i.test(detail))
    await env.SETTINGS.delete(device.name);
  }
 }
 return {sent};
}
async function pushRegister(req,env){
 let data;try{data=await body(req,5500)}catch(e){return res({error:"bad_request"},400)}
 const device=typeof data?.device==="string"?data.device:"";
 if(!/^[a-f0-9]{32}$/.test(device)||!fcmTokenValid(data?.fcm))return res({error:"bad_device"},400);
 const existing=await env.SETTINGS.get(PUSH_PREFIX+device,"json");
 if(!existing){
  const all=await env.SETTINGS.list({prefix:PUSH_PREFIX,limit:100});
  if(all.keys.length>=PUSH_LIMIT)return res({error:"device_limit"},409);
 }
 await env.SETTINGS.put(PUSH_PREFIX+device,JSON.stringify({fcm:data.fcm,registered:new Date().toISOString()}),
  {expirationTtl:PUSH_TTL});
 return res({ok:true,push_available:!!fcmConfig(env)});
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
  tapSize:["standard","large"],memoLayout:["standard","compact","roomy"],memoAlerts:["on","off"]
 };
 const defaults={quickOrder:"standard",accent:"brand",tradeAmount:"standard",cancelled:"standard",
  memoOrder:"newest",memoCompleted:"hide",memoRefresh:"45",memoClock:"12",memoPhones:"on",
  tapSize:"standard",memoLayout:"standard",memoAlerts:"on"};
 const p={schema:1};
 for(const [k,values]of Object.entries(allowed)){
  const raw=x.preferences[k]===undefined?defaults[k]:x.preferences[k];
  if(!values.includes(raw))throw Error("invalid_"+k);
  p[k]=raw;
 }
 return {schema:1,type:"firsthyundai-ui-settings",preferences:p,tradePopup:x.tradePopup};
}
async function body(req,maxBytes=2400){
 const size=Number(req.headers.get("content-length")||0);
 if(size>maxBytes)throw Error("large");
 const bytes=await req.arrayBuffer();
 if(bytes.byteLength>maxBytes)throw Error("large");
 return JSON.parse(new TextDecoder().decode(bytes));
}
export default {async fetch(req,env,ctx){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 const url=new URL(req.url);
 if(!env.SETTINGS)return res({error:"kv_not_configured"},503);
 if(url.pathname==="/health"&&req.method==="GET")return res({ok:true,storage:true,
  authConfigured:!!env.FIRSTHYUNDAI_ADMIN_CODE,boardAuthConfigured:!!env.FIRSTHYUNDAI_ACCESS_CODE,fcmConfigured:!!fcmConfig(env)});
 if(url.pathname.startsWith("/board"))return boardCommand(req,env,url,ctx);
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
},_test:{validate,token,checkToken,same,validBoardToken,boardToken,validBoardText,boardList,fcmConfig,fcmTokenValid,sendPush}};
