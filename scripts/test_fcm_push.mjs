import assert from "node:assert/strict";
import svc from "../workers/shared-settings/src/index.mjs";

const store=new Map(),metadata=new Map(),calls=[],waiting=[];
const keys=await crypto.subtle.generateKey({
 name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
},true,["sign","verify"]);
const pkcs8=new Uint8Array(await crypto.subtle.exportKey("pkcs8",keys.privateKey));
const pem="-----BEGIN PRIVATE KEY-----\n"+Buffer.from(pkcs8).toString("base64").match(/.{1,64}/g).join("\n")+"\n-----END PRIVATE KEY-----\n";
const env={
 FIRSTHYUNDAI_ADMIN_CODE:"AdminSecretForTest2026",
 FIRSTHYUNDAI_ACCESS_CODE:"familycode2026",
 FHD_FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({
  type:"service_account",project_id:"firsthyundai-test-123",
  client_email:"firebase-adminsdk@firsthyundai-test-123.iam.gserviceaccount.com",
  private_key:pem
 }),
 FHD_FIREBASE_ANDROID_JSON:JSON.stringify({
  app_id:"1:123456789012:android:0123456789abcdef",
  api_key:"AIza"+"A".repeat(33),project_id:"firsthyundai-test-123",
  sender_id:"123456789012"
 }),
 SETTINGS:{
  async get(key,type){const v=store.get(key);return type==="json"?(v?JSON.parse(v):null):v||null},
  async put(key,value,options={}){store.set(key,value);metadata.set(key,options.metadata||{})},
  async delete(key){store.delete(key);metadata.delete(key)},
  async list({prefix,limit}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort()
   .slice(0,limit).map(name=>({name,metadata:metadata.get(name)||{}}))}}
 },
 AUTH_LIMITER:{async limit(){return {success:true}}}
};
const savedFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const uri=String(url);calls.push({uri,options});
 if(uri==="https://oauth2.googleapis.com/token"){
  assert(!String(options.body).includes("PRIVATE KEY"));
  return new Response(JSON.stringify({access_token:"test-oauth-access-token",expires_in:3600}),{status:200});
 }
 assert(uri==="https://fcm.googleapis.com/v1/projects/firsthyundai-test-123/messages:send");
 assert.equal(options.headers.Authorization,"Bearer test-oauth-access-token");
 const msg=JSON.parse(options.body).message;
 assert.equal(msg.data.kind,"office_note");
 assert(/^[a-z0-9]{8,14}-[0-9a-f-]{36}$/.test(msg.data.note_id));
 assert.equal(msg.android.priority,"HIGH");
 assert.equal(msg.notification,undefined,"Customer memo text never enters push payload");
 assert(!options.body.includes("010-1234-5678"));
 return new Response(JSON.stringify({name:"projects/example/messages/1"}),{status:200});
};
const base="https://firsthyundai-shared-settings.jwj2477.workers.dev";
const req=(path,method="GET",data=null,token="")=>{
 const headers={};if(token)headers.Authorization="Bearer "+token;
 if(data!==null)headers["Content-Type"]="application/json";
 return svc.fetch(new Request(base+path,{method,headers,
  body:data===null?undefined:JSON.stringify(data)}),env,{waitUntil(task){waiting.push(task)}});
};
try{
 assert.equal((await req("/board/push/config")).status,401,
  "Firebase public config is distributed only to signed-in office devices");
 assert.equal((await req("/board/push/register","POST",{device:"0".repeat(32),fcm:"a".repeat(100)})).status,401,
  "Unauthenticated devices cannot subscribe");
 const choices=(await (await req("/board/choices","POST",{code:"familycode2026"})).json()).accounts;
 const member=choices[0].id;
 const da="a".repeat(32),db="b".repeat(32),dc="c".repeat(32);
 const auth=await (await req("/board/session","POST",{code:"familycode2026",member_id:member,device:da})).json();
 assert(auth.token);
 const t=auth.token;
 assert((await (await req("/board/push/status","GET",null,t)).json()).push_available);
 const options=await (await req("/board/push/config","GET",null,t)).json();
 assert(options.configured&&options.push_available);
 assert.equal(options.config.project_id,"firsthyundai-test-123");
 assert(!JSON.stringify(options).includes("PRIVATE KEY"));
 assert(!JSON.stringify(options).includes("adminsdk@"));
 const a=await req("/board/push/register","POST",{device:da,fcm:"token:AAA_"+ "A".repeat(95)},t);
 assert.equal(a.status,200);
 const tb=(await (await req("/board/session","POST",{code:"familycode2026",member_id:member,device:db})).json()).token;
 const b=await req("/board/push/register","POST",{device:db,fcm:"token:BBB_"+ "B".repeat(95)},tb);
 assert.equal(b.status,200);
 const wrong=await req("/board/push/register","POST",{device:"x".repeat(32),fcm:"bad"},t);
 assert.equal(wrong.status,400);
 const content="오후 3시 1502동 3004호 방문 · 손님 010-1234-5678";
 assert.equal((await req("/board","POST",{text:content,device:"a".repeat(32)},t)).status,201);
 await Promise.all(waiting.splice(0));
 const pushes=calls.filter(c=>c.uri.includes("fcm.googleapis.com"));
 assert.equal(pushes.length,1,"Push only to other registered device, never sender");
 assert.equal(JSON.parse(pushes[0].options.body).message.token,"token:BBB_"+ "B".repeat(95));
 assert(!JSON.stringify(await (await req("/board/updates","GET",null,t)).json()).includes("token:BBB"));
 const note=(await (await req("/board","GET",null,t)).json()).notes[0];
 assert.equal((await req("/board/"+note.id,"PATCH",{done:true},t)).status,200);
 await Promise.all(waiting.splice(0));
 assert.equal(calls.filter(c=>c.uri.includes("fcm.googleapis.com")).length,1,
  "No push on completion or edit");
 env.FIRSTHYUNDAI_ACCESS_CODE="rotatedfamilycode2026";
 assert.equal((await req("/board","GET",null,t)).status,401);
 const fresh=(await (await req("/board/session","POST",{code:"rotatedfamilycode2026",member_id:member,device:dc})).json()).token;
 assert.equal((await req("/board","POST",{text:"새로운 공유 메모",device:"c".repeat(32)},fresh)).status,201);
 await Promise.all(waiting.splice(0));
 assert.equal(calls.filter(c=>c.uri.includes("fcm.googleapis.com")).length,1,
  "Revoked devices no longer receive push after access code rotation");
 const info=await (await req("/health")).json();
 assert.equal(info.fcmConfigured,true);
 console.log("FCM push tests passed: authenticated registration, other device only, no private text, no extra edit pushes, rotated access revokes old devices.");
}finally{globalThis.fetch=savedFetch;}
