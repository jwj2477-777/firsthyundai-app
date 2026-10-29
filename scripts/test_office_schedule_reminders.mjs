import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';

const store=new Map(),requests=[],pending=[];
const rsa=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
 publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pkcs8=new Uint8Array(await crypto.subtle.exportKey('pkcs8',rsa.privateKey));
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(pkcs8).toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
const env={
 FIRSTHYUNDAI_ACCESS_CODE:'ScheduleTestFamilyCode2026',FIRSTHYUNDAI_ADMIN_CODE:'ScheduleTestAdminCode2026',
 FHD_FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'firsthyundai-test-123',
 client_email:'firebase-adminsdk@firsthyundai-test-123.iam.gserviceaccount.com',private_key:pem}),
 SETTINGS:{
  async get(k,type){const v=store.get(k);return type==='json'?(v===undefined?null:JSON.parse(v)):(v??null)},
  async put(k,v){store.set(k,v)},async delete(k){store.delete(k)},
  async list({prefix='',limit=1000}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix))
   .sort().slice(0,limit).map(name=>({name,metadata:{}}))}}
 },AUTH_LIMITER:{async limit(){return {success:true}}}
};
const base='https://firsthyundai-shared-settings.test';
const req=(path,method='GET',data=null,token='')=>{
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(data!==null)headers['Content-Type']='application/json';
 return service.fetch(new Request(base+path,{method,headers,body:data===null?undefined:JSON.stringify(data)}),
  env,{waitUntil(promise){pending.push(promise)}});
};
const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const u=String(url);
 if(u==='https://oauth2.googleapis.com/token')
  return new Response(JSON.stringify({access_token:'test-fcm-auth',expires_in:3500}),{status:200});
 assert(u.endsWith('/messages:send'));
 const payload=JSON.parse(options.body).message;
 requests.push(payload);
 assert.equal(payload.notification,undefined,'No customer memo text in FCM');
 assert.equal(payload.android.priority,'HIGH');
 assert(!options.body.includes('010-1234-5678'));
 return new Response(JSON.stringify({name:'projects/test/messages/1'}),{status:200});
};
try{
 const [member]= (await (await req('/board/choices','POST',{code:env.FIRSTHYUNDAI_ACCESS_CODE})).json()).accounts;
 const tokens=[];
 for(const suffix of ['a','b']){
  const device=suffix.repeat(32);
  const token=(await (await req('/board/session','POST',{code:env.FIRSTHYUNDAI_ACCESS_CODE,
   member_id:member.id,device})).json()).token;
  assert(token);tokens.push(token);
  const registered=await req('/board/push/register','POST',
   {device,fcm:'token_'+suffix.repeat(80)},token);
  assert.equal(registered.status,200);
 }
 const now=Date.parse('2026-10-29T06:00:00.000Z');
 const at=t=>new Date(now+t*60000).toISOString();
 const create=async(text,minutes,all_day=false)=>{
  const r=await req('/board','POST',{text,scheduled_at:at(minutes),all_day,device:'a'.repeat(32)},tokens[0]);
  assert.equal(r.status,201);
  return (await r.json()).note;
 };
 const valid=await create('오후 3시 방문 010-1234-5678',30);
 const day=await create('종일 확인',30,true);
 const late=await create('이미 임박',10);
 const future=await create('한참 남음',70);
 const done=await create('완료한 일정',30);
 const birthday=await create('🎂 가족 생일 · 매년',30);
 assert.equal((await req('/board/'+done.id,'PATCH',{done:true},tokens[0])).status,200);
 await Promise.all(pending.splice(0));
 requests.length=0;
 const due=service._test.timedMemoDue;
 assert.equal(due(valid,now),true);
 for(const note of [day,late,future,birthday])assert.equal(due(note,now),false);
 assert.equal(due({...valid,done:true},now),false);
 assert.equal(due({...valid,scheduled_at:null},now),false);
 assert.equal(due(valid,now+3*60000),false,'Must not remind at 27 minutes before');
 assert.equal(due(valid,now-2*60000),false,'Must not remind at 32 minutes before');
 assert.equal(due(valid,now-1*60000),true);
 const first=await service._test.deliverDueReminders(env,now);
 assert.equal(first.eligible,1);
 assert.equal(first.sent,2,'Author and all enrolled devices get the reminder');
 assert.equal(requests.length,2);
 for(const message of requests){
  assert.equal(message.data.kind,'office_schedule_reminder');
  assert.equal(message.data.note_id,valid.id);
  assert.equal(message.data.scheduled_at,valid.scheduled_at);
  assert.equal(message.android.ttl,'600s');
 }
 await service.scheduled({scheduledTime:now},env,{});
 assert.equal(requests.length,2,'Cron duplicate is prevented by private KV receipt');
 assert.equal((await (await req('/board/'+valid.id+'/preview','GET',null,tokens[0])).json()).scheduled_at,at(30));
 // An amended schedule is eligible for a new event-specific reminder,
 // but an old timestamp will no longer pass the Android verification.
 assert.equal((await req('/board/'+valid.id,'PATCH',{scheduled_at:at(60)},tokens[0])).status,200);
 await service.scheduled({scheduledTime:now+30*60000},env,{});
 assert.equal(requests.length,4,'Rescheduling creates a new alert for the new start time');
 assert(requests.slice(2).every(x=>x.data.scheduled_at===at(60)));
 await service.scheduled({scheduledTime:now+30*60000},env,{});
 assert.equal(requests.length,4,'Repeated cron at new scheduled time is idempotent');
 assert.equal((await req('/board/'+future.id,'PATCH',{done:true},tokens[0])).status,200);
 await service.scheduled({scheduledTime:now+40*60000},env,{});
 assert.equal(requests.length,4,'Completed note must not alert');
 console.log('PASS 30-minute schedule reminders: all-device FCM, privacy, no repeats, completion, all-day, birthday, late item, reschedule');
}finally{globalThis.fetch=oldFetch;}
