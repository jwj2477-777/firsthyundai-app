import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';
const settings=new Map();
const env={
 SETTINGS:{
  async get(k,format){const x=settings.get(k);return x===undefined?null:format==='json'?JSON.parse(x):x},
  async put(k,v){settings.set(k,v)},async delete(k){settings.delete(k)},
  async list({prefix,limit}){return {keys:[...settings.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}))}}
 },
 FIRSTHYUNDAI_ADMIN_CODE:'TestAdministratorSecretOnly2026',
 FIRSTHYUNDAI_ACCESS_CODE:'password8',
 AUTH_LIMITER:{async limit(){return {success:true}}}
};
const origin='https://firsthyundai-shared-settings.jwj2477.workers.dev';
function send(path,method='GET',data=null,token='',webOrigin='',adminToken=''){
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(adminToken)headers['X-FHD-Admin-Authorization']='Bearer '+adminToken;
 if(data!==null)headers['Content-Type']='application/json';
 if(webOrigin)headers.Origin=webOrigin;
 return service.fetch(new Request(origin+path,{method,headers,body:data===null?undefined:JSON.stringify(data)}),env);
}
assert.equal((await send('/board')).status,401,'Notes require a family token even for GET');
assert.equal((await send('/board/session','POST',{code:'wrong-code'})).status,401);
assert.equal((await send('/board/session','POST',{code:'password8'},'','https://thirdparty.invalid')).status,403);
// Defaults exist before anyone enters a password or opens the account picker.
const ready=await (await send('/health')).json();
assert.equal(ready.defaultAccountsReady,true,'Bootstrap precedes first app login');
const choice=await (await send('/board/choices','POST',{code:'password8'})).json();
assert.deepEqual(choice.accounts.map(a=>a.name),['관리자','엄마','아빠'],'Account picker has the three defaults in requested order');
const member=choice.accounts.find(a=>a.name==='관리자');
assert(member?.id);
const device='a'.repeat(32);
assert.equal((await send('/board/session','POST',{code:'password8'})).status,400,'Account selection is mandatory');
const session=await (await send('/board/session','POST',{code:'password8',member_id:member.id,device})).json();
assert(session.token?.length>40);
const token=session.token;
const noteText='오늘 오후 3시 반 방문\\n퍼스트파크 1502동 3004호\\n손님 전화 010-1234-5678';
assert.equal((await send('/board','POST',{text:noteText})).status,401);
const date='2026-10-26T06:30:00.000Z';
const created=await send('/board','POST',{text:noteText,scheduled_at:date},token);
assert.equal(created.status,201);
const item=(await created.json()).note;
assert(item.id&&item.text.includes('010-1234-5678'));
assert.equal(item.author.id,member.id);
assert.equal(item.author.name,member.name);
const list=await (await send('/board','GET',null,token)).json();
assert.equal(list.notes.length,1);
assert.equal(list.notes[0].done,false);
assert.equal(list.notes[0].scheduled_at,date);
assert.equal((await send('/board','POST',{text:'bad date',scheduled_at:'2026-99-99'},token)).status,400);
assert.equal((await send('/board/'+item.id,'PATCH',{done:true},token)).status,200);
assert.equal((await send('/board/'+item.id,'PATCH',{text:'시간 변경 · 오후 4시',scheduled_at:'2026-10-26T07:00:00.000Z'},token)).status,200);
const after=await (await send('/board','GET',null,token)).json();
assert(after.notes[0].done&&after.notes[0].text.includes('4시'));
assert.equal(after.notes[0].scheduled_at,'2026-10-26T07:00:00.000Z');
assert.equal((await send('/board/'+item.id,'PATCH',{admin:true},token)).status,400);
assert.equal((await send('/board','POST',{text:'    '},token)).status,400);
const publicSettings=await (await send('/settings')).json();
assert(!JSON.stringify(publicSettings).includes('010-1234-5678'),'Public settings cannot leak customer phones');
assert.equal((await send('/board/'+item.id,'DELETE',null,token)).status,403,'Family cannot delete');
assert.equal((await send('/board/archive','GET',null,token)).status,403,'Family cannot read archive');
const adminToken=(await (await send('/session','POST',{code:env.FIRSTHYUNDAI_ADMIN_CODE})).json()).token;
assert(adminToken);
assert.equal((await send('/board/'+item.id,'DELETE',null,token,'',adminToken)).status,200);
assert.equal((await (await send('/board','GET',null,token)).json()).notes.length,0);
const archived=await (await send('/board/archive','GET',null,token,'',adminToken)).json();
assert.equal(archived.notes.length,1);
assert(archived.notes[0].text.includes('4시'));
assert.equal((await send('/board/archive/'+item.id+'/restore','POST',null,token)).status,403);
assert.equal((await send('/board/archive/'+item.id+'/restore','POST',null,token,'',adminToken)).status,200);
assert.equal((await (await send('/board','GET',null,token)).json()).notes.length,1);
assert.equal((await send('/board/'+item.id,'PATCH',{scheduled_at:null},token)).status,200);
assert.equal((await (await send('/board','GET',null,token)).json()).notes[0].scheduled_at,null);

