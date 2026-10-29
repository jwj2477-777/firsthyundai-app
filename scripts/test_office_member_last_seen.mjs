import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';

const db=new Map();
const env={
 SETTINGS:{
  async get(key,kind){const v=db.get(key);return v===undefined?null:kind==='json'?JSON.parse(v):v},
  async put(key,value){db.set(key,value)},
  async delete(key){db.delete(key)},
  async list({prefix,limit=1000}){return {keys:[...db.keys()].filter(k=>k.startsWith(prefix)).sort()
   .slice(0,limit).map(name=>({name}))}}
 },
 FIRSTHYUNDAI_ACCESS_CODE:'LastSeenFamilyCode2026',
 FIRSTHYUNDAI_ADMIN_CODE:'LastSeenAdminCode2026',
 AUTH_LIMITER:{async limit(){return {success:true}}}
};
const url='https://shared-settings.example';
async function send(path,method='GET',body,memberToken='',adminToken=''){
 const headers={};
 if(memberToken)headers.Authorization='Bearer '+memberToken;
 if(adminToken)headers['X-FHD-Admin-Authorization']='Bearer '+adminToken;
 if(body!==undefined)headers['Content-Type']='application/json';
 return service.fetch(new Request(url+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)}),env);
}
const choices=await (await send('/board/choices','POST',{code:env.FIRSTHYUNDAI_ACCESS_CODE})).json();
assert.equal(choices.accounts.length,3);
const admin=(await (await send('/session','POST',{code:env.FIRSTHYUNDAI_ADMIN_CODE})).json()).token;
assert(admin);
const first=choices.accounts[0],second=choices.accounts[1];
async function enroll(member,device){
 const response=await send('/board/session','POST',
  {code:env.FIRSTHYUNDAI_ACCESS_CODE,member_id:member.id,device:device.repeat(32)});
 assert.equal(response.status,200);
 return (await response.json()).token;
}
const own=await enroll(first,'a');
const other=await enroll(second,'b');
const members=(await (await send('/board/members','GET',undefined,own,admin)).json()).accounts;
assert(members.find(m=>m.id===first.id)?.last_seen_at);
assert(members.find(m=>m.id===second.id)?.last_seen_at);
assert(members.every(m=>Object.keys(m).sort().join(',')==='id,last_seen_at,name'));
assert(members.some(m=>m.last_seen_at===null),'Never-connected account must show no last seen timestamp');
assert.equal((await send('/board/members','GET',undefined,other)).status,403);
assert.equal((await send('/board/members')).status,401);
const publicSettings=JSON.stringify(await (await send('/settings')).json());
assert(!publicSettings.includes('last_seen_at'));
const bound=(await (await send('/board/accounts','GET',undefined,own)).json()).accounts;
assert(bound.every(m=>!('last_seen_at' in m)), 'Only the administrator sees timestamps');
// App resume checks refresh presence without recording a visit count or device log.
const key='office-member-last-seen-v1:'+first.id;
const original=db.get(key);
assert(original&&JSON.parse(original).at);
assert.equal((await send('/board/account','GET',undefined,own)).status,200);
assert.equal(db.get(key),original,'Frequent checks must not write a new timestamp');
db.set(key,JSON.stringify({at:'2026-01-01T00:00:00.000Z'}));
assert.equal((await send('/board/account','GET',undefined,own)).status,200);
assert(new Date(JSON.parse(db.get(key)).at).getTime()>Date.parse('2026-01-01T00:00:00Z'));
assert(![...db.keys()].some(k=>k.includes('member-visit-count')||k.includes('member-history')),
 'Presence must not create a visit counter or timeline');
console.log('PASS: admin-only last connection, no counts, throttled refresh, no public metadata');
