import assert from 'node:assert/strict';
import svc from '../workers/shared-settings/src/index.mjs';
const notes=new Map(),meta=new Map();
const env={FIRSTHYUNDAI_ACCESS_CODE:'familycode2026',FIRSTHYUNDAI_ADMIN_CODE:'admincode-separate',
 SETTINGS:{
  async put(key,value,options={}){notes.set(key,value);meta.set(key,options.metadata||{});},
  async get(key,fmt){const v=notes.get(key);return fmt==='json'?(v?JSON.parse(v):null):v;},
  async list({prefix,limit}){return {keys:[...notes.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name,metadata:meta.get(name)}))};},
  async delete(key){notes.delete(key);meta.delete(key)}
 },AUTH_LIMITER:{async limit(){return {success:true}}}};
const host='https://firsthyundai-shared-settings.jwj2477.workers.dev';
function call(path,method='GET',data=null,token='',origin='',adminToken=''){
 const headers={};if(token)headers.Authorization='Bearer '+token;if(origin)headers.Origin=origin;
 if(adminToken)headers['X-FHD-Admin-Authorization']='Bearer '+adminToken;
 if(data!==null)headers['Content-Type']='application/json';
 return svc.fetch(new Request(host+path,{method,headers,body:data===null?undefined:JSON.stringify(data)}),env);
}
assert.equal((await call('/board/updates')).status,401);
assert.equal((await call('/board/updates','GET',null,'','https://unauthorized.example')).status,403);
const token=(await (await call('/board/session','POST',{code:'familycode2026'})).json()).token;
assert(token);
assert.deepEqual((await (await call('/board/updates','GET',null,token)).json()).items,[]);
const device='0123456789abcdef0123456789abcdef';
const content='방문 예약 · 퍼스트파크\\n전화 010-1111-2222';
const created=await call('/board','POST',{text:content,device},token);
assert.equal(created.status,201);
const note=(await created.json()).note;
const changes=(await (await call('/board/updates','GET',null,token)).json()).items;
assert.equal(changes.length,1);assert.equal(changes[0].id,note.id);
assert.equal(changes[0].device,device);
assert(!JSON.stringify(changes).includes('010-1111-2222'));
assert.equal((await call('/board','POST',{text:'가'.repeat(1600),device},token)).status,201);
await call('/board/'+note.id,'PATCH',{done:true},token);
assert.equal((await (await call('/board/updates','GET',null,token)).json()).items.length,2);
const adminToken=(await (await call('/session','POST',{code:env.FIRSTHYUNDAI_ADMIN_CODE})).json()).token;
assert.equal((await call('/board/'+note.id,'DELETE',null,token)).status,403);
assert.equal((await call('/board/'+note.id,'DELETE',null,token,'',adminToken)).status,200);
assert.equal((await (await call('/board/updates','GET',null,token)).json()).items.length,1);
env.FIRSTHYUNDAI_ACCESS_CODE='rotatedfamilycode2026';
assert.equal((await call('/board/updates','GET',null,token)).status,401);
console.log('Private memo metadata feed, Unicode notes, authorization, self-exclusion and no phone leaks passed.');