// Existing device identity may be changed only using BOTH the shared code and
// its currently valid board session. Previous token is revoked on rebind.
const momAccount=choice.accounts.find(x=>x.name==='엄마');
const dadAccount=choice.accounts.find(x=>x.name==='아빠');
const alternateDevice='c'.repeat(32);
const momSession=(await (await send('/board/session','POST',
 {code:'password8',member_id:momAccount.id,device:alternateDevice})).json()).token;
assert.equal((await (await send('/board/accounts','GET',null,momSession)).json()).accounts.length,3);
assert.equal((await send('/board','GET',null,momSession)).status,200,
 'All members may continue to read the shared memo');
const parentNote='/board/'+item.id;
for(const patch of [{text:'임의 수정 시도'},{done:true},{scheduled_at:null},{all_day:true}]){
 assert.equal((await send(parentNote,'PATCH',patch,momSession)).status,403,
  'Non-authors cannot modify contents, completion or scheduling');
}
const adminPatch=await send(parentNote,'PATCH',
 {text:'관리자 승인 수정',done:false},momSession,'',adminToken);
assert.equal(adminPatch.status,200,'Valid administrator can edit another family member note');
assert.equal((await adminPatch.json()).note.author.id,member.id,
 'Admin edits never transfer original authorship');
const ownerPatch=await send(parentNote,'PATCH',{text:'최초 작성자 재수정'},token);
assert.equal(ownerPatch.status,200,'Original author keeps edit permission after admin changes');
assert.equal((await send(parentNote,'PATCH',{text:'이름만으로 관리자 사칭'},momSession)).status,403);

assert.equal((await send('/board/session','POST',
 {code:'password8',member_id:dadAccount.id,device:alternateDevice,reassign:true})).status,409,
 'A bare shared password cannot reassign an already bound device');
assert.equal((await send('/board/session','POST',
 {code:'wrong-password',member_id:dadAccount.id,device:alternateDevice,reassign:true},momSession)).status,401);
const converted=await send('/board/session','POST',
 {code:'password8',member_id:dadAccount.id,device:alternateDevice,reassign:true},momSession);
assert.equal(converted.status,200,'A correctly authenticated existing device can change profile');
const dadSession=(await converted.json()).token;
assert.equal((await send('/board','GET',null,momSession)).status,401,'Old identity token is invalid after change');
assert.equal((await send('/board','GET',null,dadSession)).status,200);
assert.equal((await (await send('/board/account','GET',null,dadSession)).json()).member.name,'아빠');

const extra=await send('/board/members','POST',{name:'신규 구성원'},token,'',adminToken);
assert.equal(extra.status,201);
const newcomer=(await extra.json()).account;
const extraDevice='b'.repeat(32);
const extraToken=(await (await send('/board/session','POST',{code:'password8',member_id:newcomer.id,device:extraDevice})).json()).token;
assert(extraToken);
assert.equal((await send('/board','GET',null,extraToken)).status,200);
assert.equal((await send('/board/members/'+newcomer.id+'/rename','PATCH',
 {name:'새 이름'},extraToken)).status,403,'Rename requires administrator authentication');
const rename=await send('/board/members/'+newcomer.id+'/rename','PATCH',
 {name:'새 이름'},token,'',adminToken);
assert.equal(rename.status,200,'Authorized admin can rename a member');
assert.equal((await (await send('/board/account','GET',null,extraToken)).json()).member.name,
 '새 이름','Renaming must not revoke an existing device or require fresh login');
assert.equal((await send('/board/members/'+newcomer.id+'/rename','PATCH',
 {name:'관리자'},token,'',adminToken)).status,409,
 'Renaming must not merge two different logical users with the same name');
