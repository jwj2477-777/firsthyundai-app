import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';
const settings=new Map();
const env={
 SETTINGS:{
  async get(k,format){const x=settings.get(k);return x&&format==='json'?JSON.parse(x):null},
  async put(k,v){settings.set(k,v)},async delete(k){settings.delete(k)},
  async list({prefix,limit}){return {keys:[...settings.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}))}}
 },
 FIRSTHYUNDAI_ADMIN_CODE:'TestAdministratorSecretOnly2026',
 FIRSTHYUNDAI_ACCESS_CODE:'password8',
 AUTH_LIMITER:{async limit(){return {success:true}}}
};
const origin='https://firsthyundai-shared-settings.jwj2477.workers.dev';
function send(path,method='GET',data=null,token='',webOrigin=''){
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(data!==null)headers['Content-Type']='application/json';
 if(webOrigin)headers.Origin=webOrigin;
 return service.fetch(new Request(origin+path,{method,headers,body:data===null?undefined:JSON.stringify(data)}),env);
}
assert.equal((await send('/board')).status,401,'Notes require a family token even for GET');
assert.equal((await send('/board/session','POST',{code:'wrong-code'})).status,401);
assert.equal((await send('/board/session','POST',{code:'password8'},'','https://thirdparty.invalid')).status,403);
const session=await (await send('/board/session','POST',{code:'password8'})).json();
assert(session.token?.length>40);
const token=session.token;
const noteText='오늘 오후 3시 반 방문\\n퍼스트파크 1502동 3004호\\n손님 전화 010-1234-5678';
assert.equal((await send('/board','POST',{text:noteText})).status,401);
const created=await send('/board','POST',{text:noteText},token);
assert.equal(created.status,201);
const item=(await created.json()).note;
assert(item.id&&item.text.includes('010-1234-5678'));
const list=await (await send('/board','GET',null,token)).json();
assert.equal(list.notes.length,1);
assert.equal(list.notes[0].done,false);
assert.equal((await send('/board/'+item.id,'PATCH',{done:true},token)).status,200);
assert.equal((await send('/board/'+item.id,'PATCH',{text:'시간 변경 · 오후 4시'},token)).status,200);
const after=await (await send('/board','GET',null,token)).json();
assert(after.notes[0].done&&after.notes[0].text.includes('4시'));
assert.equal((await send('/board/'+item.id,'PATCH',{admin:true},token)).status,400);
assert.equal((await send('/board','POST',{text:'    '},token)).status,400);
const publicSettings=await (await send('/settings')).json();
assert(!JSON.stringify(publicSettings).includes('010-1234-5678'),'Public settings cannot leak customer phones');
assert.equal((await send('/board/'+item.id,'DELETE',null,token)).status,200);
assert.equal((await (await send('/board','GET',null,token)).json()).notes.length,0);
env.FIRSTHYUNDAI_ACCESS_CODE='changedPasswordAfterRotation';
assert.equal((await send('/board','GET',null,token)).status,401,'Family code rotation invalidates notes token');
console.log('Office board privacy/auth and create/read/complete/edit/delete passed.');
