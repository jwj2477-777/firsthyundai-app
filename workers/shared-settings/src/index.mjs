import {themeWeather,weatherBriefing} from './theme-weather.mjs';
/* Public settings reader; authenticated administrator writer. */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type","X-Content-Type-Options":"nosniff"};
const key="office-general-settings-v1", enc=new TextEncoder();
const BOARD_PREFIX="office-postit-v1:", BOARD_MAX_CHARS=1600;
const BOARD_IMAGE_PREFIX="office-postit-image-v1:", BOARD_IMAGE_LIMIT=3, BOARD_IMAGE_MAX=195000;
const BOARD_IMAGE_TTL=400*86400;
const validImageId=x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x);
function validImageData(value){
 if(typeof value!=="string"||value.length<150||value.length>BOARD_IMAGE_MAX||
    !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
 try{return atob(value.slice("data:image/jpeg;base64,".length)).length>=80}catch(e){return false}
}

const BOARD_LIFETIME_DAYS=365, BOARD_ARCHIVE_PREFIX="office-postit-archive-v1:", BOARD_ARCHIVE_DAYS=30;
const MEMBER_PREFIX="office-member-v2:", DEVICE_PREFIX="office-member-device-v2:";
const validMemberId=id=>typeof id==="string"&&/^[0-9a-f-]{36}$/.test(id);
const validDeviceId=id=>typeof id==="string"&&/^[a-f0-9]{32}$/.test(id);
function safeMemberName(v){
 if(typeof v!=="string")throw Error("bad_name");
 const n=v.trim().replace(/\s+/g," ");
 if(n.length<1||n.length>24||/[<>\u0000-\u001f]/.test(n))throw Error("bad_name");
 return n;
}
// Four handsets (two for the administrator) share THREE logical user profiles.
// Legacy installs may have created duplicate admin records with distinct UUIDs.
// Hide duplicate display identities but NEVER delete their KV records, revoke
// existing device tokens, or rewrite the authors of old shared notes.
function memberIdentity(name){
 const normalized=String(name||"").trim().replace(/\s+/g," ");
 if(/^(관리자(?:\s*계정)?|Admin)$/i.test(normalized))return "관리자";
 return normalized;
}
async function memberList(env){
 const keys=await env.SETTINGS.list({prefix:MEMBER_PREFIX,limit:100});
 const found=(await Promise.all(keys.keys.map(v=>env.SETTINGS.get(v.name,"json"))))
  .filter(v=>v&&validMemberId(v.id)&&v.active===true);
 const grouped=new Map();
 for(const member of found){
  const label=memberIdentity(member.name);
  const records=grouped.get(label)||[];
  records.push(member);grouped.set(label,records);
 }
 // Keep the most-used existing account when old installations created duplicates.
 // Existing session tokens on other IDs remain valid; do not silently merge them.
 const hasDuplicates=[...grouped.values()].some(group=>group.length>1);
 const connected=new Map();
 if(hasDuplicates){
  const bindings=await env.SETTINGS.list({prefix:DEVICE_PREFIX,limit:1000});
  await Promise.all(bindings.keys.map(async item=>{
   const device=await env.SETTINGS.get(item.name,"json");
   if(device?.member_id&&device.revoked!==true)
    connected.set(device.member_id,(connected.get(device.member_id)||0)+1);
  }));
 }
 const members=[...grouped.entries()].map(([name,candidates])=>{
  candidates.sort((a,b)=>(connected.get(b.id)||0)-(connected.get(a.id)||0)||
   Number(a.name!==name)-Number(b.name!==name)||
   String(a.created_at||"").localeCompare(String(b.created_at||""))||
   a.id.localeCompare(b.id));
  return {id:candidates[0].id,name};
 });
 const preferred=["관리자","엄마","아빠"];
 return members.sort((a,b)=>{
  const ai=preferred.indexOf(a.name),bi=preferred.indexOf(b.name);
  return (ai>=0?ai:preferred.length)-(bi>=0?bi:preferred.length)||a.name.localeCompare(b.name,"ko");
 });
}
// Bootstrap exactly once, before the first device signs in. Existing members
// survive upgrades. A removed member is never silently recreated.
const DEFAULT_MEMBERS_KEY="office-member-defaults-v3";
const DEFAULT_MEMBERS=[
 {id:"77d4f48a-02b3-4dc3-8e1e-202610260001",name:"관리자"},
 {id:"77d4f48a-02b3-4dc3-8e1e-202610260002",name:"엄마"},
 {id:"77d4f48a-02b3-4dc3-8e1e-202610260003",name:"아빠"}
];
async function ensureDefaultMembers(env){
 if(await env.SETTINGS.get(DEFAULT_MEMBERS_KEY,"json"))return;
 const all=await env.SETTINGS.list({prefix:MEMBER_PREFIX,limit:100});
 const found=(await Promise.all(all.keys.map(v=>env.SETTINGS.get(v.name,"json"))))
  .filter(x=>x&&validMemberId(x.id));
 const known=new Set(found.map(x=>x.name));
 // Use stable IDs for idempotent retries, not random IDs that can multiply.
 for(const member of DEFAULT_MEMBERS){
  if(known.has(member.name))continue;
  const record={...member,active:true,created_at:new Date().toISOString(),initial:true};
  await env.SETTINGS.put(MEMBER_PREFIX+record.id,JSON.stringify(record));
 }
 // This marker prevents deleted default profiles from returning on future requests.
 await env.SETTINGS.put(DEFAULT_MEMBERS_KEY,JSON.stringify({seeded:true,at:new Date().toISOString()}));
}
const res=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:HEAD});
function b64(buf){const x=buf instanceof Uint8Array?buf:new Uint8Array(buf);return btoa(String.fromCharCode(...x)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decoded(x){if(!/^[A-Za-z0-9_-]+$/.test(x)||x.length>1200)throw Error("bad_token");const b=atob(x.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-x.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function hkey(secret){return crypto.subtle.importKey("raw",enc.encode("fhd-shared:v1:"+secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
async function token(secret){const part=b64(enc.encode(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,nonce:b64(crypto.getRandomValues(new Uint8Array(16)))})));return part+"."+b64(await crypto.subtle.sign("HMAC",await hkey(secret),enc.encode(part)))}
async function checkToken(value,secret){try{if(!value||value.length>1100)return false;const parts=value.split(".");if(parts.length!==2)return false;const p=JSON.parse(new TextDecoder().decode(decoded(parts[0])));const now=Math.floor(Date.now()/1000);if(!Number.isSafeInteger(p.exp)||p.exp<now||p.exp>now+3700)return false;return await crypto.subtle.verify("HMAC",await hkey(secret),decoded(parts[1]),enc.encode(parts[0]))}catch(e){return false}}
async function same(a,b,min=12){if(typeof a!=="string"||a.length<min||a.length>64||!b)return false;const [x,y]=await Promise.all([a,b].map(async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))));let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function boardToken(secret,member,device,binding){
 const part=b64(enc.encode(JSON.stringify({scope:"board-v2",member,device,binding,
  exp:Math.floor(Date.now()/1000)+60*60*24*60,
  nonce:b64(crypto.getRandomValues(new Uint8Array(16)))})));
 return part+"."+b64(await crypto.subtle.sign("HMAC",await hkey("board:"+secret),enc.encode(part)));
}
async function validBoardToken(value,secret,env){
 try{
  if(!secret||!value||value.length>1100)return null;
  const bits=value.split(".");if(bits.length!==2)return null;
  const p=JSON.parse(new TextDecoder().decode(decoded(bits[0]))),now=Math.floor(Date.now()/1000);
  if(p.scope!=="board-v2"||!Number.isSafeInteger(p.exp)||p.exp<now||p.exp>now+5184000||
     !validMemberId(p.member)||!validDeviceId(p.device)||!validMemberId(p.binding))return null;
  if(!await crypto.subtle.verify("HMAC",await hkey("board:"+secret),decoded(bits[1]),enc.encode(bits[0])))return null;
  const [member,device]=await Promise.all([env.SETTINGS.get(MEMBER_PREFIX+p.member,"json"),env.SETTINGS.get(DEVICE_PREFIX+p.device,"json")]);
  if(member?.active!==true||device?.revoked===true||device?.member_id!==p.member||device?.binding!==p.binding)return null;
  return {member,deviceId:p.device};
 }catch(e){return null}
}
function validBoardText(text){
 if(typeof text!=="string")throw Error("not_string");
 const normalized=text.replace(/\r\n?/g,"\n").trim();
 if(!normalized||normalized.length>BOARD_MAX_CHARS)throw Error("bad_length");
 return normalized;
}
function boardSchedule(value){
 if(value===undefined||value===null||value==="")return null;
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.000Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error("invalid_schedule");
 const year=Number(value.slice(0,4));if(year<2020||year>2100||new Date(value).toISOString()!==value)throw Error("invalid_schedule");
 return value;
}
const validBoardId=x=>typeof x==="string"&&/^([a-z0-9]{8,14})-([0-9a-f-]{36})$/.test(x);
// Bound every public-facing (authenticated) board response to 25 memos.
// This avoids one oversized Android response and large bursts of KV lookups.
// KV names are chronological; offset 0 is the newest page.
const BOARD_CACHE_REV="office-postit-cache-revision-v1";
const BOARD_CACHE_PREFIX="office-postit-cache-v1:";
const BOARD_CACHE_TTL=300;
async function cachedPrivateBoard(env,key,producer){
 let revision="";
 try{
  revision=await env.SETTINGS.get(BOARD_CACHE_REV)||"initial";
  const saved=await env.SETTINGS.get(BOARD_CACHE_PREFIX+key,"json");
  if(saved?.revision===revision&&saved?.stored_at>Date.now()-BOARD_CACHE_TTL*1000&&
      saved?.payload!==undefined)return saved.payload;
 }catch(e){/* Read failures must not prevent a direct authorized board read. */}
 const payload=await producer();
 try{await env.SETTINGS.put(BOARD_CACHE_PREFIX+key,
  JSON.stringify({revision,payload,stored_at:Date.now()}),
  {expirationTtl:BOARD_CACHE_TTL});}
 catch(e){/* Cache is optional. Never discard a successfully loaded memo list. */}
 return payload;
}
async function invalidateBoardCache(env){
 try{await env.SETTINGS.put(BOARD_CACHE_REV,crypto.randomUUID());}
 catch(e){console.warn("office_board_cache_invalidation_deferred");}
}
const BOARD_PAGE_SIZE=25;
async function boardPage(env,offset=0){
 const keys=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
 const names=keys.keys.filter(k=>validBoardId(k.name.slice(BOARD_PREFIX.length)));
 const end=Math.max(0,names.length-offset);
 const page=names.slice(Math.max(0,end-BOARD_PAGE_SIZE),end);
 const loaded=await Promise.all(page.map(async k=>{
  try{return await env.SETTINGS.get(k.name,"json")}catch(e){return null}
 }));
 const notes=loaded.filter(n=>n&&validBoardId(n.id)&&
  typeof n.text==="string"&&typeof n.done==="boolean")
  .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 return {schema:1,notes,total:names.length,
  has_more:offset+BOARD_PAGE_SIZE<names.length,next_offset:offset+BOARD_PAGE_SIZE};
}
async function boardList(env){
 return cachedPrivateBoard(env,"scheduled",async()=>{
 const keys=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
 // Each post-it has its own KV key, so simultaneous posts never overwrite one another.
 const latest=keys.keys.slice(-100);
 const notes=await Promise.all(latest.map(async item=>{
  try{return await env.SETTINGS.get(item.name,"json")}catch(e){return null}
 }));
 return notes.filter(x=>x&&validBoardId(x.id)&&typeof x.text==="string"&&
  typeof x.done==="boolean").sort((a,b)=>b.created_at.localeCompare(a.created_at));
 });
}
async function boardCommand(req,env,url,ctx){
 if(!env.FIRSTHYUNDAI_ACCESS_CODE)return res({error:"board_auth_not_configured"},503);
 // All board data (including phone numbers) is private, on GET as well as writes.
 if(req.headers.has("origin"))return res({error:"native_only"},403);
 if((url.pathname==="/board/choices"||url.pathname==="/board/session")&&req.method==="POST"){
  if(!env.AUTH_LIMITER)return res({error:"rate_limit_unavailable"},503);
  if(!(await env.AUTH_LIMITER.limit({key:"board-enrollment"})).success)return res({error:"rate_limited"},429);
  let data;try{data=await body(req,3000)}catch(e){return res({error:"bad_request"},400)}
  if(!await same(data?.code,env.FIRSTHYUNDAI_ACCESS_CODE,8))return res({error:"unauthorized"},401);
  await ensureDefaultMembers(env);
  if(url.pathname==="/board/choices")return res({accounts:await memberList(env)});
  const account=typeof data?.member_id==="string"?data.member_id:"";
  const deviceId=typeof data?.device==="string"?data.device:"";
  if(!validMemberId(account)||!validDeviceId(deviceId))return res({error:"account_selection_required"},400);
  const member=await env.SETTINGS.get(MEMBER_PREFIX+account,"json");
  if(member?.active!==true)return res({error:"account_removed"},403);
  // A device may not silently change identity after it has been assigned.
  const existing=await env.SETTINGS.get(DEVICE_PREFIX+deviceId,"json");
  if(existing?.revoked===true)return res({error:"device_revoked"},403);
  // Existing members can choose a different account only on their already
  // authorized device AND after supplying the shared code again.
  // Rotating the binding invalidates the previous member's 60-day token.
  const changing=!!existing&&existing.member_id!==account;
  if(changing){
   const bearer=req.headers.get("authorization")||"";
   const previous=bearer.startsWith("Bearer ")?await validBoardToken(bearer.slice(7),env.FIRSTHYUNDAI_ACCESS_CODE,env):null;
   if(data?.reassign!==true||!previous||previous.deviceId!==deviceId||
     previous.member.id!==existing.member_id)return res({error:"device_already_assigned"},409);
  }
  const binding=changing?crypto.randomUUID():(existing?.binding||crypto.randomUUID());
  await env.SETTINGS.put(DEVICE_PREFIX+deviceId,
   JSON.stringify({member_id:account,binding,created_at:existing?.created_at||new Date().toISOString()}));
  return res({token:await boardToken(env.FIRSTHYUNDAI_ACCESS_CODE,account,deviceId,binding),
   member:{id:member.id,name:member.name},expires_in:5184000});
 }
 const auth=req.headers.get("authorization")||"";
 const caller=auth.startsWith("Bearer ")?await validBoardToken(auth.slice(7),env.FIRSTHYUNDAI_ACCESS_CODE,env):null;
 if(!caller)return res({error:"account_session_required"},401);
 const adminHeader=req.headers.get("x-fhd-admin-authorization")||"";
 const isAdmin=async()=>!!env.FIRSTHYUNDAI_ADMIN_CODE&&adminHeader.startsWith("Bearer ")&&
  await checkToken(adminHeader.slice(7),env.FIRSTHYUNDAI_ADMIN_CODE);
 // Author identity is the immutable account ID recorded at creation, not an
 // editable display name or an arbitrary device ID. Admin override must have
 // a separate verified administrator session; the family board token alone is
 // never an administrator credential.
 const canModifyNote=async note=>note?.author?.id===caller.member.id||await isAdmin();
 if(url.pathname==="/board/accounts"&&req.method==="GET")
  return res({accounts:await memberList(env),current:{id:caller.member.id,name:caller.member.name}});
 if(url.pathname==="/board/account"&&req.method==="GET")
  return res({member:{id:caller.member.id,name:caller.member.name},active:true});
 if(url.pathname==="/board/members"&&req.method==="GET"){
  if(!await isAdmin())return res({error:"admin_required"},403);
  return res({accounts:await memberList(env)});
 }
 if(url.pathname==="/board/members"&&req.method==="POST"){
  if(!await isAdmin())return res({error:"admin_required"},403);
  let data,name;try{data=await body(req,1000);name=safeMemberName(data?.name)}
  catch(e){return res({error:"invalid_name"},400)}
  const members=await memberList(env);
  if(members.length>=20)return res({error:"account_limit"},409);
  if(members.some(m=>m.name===name))return res({error:"duplicate_name"},409);
  const account={id:crypto.randomUUID(),name,active:true,created_at:new Date().toISOString()};
  await env.SETTINGS.put(MEMBER_PREFIX+account.id,JSON.stringify(account));
  return res({ok:true,account:{id:account.id,name}},201);
 }
 const accountRename=url.pathname.match(/^\/board\/members\/([0-9a-f-]{36})\/rename$/);
 if(accountRename&&req.method==="PATCH"){
  if(!await isAdmin())return res({error:"admin_required"},403);
  let payload,name;try{payload=await body(req,1000);name=safeMemberName(payload?.name)}
  catch(e){return res({error:"invalid_name"},400)}
  const account=await env.SETTINGS.get(MEMBER_PREFIX+accountRename[1],"json");
  if(account?.active!==true)return res({error:"not_found"},404);
  const records=await env.SETTINGS.list({prefix:MEMBER_PREFIX,limit:100});
  const all=(await Promise.all(records.keys.map(k=>env.SETTINGS.get(k.name,"json"))))
   .filter(v=>v?.active===true&&validMemberId(v.id));
  const oldIdentity=memberIdentity(account.name),newIdentity=memberIdentity(name);
  const group=all.filter(v=>memberIdentity(v.name)===oldIdentity);
  if(all.some(v=>memberIdentity(v.name)===newIdentity&&!group.some(g=>g.id===v.id)))
   return res({error:"duplicate_name"},409);
  // A shared identity may belong to two legacy admin records. Rename both
  // while keeping member IDs / authenticated sessions / phone bindings intact.
  const at=new Date().toISOString();
  await Promise.all(group.map(async v=>{
   await env.SETTINGS.put(MEMBER_PREFIX+v.id,
    JSON.stringify({...v,name,updated_at:at}));
  }));
  return res({ok:true,account:{id:account.id,name},affected:group.length});
 }
 const accountDelete=url.pathname.match(/^\/board\/members\/([0-9a-f-]{36})$/);
 if(accountDelete&&req.method==="DELETE"){
  if(!await isAdmin())return res({error:"admin_required"},403);
  if(accountDelete[1]===caller.member.id)return res({error:"cannot_delete_current_account"},409);
  const account=await env.SETTINGS.get(MEMBER_PREFIX+accountDelete[1],"json");
  if(!account||account.active!==true)return res({error:"not_found"},404);
  const members=await memberList(env);
  if(members.length<=1)return res({error:"last_account"},409);
  account.active=false;account.deleted_at=new Date().toISOString();
  await env.SETTINGS.put(MEMBER_PREFIX+account.id,JSON.stringify(account));
  const keys=await env.SETTINGS.list({prefix:DEVICE_PREFIX,limit:1000});
  for(const item of keys.keys){
   const binding=await env.SETTINGS.get(item.name,"json");
   if(binding?.member_id===account.id){
    await env.SETTINGS.put(item.name,JSON.stringify({...binding,revoked:true,revoked_at:new Date().toISOString()}));
    await env.SETTINGS.delete(PUSH_PREFIX+item.name.slice(DEVICE_PREFIX.length));
   }
  }
  return res({ok:true});
 }
 if(url.pathname==="/board/archive"&&req.method==="GET"){
  if(!await isAdmin())return res({error:"admin_required"},403);
  const keys=await env.SETTINGS.list({prefix:BOARD_ARCHIVE_PREFIX,limit:200});
  const archived=(await Promise.all(keys.keys.slice(-100).map(x=>env.SETTINGS.get(x.name,"json"))))
   .filter(x=>x&&validBoardId(x.id)&&typeof x.deleted_at==="string");
  return res({schema:1,notes:archived.sort((a,b)=>b.deleted_at.localeCompare(a.deleted_at))});
 }
 const restoring=url.pathname.match(/^\/board\/archive\/([a-z0-9-]{45,51})\/restore$/);
 if(restoring&&req.method==="POST"&&validBoardId(restoring[1])){
  if(!await isAdmin())return res({error:"admin_required"},403);
  const archiveKey=BOARD_ARCHIVE_PREFIX+restoring[1];
  const saved=await env.SETTINGS.get(archiveKey,"json");
  if(!saved)return res({error:"not_found"},404);
  if(await env.SETTINGS.get(BOARD_PREFIX+restoring[1]))return res({error:"already_exists"},409);
  delete saved.deleted_at;
  await env.SETTINGS.put(BOARD_PREFIX+restoring[1],JSON.stringify(saved),{expirationTtl:BOARD_LIFETIME_DAYS*86400});
  await env.SETTINGS.delete(archiveKey);
  await invalidateBoardCache(env);
  return res({ok:true,note:saved});
 }
 if(url.pathname==="/board/push/register"&&req.method==="POST")return pushRegister(req,env,caller);
 if(url.pathname==="/board/push/status"&&req.method==="GET")return res({push_available:!!fcmConfig(env)});
 if(url.pathname==="/board/push/config"&&req.method==="GET"){
  const config=fcmPublicConfig(env);
  return res({configured:!!config,push_available:!!fcmConfig(env),config:config||null});
 }
 // Authenticated photos: image bytes never enter the public settings endpoint.
 const imageRoute=url.pathname.match(/^\/board\/([a-z0-9-]{45,51})\/images(?:\/([0-9a-f-]{36}))?$/);
 if(imageRoute&&validBoardId(imageRoute[1])){
  const noteId=imageRoute[1],photoId=imageRoute[2],noteKey=BOARD_PREFIX+noteId;
  const note=await env.SETTINGS.get(noteKey,"json");
  if(!note)return res({error:"not_found"},404);
  const images=Array.isArray(note.images)?note.images.filter(validImageId):[];
  if(req.method==="POST"&&!photoId){
   if(!await canModifyNote(note))return res({error:"memo_edit_forbidden"},403);
   if(images.length>=BOARD_IMAGE_LIMIT)return res({error:"image_limit"},409);
   let data;try{data=await body(req,BOARD_IMAGE_MAX+250)}catch(e){return res({error:"invalid_image"},400)}
   if(!validImageData(data?.data_url))return res({error:"invalid_image"},400);
   const imageId=crypto.randomUUID();
   await env.SETTINGS.put(BOARD_IMAGE_PREFIX+imageId,data.data_url,{expirationTtl:BOARD_IMAGE_TTL});
   const updated={...note,images:[...images,imageId],updated_at:new Date().toISOString(),
    edited_by:{id:caller.member.id,name:caller.member.name}};
   try{
    await env.SETTINGS.put(noteKey,JSON.stringify(updated),
      {expirationTtl:BOARD_LIFETIME_DAYS*86400});
   }catch(e){await env.SETTINGS.delete(BOARD_IMAGE_PREFIX+imageId);throw e}
   await invalidateBoardCache(env);
   return res({ok:true,note:updated,image_id:imageId},201);
  }
  if(photoId&&images.includes(photoId)&&req.method==="GET"){
   const data=await env.SETTINGS.get(BOARD_IMAGE_PREFIX+photoId);
   if(!validImageData(data))return res({error:"image_missing"},404);
   return res({data_url:data});
  }
  if(photoId&&images.includes(photoId)&&req.method==="DELETE"){
   if(!await canModifyNote(note))return res({error:"memo_edit_forbidden"},403);
   const updated={...note,images:images.filter(id=>id!==photoId),updated_at:new Date().toISOString(),
    edited_by:{id:caller.member.id,name:caller.member.name}};
   await env.SETTINGS.put(noteKey,JSON.stringify(updated),
     {expirationTtl:BOARD_LIFETIME_DAYS*86400});
   await env.SETTINGS.delete(BOARD_IMAGE_PREFIX+photoId);
   await invalidateBoardCache(env);
   return res({ok:true,note:updated});
  }
  return res({error:"not_found"},404);
 }
 // Give an already-authenticated handset a short preview when a new note arrives.
 // The push payload contains only an ID; private text is not sent through FCM.
 const previewRoute=url.pathname.match(/^\/board\/([a-z0-9-]{45,51})\/preview$/);
 if(previewRoute&&req.method==="GET"&&validBoardId(previewRoute[1])){
  const note=await env.SETTINGS.get(BOARD_PREFIX+previewRoute[1],"json");
  if(!note||typeof note.text!=="string")return res({error:"not_found"},404);
  const author=typeof note.author?.name==="string"?note.author.name.slice(0,24):"사무실";
  const snippet=note.text.replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim().slice(0,110);
  return res({author,preview:snippet,image_count:Array.isArray(note.images)?note.images.length:0,
   scheduled_at:typeof note.scheduled_at==="string"?note.scheduled_at:null,
   all_day:note.all_day===true,done:note.done===true});
 }
 if(url.pathname==="/board"&&req.method==="GET"){
  // Older APKs call /board without offset. Preserve their original full-list
  // response until all four family phones can update, using a private KV cache.
  if(!url.searchParams.has("offset"))
   return res({schema:1,notes:await boardList(env)});
  const offsetRaw=url.searchParams.get("offset")||"0";
  if(!/^\d{1,4}$/.test(offsetRaw)||Number(offsetRaw)>1000)
   return res({error:"invalid_page"},400);
  return res(await cachedPrivateBoard(env,"page-"+offsetRaw,()=>boardPage(env,Number(offsetRaw))));
 }
 if(url.pathname==="/board/updates"&&req.method==="GET"){
  const list=await env.SETTINGS.list({prefix:BOARD_PREFIX,limit:1000});
  const items=list.keys.slice(-120).filter(x=>validBoardId(x.name.slice(BOARD_PREFIX.length)))
   .map(x=>({id:x.name.slice(BOARD_PREFIX.length),device:x.metadata?.device||""}));
  return res({schema:1,items});
 }
 if(url.pathname==="/board"&&req.method==="POST"){
  let data,content,scheduled;try{data=await body(req,7000);content=validBoardText(data?.text);scheduled=boardSchedule(data?.scheduled_at)}
  catch(e){return res({error:"invalid_note"},400)}
  const device=caller.deviceId;
  const id=Date.now().toString(36).padStart(9,"0")+"-"+crypto.randomUUID(),now=new Date().toISOString();
  const record={id,text:content,done:false,pinned:false,scheduled_at:scheduled,all_day:data?.all_day===true,created_at:now,updated_at:now,author:{id:caller.member.id,name:caller.member.name}};
  await env.SETTINGS.put(BOARD_PREFIX+id,JSON.stringify(record),
   {expirationTtl:BOARD_LIFETIME_DAYS*86400,metadata:{device}});
  await invalidateBoardCache(env);
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
  if(req.method==="DELETE"){
   if(!await isAdmin())return res({error:"admin_required"},403);
   const deleted={...saved,deleted_at:new Date().toISOString()};
   await env.SETTINGS.put(BOARD_ARCHIVE_PREFIX+match[1],JSON.stringify(deleted),{expirationTtl:BOARD_ARCHIVE_DAYS*86400});
   await env.SETTINGS.delete(memoKey);
   await invalidateBoardCache(env);
   return res({ok:true,archived:true});
  }
  if(!await canModifyNote(saved))return res({error:"memo_edit_forbidden"},403);
  let data;try{data=await body(req,7000)}catch(e){return res({error:"bad_request"},400)}
  if(!data||typeof data!=="object")return res({error:"invalid_note"},400);
  const patchKeys=Object.keys(data);
  if(!patchKeys.length||patchKeys.some(k=>!["text","done","scheduled_at","all_day","pinned"].includes(k))||
   (data.done!==undefined&&typeof data.done!=="boolean")||
   (data.pinned!==undefined&&typeof data.pinned!=="boolean"))return res({error:"invalid_patch"},400);
  if(data.text!==undefined){
   try{saved.text=validBoardText(data.text)}catch(e){return res({error:"invalid_note"},400)}
  }
  if(data.scheduled_at!==undefined){
   try{saved.scheduled_at=boardSchedule(data.scheduled_at)}catch(e){return res({error:"invalid_schedule"},400)}
  }
  if(data.all_day!==undefined){if(typeof data.all_day!=="boolean")return res({error:"invalid_all_day"},400);saved.all_day=data.all_day;}
  if(data.done!==undefined)saved.done=data.done;
  if(data.pinned!==undefined)saved.pinned=data.pinned;
  saved.edited_by={id:caller.member.id,name:caller.member.name};
  saved.updated_at=new Date().toISOString();
  await env.SETTINGS.put(memoKey,JSON.stringify(saved),
   {expirationTtl:BOARD_LIFETIME_DAYS*86400});
  await invalidateBoardCache(env);
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
function fcmPublicConfig(env){
 try{
  const raw=env.FHD_FIREBASE_ANDROID_JSON;
  if(!raw||raw.length>18000)return null;
  const doc=JSON.parse(raw);
  let config;
  if(doc.project_info&&Array.isArray(doc.client)){
   const client=doc.client.find(x=>
    x.client_info?.android_client_info?.package_name==="kr.co.firsthyundai.app");
   if(!client)return null;
   config={app_id:client.client_info.mobilesdk_app_id,
    api_key:client.api_key?.[0]?.current_key,
    project_id:doc.project_info.project_id,
    sender_id:String(doc.project_info.project_number||"")};
  }else config={app_id:doc.app_id,api_key:doc.api_key,
   project_id:doc.project_id,sender_id:String(doc.sender_id||"")};
  if(!/^1:[0-9]+:android:[0-9a-fA-F]+$/.test(config.app_id||"")||
   !/^AIza[A-Za-z0-9_-]{20,}$/.test(config.api_key||"")||
   !/^[A-Za-z0-9._-]{3,120}$/.test(config.project_id||"")||
   !/^[0-9]{5,30}$/.test(config.sender_id))return null;
  return config;
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
async function familyRevision(secret){
 const h=await hkey("board-revision:"+secret);
 return b64(await crypto.subtle.sign("HMAC",h,enc.encode("registered-office-devices-v1")));
}
async function sendPush(env,postId,fromDevice,options={}){
 const reminder=options.kind==="office_schedule_reminder"&&
  typeof options.scheduled_at==="string"&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(options.scheduled_at);
 const data=reminder?{kind:"office_schedule_reminder",note_id:postId,
   scheduled_at:options.scheduled_at}:{kind:"office_note",note_id:postId};
 const config=fcmConfig(env);
 if(!config)return {sent:0,reason:"fcm_unconfigured"};
 // Respect the office-wide new memo notification setting, without exposing notes.
 const office=await env.SETTINGS.get(key,"json");
 if(office?.settings?.preferences?.memoAlerts==="off")return {sent:0,reason:"disabled"};
 const keys=await env.SETTINGS.list({prefix:PUSH_PREFIX,limit:100});
 const recipients=keys.keys.filter(k=>reminder||k.name!==PUSH_PREFIX+fromDevice).slice(0,PUSH_LIMIT);
 if(!recipients.length)return {sent:0,reason:"no_devices"};
 const version=await familyRevision(env.FIRSTHYUNDAI_ACCESS_CODE);
 const validRecipients=[];
 for(const device of recipients){
  const record=await env.SETTINGS.get(device.name,"json");
  const binding=await env.SETTINGS.get(DEVICE_PREFIX+device.name.slice(PUSH_PREFIX.length),"json");
  const member=binding&&await env.SETTINGS.get(MEMBER_PREFIX+binding.member_id,"json");
  if(record?.revision===version&&binding?.revoked!==true&&member?.active===true&&fcmTokenValid(record.fcm))
   validRecipients.push({key:device.name,fcm:record.fcm});
 }
 if(!validRecipients.length)return {sent:0,reason:"no_authorized_devices"};
 const auth=await fcmOAuth(env);
 let sent=0;
 for(const device of validRecipients){
  const obj=device;
  // Data-only message: the Android service owns the private lock-screen notification.
  const response=await fetch("https://fcm.googleapis.com/v1/projects/"+config.project_id+"/messages:send",{
   method:"POST",headers:{"Authorization":"Bearer "+auth,"Content-Type":"application/json; charset=utf-8"},
   body:JSON.stringify({message:{token:obj.fcm,data,
     android:{priority:"HIGH",ttl:reminder?"600s":"86400s"}}})
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
/* Server-side 30-minute reminder. Cloudflare cron is independent of users
 * leaving the Android app open. No customer text, account IDs or phone numbers
 * are included in Firebase data-only pushes.
 */
const REMINDER_KEY_PREFIX="office-postit-reminder-v1:";
const THIRTY_MINUTES=30*60000;
function timedMemoDue(note,now){
 if(!note||!validBoardId(note.id)||note.done===true||note.all_day===true||
  typeof note.scheduled_at!=="string"||!Number.isFinite(Date.parse(note.scheduled_at))||
  /^\s*🎂/.test(String(note.text||"")))return false;
 const until=Date.parse(note.scheduled_at)-now;
 // Every-minute cron with jitter tolerance; never notify after a past event.
 return until>=28*60000&&until<=31*60000;
}
async function deliverDueReminders(env,now=Date.now()){
 if(!env?.SETTINGS||!env.FIRSTHYUNDAI_ACCESS_CODE||!fcmConfig(env))
  return {eligible:0,sent:0,reason:"not_ready"};
 const notes=await boardList(env);
 const due=notes.filter(note=>timedMemoDue(note,now)).slice(0,16);
 let sent=0;
 for(const note of due){
  const eventStamp=Date.parse(note.scheduled_at);
  const reminderKey=REMINDER_KEY_PREFIX+note.id+":"+eventStamp;
  if(await env.SETTINGS.get(reminderKey))continue;
  // Re-read before dispatch: another family member may have completed or
  // rescheduled the event since the initial list fetch.
  const fresh=await env.SETTINGS.get(BOARD_PREFIX+note.id,"json");
  if(!fresh||fresh.scheduled_at!==note.scheduled_at||!timedMemoDue(fresh,now))continue;
  try{
   const result=await sendPush(env,note.id,"",{kind:"office_schedule_reminder",
    scheduled_at:note.scheduled_at});
   if(result.sent>0){
    await env.SETTINGS.put(reminderKey,JSON.stringify({sent_at:new Date(now).toISOString()}),
     {expirationTtl:7*86400});
    sent+=result.sent;
   }
  }catch(e){
   // FCM/network errors can retry on the next cron tick without duplicating
   // a successfully sent reminder.
   console.warn("office schedule reminder delivery deferred");
  }
 }
 return {eligible:due.length,sent};
}
async function pushRegister(req,env,caller){
 let data;try{data=await body(req,5500)}catch(e){return res({error:"bad_request"},400)}
 const device=typeof data?.device==="string"?data.device:"";
 if(device!==caller.deviceId||!fcmTokenValid(data?.fcm))return res({error:"bad_device"},400);
 const revision=await familyRevision(env.FIRSTHYUNDAI_ACCESS_CODE);
 const existing=await env.SETTINGS.get(PUSH_PREFIX+device,"json");
 if(!existing){
  const all=await env.SETTINGS.list({prefix:PUSH_PREFIX,limit:100});
  let active=0;
  for(const item of all.keys){
   const value=await env.SETTINGS.get(item.name,"json");
   if(value?.revision===revision)active++;
  }
  if(active>=PUSH_LIMIT)return res({error:"device_limit"},409);
 }
 await env.SETTINGS.put(PUSH_PREFIX+device,
  JSON.stringify({fcm:data.fcm,registered:new Date().toISOString(),revision}),
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
  tapSize:["standard","large"],memoLayout:["standard","compact","roomy"],memoAlerts:["on","off"],
  theme:["default","spring","summer","autumn","winter"],themeMode:["manual","season"],
  weatherEffect:["none","rain","snow","auto"],themeIntensity:["soft","balanced","vivid"],
  themeDecor:["off","subtle","full"],themeHeader:["on","off"],themeIntro:["on","off"],themeLogo:["on","off"],themeCaption:["on","off"]
 };
 const defaults={quickOrder:"standard",accent:"brand",tradeAmount:"standard",cancelled:"standard",
  memoOrder:"newest",memoCompleted:"hide",memoRefresh:"45",memoClock:"12",memoPhones:"on",
  tapSize:"standard",memoLayout:"standard",memoAlerts:"on",theme:"default",themeMode:"manual",weatherEffect:"none",themeIntensity:"balanced",themeDecor:"full",themeHeader:"on",themeIntro:"on",themeLogo:"on",themeCaption:"on"};
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
export default {async scheduled(event,env,ctx){
  const now=Number(event?.scheduledTime)||Date.now();
  await deliverDueReminders(env,now);
 },async fetch(req,env,ctx){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 const url=new URL(req.url);
 if(url.pathname==="/theme-weather"&&req.method==="GET")return themeWeather(env);
 if(url.pathname==="/weather-briefing"&&req.method==="GET")return weatherBriefing(env);
 if(!env.SETTINGS)return res({error:"kv_not_configured"},503);
 if(url.pathname==="/health"&&req.method==="GET"){
  if(env.FIRSTHYUNDAI_ACCESS_CODE)await ensureDefaultMembers(env);
  return res({ok:true,storage:true,defaultAccountsReady:!!(await env.SETTINGS.get(DEFAULT_MEMBERS_KEY,"json")),
  authConfigured:!!env.FIRSTHYUNDAI_ADMIN_CODE,boardAuthConfigured:!!env.FIRSTHYUNDAI_ACCESS_CODE,fcmConfigured:!!fcmConfig(env)});
 }
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
},_test:{validate,token,checkToken,same,validBoardToken,boardToken,validBoardText,boardList,boardSchedule,memberList,boardToken,validBoardToken,fcmConfig,fcmPublicConfig,fcmTokenValid,sendPush,familyRevision,timedMemoDue,deliverDueReminders}};


