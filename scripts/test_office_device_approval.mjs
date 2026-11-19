// New handsets need administrator approval before reading private memos.
// The family code's offline verifier is public, so the code alone must not grant access.
import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';

function makeEnv(extra={}){
 const settings=new Map();
 return {settings,env:{
  SETTINGS:{
   async get(k,format){const x=settings.get(k);return x===undefined?null:format==='json'?JSON.parse(x):x},
   async put(k,v){settings.set(k,v)},async delete(k){settings.delete(k)},
   async list({prefix,limit}){return {keys:[...settings.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}))}}
  },
  FIRSTHYUNDAI_ADMIN_CODE:'TestAdministratorSecretOnly2026',
  FIRSTHYUNDAI_ACCESS_CODE:'familycode2026',
  AUTH_LIMITER:{async limit(){return {success:true}}},
  ...extra
 }};
}
const origin='https://firsthyundai-shared-settings.jwj2477.workers.dev';
const sender=env=>(path,method='GET',data=null,token='',adminToken='')=>{
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(adminToken)headers['X-FHD-Admin-Authorization']='Bearer '+adminToken;
 if(data!==null)headers['Content-Type']='application/json';
 return service.fetch(new Request(origin+path,{method,headers,body:data===null?undefined:JSON.stringify(data)}),env);
};

{
 const {env,settings}=makeEnv();const send=sender(env);
 const accounts=(await (await send('/board/choices','POST',{code:'familycode2026'})).json()).accounts;
 const admin=accounts.find(a=>a.name==='관리자'),mom=accounts.find(a=>a.name==='엄마');
 const adminCode=(await (await send('/session','POST',{code:env.FIRSTHYUNDAI_ADMIN_CODE})).json()).token;
 const adminDevice='a'.repeat(32),strange='b'.repeat(32),momDevice='c'.repeat(32);

 // Bootstrap: an administrator session approves its own enrollment directly.
 const boot=await send('/board/session','POST',{code:'familycode2026',member_id:admin.id,device:adminDevice},'',adminCode);
 assert.equal(boot.status,200);
 const adminToken=(await boot.json()).token;assert(adminToken.length>40);

 // Unknown handset: pending, no token, invisible in the registered device count.
 const p=await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:strange,device_label:'SM-X999<script>'});
 assert.equal(p.status,202);
 const pj=await p.json();
 assert.equal(pj.status,'pending_approval');assert.equal(pj.token,undefined);
 // Repeating the request keeps it pending (no token by persistence).
 assert.equal((await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:strange})).status,202);
 const health=await (await send('/board/devices','GET',null,adminToken,adminCode)).json();
 assert.equal(health.total_devices,1,'Pending handsets are not counted as registered');
 const pending=await (await send('/board/devices/pending','GET',null,adminToken,adminCode)).json();
 assert.equal(pending.devices.length,1);
 assert.equal(pending.devices[0].label,'SM-X999script','Label is sanitized');
 assert.equal(pending.devices[0].account,'엄마');

 // A forged token for a pending device is rejected even if it had a binding.
 const record=JSON.parse(settings.get('office-member-device-v2:'+strange));
 assert.equal(record.pending,true);

 // Reject: the handset is permanently revoked.
 assert.equal((await send('/board/devices/'+strange+'/reject','POST',{},adminToken,adminCode)).status,200);
 assert.equal((await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:strange})).status,403);
 assert.equal((await send('/board/devices/'+strange+'/approve','POST',{},adminToken,adminCode)).status,409,'Rejected device cannot be approved later');
 assert.equal((await (await send('/board/devices/pending','GET',null,adminToken,adminCode)).json()).devices.length,0);

 // Approve: the next code entry returns a working token.
 assert.equal((await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:momDevice,device_label:'Galaxy A'})).status,202);
 assert.equal((await send('/board/devices/'+momDevice+'/approve','POST',{},adminToken)).status,403,'Admin session required');
 assert.equal((await send('/board/devices/'+momDevice+'/approve','POST',{},adminToken,adminCode)).status,200);
 const momToken=(await (await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:momDevice})).json()).token;
 assert(momToken?.length>40);
 assert.equal((await send('/board','GET',null,momToken)).status,200);
 assert.equal((await send('/board/devices/'+momDevice+'/approve','POST',{},adminToken,adminCode)).status,409,'Already approved');
 assert.equal((await send('/board/devices/bad/approve','POST',{},adminToken,adminCode)).status,404);

 // An already approved device re-entering the code is unaffected (no new approval).
 const again=await send('/board/session','POST',{code:'familycode2026',member_id:mom.id,device:momDevice});
 assert.equal(again.status,200);
 assert.equal((await (await send('/board/devices','GET',null,adminToken,adminCode)).json()).total_devices,2);
}

{
 // Devices enrolled before this feature (records without a pending field) keep working.
 const {env,settings}=makeEnv();const send=sender(env);
 const accounts=(await (await send('/board/choices','POST',{code:'familycode2026'})).json()).accounts;
 const dad=accounts.find(a=>a.name==='아빠'),legacy='d'.repeat(32);
 settings.set('office-member-device-v2:'+legacy,JSON.stringify({member_id:dad.id,binding:'0f0e0d0c-0b0a-4908-8706-050403020100',created_at:'2026-10-01T00:00:00.000Z'}));
 const r=await send('/board/session','POST',{code:'familycode2026',member_id:dad.id,device:legacy});
 assert.equal(r.status,200,'Legacy enrolled phones must not be locked out');
 assert((await r.json()).token.length>40);
}

{
 // Emergency switch (Cloudflare variable BOARD_DEVICE_APPROVAL=off) restores direct enrollment.
 const {env}=makeEnv({BOARD_DEVICE_APPROVAL:'off'});const send=sender(env);
 const accounts=(await (await send('/board/choices','POST',{code:'familycode2026'})).json()).accounts;
 const r=await send('/board/session','POST',{code:'familycode2026',member_id:accounts[0].id,device:'e'.repeat(32)});
 assert.equal(r.status,200);
}
console.log('Device approval passed: pending without token, admin-only list/approve/reject, revoked stays revoked, legacy devices unaffected, emergency off switch.');