assert.equal((await send('/board/members/'+newcomer.id,'DELETE',null,token)).status,403);
assert.equal((await send('/board/members/'+member.id,'DELETE',null,token,'',adminToken)).status,409,'Cannot remove current manager account');
assert.equal((await send('/board/members/'+newcomer.id,'DELETE',null,token,'',adminToken)).status,200);
assert.equal((await send('/board','GET',null,extraToken)).status,401,'Deleted user token revoked on server');
assert.equal((await send('/board/session','POST',{code:'password8',member_id:newcomer.id,device:extraDevice})).status,403,'Deleted member cannot rejoin');
const another=(await send('/board/members','POST',{name:'신규 구성원'},token,'',adminToken));
assert.equal(another.status,201);
assert.notEqual((await another.json()).account.id,newcomer.id,'Recreated name must not restore revoked account');
// Removing a default family member must not silently recreate it on /health or /choices.
const mom=choice.accounts.find(a=>a.name==='엄마');
assert.equal((await send('/board/members/'+mom.id,'DELETE',null,token,'',adminToken)).status,200);
assert.equal((await (await send('/health')).json()).defaultAccountsReady,true);
const afterRemoval=(await (await send('/board/choices','POST',{code:'password8'})).json()).accounts;
assert(!afterRemoval.some(a=>a.name==='엄마'),'Removed default profile must stay removed');
assert(afterRemoval.some(a=>a.name==='아빠'),'Remaining default profile stays enabled');
env.FIRSTHYUNDAI_ACCESS_CODE='changedPasswordAfterRotation';
assert.equal((await send('/board','GET',null,token)).status,401,'Family code rotation invalidates notes token');

// Upgrade path: keep an existing original administrator record (do not replace ID)
// while filling in only the two missing profiles.
const legacy=new Map(),oldId='ae783501-3a44-4ac1-8e22-77ba17d00012';
legacy.set('office-member-v2:'+oldId,JSON.stringify({id:oldId,name:'관리자',active:true}));
const legacyEnv={...env,SETTINGS:{
 async get(k,format){const v=legacy.get(k);return format==='json'?(v?JSON.parse(v):null):v||null},
 async put(k,v){legacy.set(k,v)},async delete(k){legacy.delete(k)},
 async list({prefix,limit}){return {keys:[...legacy.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(name=>({name}))}}
}};
const oldHealth=await service.fetch(new Request(origin+'/health'),legacyEnv);
assert.equal((await oldHealth.json()).defaultAccountsReady,true);
const upgraded=[...legacy.entries()].filter(([k])=>k.startsWith('office-member-v2:')).map(([,v])=>JSON.parse(v));
assert.equal(upgraded.length,3);
assert(upgraded.some(v=>v.id===oldId&&v.name==='관리자'));
assert(upgraded.some(v=>v.name==='엄마')&&upgraded.some(v=>v.name==='아빠'));
await service.fetch(new Request(origin+'/health'),legacyEnv);
assert.equal([...legacy.keys()].filter(k=>k.startsWith('office-member-v2:')).length,3,'Bootstrap must be idempotent');
// Two administrator handsets are not a reason to expose two administrator
// choices. Preserve old records and tokens; dedupe just the visible profiles.
const duplicateAdmin='ae783501-3a44-4ac1-8e22-77ba17d00013';
legacy.set('office-member-v2:'+duplicateAdmin,JSON.stringify({
 id:duplicateAdmin,name:'관리자',active:true,created_at:'2026-10-26T03:00:00.000Z'
}));
legacy.set('office-member-device-v2:'+'c'.repeat(32),JSON.stringify({
 member_id:oldId,binding:'22d232ba-3399-4b22-aa33-345677998800'
}));
legacy.set('office-member-device-v2:'+'d'.repeat(32),JSON.stringify({
 member_id:oldId,binding:'22d232ba-3399-4b22-aa33-345677998801'
}));
legacy.set('office-member-device-v2:'+'e'.repeat(32),JSON.stringify({
 member_id:duplicateAdmin,binding:'22d232ba-3399-4b22-aa33-345677998802'
}));
const duplicateChoice=await service.fetch(new Request(origin+'/board/choices',{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({code:'changedPasswordAfterRotation'})
}),legacyEnv);
assert.equal(duplicateChoice.status,200);
const displayed=(await duplicateChoice.json()).accounts;
assert.equal(displayed.filter(v=>v.name==='관리자').length,1,
 'Two administrator records should appear as one logical account');
assert.equal(displayed.length,3,'Admin (2 phones), mom, dad (1 each) are 3 logical profiles');
assert.equal(displayed[0].id,oldId,
 'Keep most-connected existing admin as the selectable identity');
assert(legacy.has('office-member-v2:'+duplicateAdmin),
 'Never delete other admin member records or their existing device bindings');
assert(legacy.has('office-member-device-v2:'+'e'.repeat(32)));

console.log('Private calendar metadata, administrator-only soft-delete and 30-day recovery passed.');
