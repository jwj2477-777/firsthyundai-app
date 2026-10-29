import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';
const store=new Map();
const env={SETTINGS:{
 async get(k,format){const v=store.get(k);return v===undefined?null:format==='json'?JSON.parse(v):v},
 async put(k,v){store.set(k,v)},async delete(k){store.delete(k)},
 async list({prefix='',limit=1000}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(name=>({name}))}}
},FIRSTHYUNDAI_ACCESS_CODE:'testimagepassword2026',FIRSTHYUNDAI_ADMIN_CODE:'testAdminPasswordForPictures2026',
 AUTH_LIMITER:{async limit(){return {success:true}}}};
const base='https://firsthyundai-shared-settings.jwj2477.workers.dev';
function ask(url,method='GET',body=null,token='',origin=''){
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(origin)headers.Origin=origin;
 if(body)headers['Content-Type']='application/json';
 return service.fetch(new Request(base+url,{method,headers,body:body?JSON.stringify(body):undefined}),env);
}
const choice=await (await ask('/board/choices','POST',{code:env.FIRSTHYUNDAI_ACCESS_CODE})).json();
const member=choice.accounts[0];
const signed=await (await ask('/board/session','POST',
 {code:env.FIRSTHYUNDAI_ACCESS_CODE,member_id:member.id,device:'a'.repeat(32)})).json();
const token=signed.token;
const note=(await (await ask('/board','POST',{text:'사진 첨부 테스트'},token)).json()).note;
const previewPath='/board/'+note.id+'/preview';
assert.equal((await ask(previewPath)).status,401,'Memo preview requires auth');
assert.equal((await ask(previewPath,'GET',null,token,'https://evil.invalid')).status,403);
const preview=await (await ask(previewPath,'GET',null,token)).json();
assert.equal(preview.author,member.name);
assert.equal(preview.preview,'사진 첨부 테스트');
assert.equal(preview.image_count,0);
const path='/board/'+note.id+'/images';
const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,...Array(128).fill(31),255,217]).toString('base64');
assert.match(photo,/^data:image\/jpeg;base64,\/9j\//);
assert.equal((await ask(path,'POST',{data_url:photo})).status,401,'image upload requires authentication');
assert.equal((await ask(path,'POST',{data_url:photo},token,'https://other.invalid')).status,403);
assert.equal((await ask(path,'POST',{data_url:'data:text/html;base64,AAAA'},token)).status,400,'reject HTML uploads');
const created=await ask(path,'POST',{data_url:photo},token);
assert.equal(created.status,201);
const first=await created.json();
assert.equal(first.note.images.length,1);
const previewWithPhoto=await (await ask(previewPath,'GET',null,token)).json();
assert.equal(previewWithPhoto.image_count,1);
assert(!JSON.stringify(first.note).includes('data:image'),'never inline bytes into note');
assert.equal((await ask(path+'/'+first.image_id)).status,401);
const view=await ask(path+'/'+first.image_id,'GET',null,token);
assert.equal(view.status,200);
assert.equal((await view.json()).data_url,photo,'authenticated image download');
const rows=(await (await ask('/board','GET',null,token)).json()).notes;
assert.equal(rows[0].images.length,1);
assert(!JSON.stringify(rows).includes(photo),'board list remains lightweight');
for(let i=0;i<2;i++)assert.equal((await ask(path,'POST',{data_url:photo},token)).status,201);
assert.equal((await ask(path,'POST',{data_url:photo},token)).status,409,'at most three photos');
const removed=await ask(path+'/'+first.image_id,'DELETE',null,token);
assert.equal(removed.status,200);
assert.equal((await ask(path+'/'+first.image_id,'GET',null,token)).status,404,'deleted image inaccessible');
assert.equal((await ask('/board/invalid/images','POST',{data_url:photo},token)).status,404);
assert.equal((await ask('/settings')).status,200);
const publicJson=await (await ask('/settings')).text();
assert(!publicJson.includes(photo),'public settings cannot leak images');
console.log('PASS authenticated memo photos, inline data isolation, max count, unauthorized access, and deletion');
