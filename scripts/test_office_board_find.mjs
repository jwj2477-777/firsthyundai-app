import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';
const store=new Map();
const events={reads:0};
const env={SETTINGS:{
 async get(k,format){events.reads++;const v=store.get(k);
  return v===undefined?null:format==='json'?JSON.parse(v):v},
 async put(k,v){store.set(k,v)},async delete(k){store.delete(k)},
 async list({prefix,limit=1000}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}))}}
 },FIRSTHYUNDAI_ACCESS_CODE:'SharedNotesFindTest2026',
 FIRSTHYUNDAI_ADMIN_CODE:'SharedNotesAdminTest2026',
 AUTH_LIMITER:{async limit(){return {success:true}}}};
const base='https://firsthyundai-shared-settings.example';
function send(path,method='GET',body,token='',admin=''){
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(admin)headers['X-FHD-Admin-Authorization']='Bearer '+admin;
 if(body!==undefined)headers['Content-Type']='application/json';
 return service.fetch(new Request(base+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)}),env);
}
const choice=(await (await send('/board/choices','POST',{code:env.FIRSTHYUNDAI_ACCESS_CODE})).json()).accounts;
const member=choice[0],other=choice.find(m=>m.id!==member.id);
async function session(id,device){
 return (await (await send('/board/session','POST',{
  code:env.FIRSTHYUNDAI_ACCESS_CODE,member_id:id,device:device.repeat(32)})).json()).token;
}
const auth=await session(member.id,'a'),otherAuth=await session(other.id,'b');
const admin=(await (await send('/session','POST',{code:env.FIRSTHYUNDAI_ADMIN_CODE})).json()).token;
assert(auth&&otherAuth&&admin);
const created=[];
for(let i=0;i<62;i++){
 const response=await send('/board','POST',{text:'검색 메모 번호 '+String(i).padStart(2,'0')+
  (i===0?' · 퍼스트파크 1502동3004호':'')},auth);
 assert.equal(response.status,201,'Create memo '+i);
 created.push((await response.json()).note);
}
assert.equal((await send('/board?offset=abc','GET',undefined,auth)).status,400);
assert.equal((await send('/board?offset=-1','GET',undefined,auth)).status,400);
assert.equal((await send('/board','GET')).status,401,'History and search always require authorization');
const pages=[];
for(const offset of [0,25,50]){
 const r=await send('/board?offset='+offset,'GET',undefined,otherAuth);
 assert.equal(r.status,200);
 pages.push(await r.json());
}
assert.deepEqual(pages.map(p=>p.notes.length),[25,25,12]);
assert.deepEqual(pages.map(p=>p.has_more),[true,true,false]);
assert(pages.every(p=>p.total===62));
const all=pages.flatMap(p=>p.notes);
assert.equal(new Set(all.map(n=>n.id)).size,62);
assert(all.some(n=>n.id===created.at(-1).id),'Newest created note remains in the paged collection');
assert(all.some(n=>n.id===created[0].id),'Oldest note remains searchable after 50+ posts');
assert(all.some(n=>n.text.includes('1502동3004호')));
const before=events.reads;
const cached=await (await send('/board?offset=0','GET',undefined,auth)).json();
assert.equal(cached.notes.length,25);
assert(events.reads-before<10,'Repeated page views must read cache, not 25 KV records');
const target=created[0];
assert.equal((await send('/board/'+target.id,'PATCH',{pinned:true},otherAuth)).status,403);
assert.equal((await send('/board/'+target.id,'PATCH',{pinned:'true'},auth)).status,400);
assert.equal((await send('/board/'+target.id,'PATCH',{pinned:true},auth)).status,200);
const pinnedPages=await Promise.all([0,25,50].map(async offset=>
  (await (await send('/board?offset='+offset,'GET',undefined,auth)).json()).notes));
const pinned=pinnedPages.flat().find(n=>n.id===target.id);
assert.equal(pinned.pinned,true,'Changing pinned flag invalidates private KV memo pages');
assert.equal((await send('/board/'+target.id,'PATCH',{pinned:false},otherAuth,admin)).status,200,
 'Verified admin can remove someone else\'s pin');
assert.equal((await send('/board/'+target.id,'DELETE',undefined,auth,'')).status,403);
assert.equal((await send('/board/'+target.id,'DELETE',undefined,auth,admin)).status,200);
const deleted=(await (await send('/board?offset=50','GET',undefined,auth)).json()).notes;
assert(!deleted.some(n=>n.id===target.id),'Deleted memo must not survive cache invalidation');
assert.equal((await send('/settings','GET')).status,200);
assert(!JSON.stringify(await (await send('/settings','GET')).json()).includes('퍼스트파크'),
 'Never expose user content in public settings even when caching');
console.log('PASS 62-note authenticated paging, oldest-note search reachability, rev-cache freshness, owner/admin pin rights and privacy');
