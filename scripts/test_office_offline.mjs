import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root='app/src/main/';
const java=fs.readFileSync(root+'java/kr/co/firsthyundai/app/OfficeOfflineStore.java','utf8');
const main=fs.readFileSync(root+'java/kr/co/firsthyundai/app/MainActivity.java','utf8');
const login=fs.readFileSync(root+'java/kr/co/firsthyundai/app/LockActivity.java','utf8');
const client=fs.readFileSync(root+'java/kr/co/firsthyundai/app/OfficeBoardClient.java','utf8');
const html=fs.readFileSync(root+'assets/index.html','utf8');
const js=fs.readFileSync(root+'assets/office-board.js','utf8');
const css=fs.readFileSync(root+'assets/office-board.css','utf8');
assert(java.includes('AndroidKeyStore')&&java.includes('AES/GCM/NoPadding'));
assert(java.includes('AtomicFile')&&java.includes('getNoBackupFilesDir()'));
assert(java.includes('updateAAD')&&java.includes('member'));
assert(java.includes('validateNotes(notes)')&&java.includes('MAX_NOTES'));
assert(!java.includes('MODE_WORLD_READABLE'));
assert(main.includes('@JavascriptInterface public String getOfficeMemoOfflineSnapshot()'));
assert(main.includes('@JavascriptInterface public boolean saveOfficeMemoOfflineSnapshot('));
assert(client.includes('OfficeOfflineStore.clear(context,previous)'),'Revoke clears old local copy');
assert(login.includes('OfficeOfflineStore.has(getApplicationContext()'));
assert(login.includes('AccessPolicy.authorized(getApplicationContext(),result.policy)'));
assert(html.includes('id="officeBoardOfflineBanner"'));
assert(css.includes('.officeBoardOfflineBanner'));
assert(js.includes('storeOffline(items)')&&js.includes('restoreOffline()'));
assert(js.includes('if(offlineMode||!note||!valid(note.id))return false'));
assert(!/localStorage|sessionStorage|indexedDB/.test(js));
new vm.Script(js);

const account='11111111-1111-1111-1111-111111111111';
const note={id:'mhad4vwu-00000000-0000-0000-0000-000000000001',
 text:'오늘 오후 3시 방문 · 연락처 032-123-4567',done:false,pinned:false,
 author:{id:account,name:'엄마'},created_at:'2026-11-06T02:00:00.000Z',
 updated_at:'2026-11-06T02:00:00.000Z',scheduled_at:'2026-11-07T06:00:00.000Z'};
let snapshot=JSON.stringify({schema:1,cachedAt:Date.parse('2026-11-06T03:00:00Z'),notes:[note]});
let online=false,roundTrips=0,saved=0,accountId=account;
const elements=new Map();
function el(id){
 if(!elements.has(id)){
  const classes=new Set();
  elements.set(id,{id,value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),
    contains:x=>classes.has(x),toggle(x,force){if(force===undefined)force=!classes.has(x);
     if(force)classes.add(x);else classes.delete(x);return force}},
   addEventListener(){},setAttribute(){},querySelector(){return null},
   scrollIntoView(){},focus(){},style:{},parentElement:{classList:{toggle(){}}}
  });
 }
 return elements.get(id);
}
const ctx=vm.createContext({
 window:{FirstHyundaiNative:{
  getOfficeMemberId:()=>accountId,getOfficeMemberName:()=> '엄마',
  getMode:()=> 'admin',
  getOfficeMemoOfflineSnapshot:()=> snapshot,
  saveOfficeMemoOfflineSnapshot(value){
   saved++;snapshot=JSON.stringify({schema:1,cachedAt:Date.now(),notes:JSON.parse(value).notes});
   return true;
  },
  officeBoardAction(action,payload,id){
   if(action!=='list')throw Error('Unexpected mutation attempt');
   roundTrips++;
   setTimeout(()=>{
    ctx.window.onFirstHyundaiOfficeBoardResult(online?
     {requestId:id,ok:true,data:{notes:[{...note,text:'서버 최신 방문 예약'}],has_more:false,total:1}}:
     {requestId:id,ok:false,error:'게시판 서버에 연결할 수 없습니다. HTTP 500'});
   },0);
  }}},
 document:{getElementById:el,dispatchEvent(){},createElement(){return el('created')}},
 currentPage:'officeBoard',Date,Promise,Event:class Event{},
 setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},confirm:()=>true,
});
const dates=fs.readFileSync(root+'assets/memo-dates.js','utf8');
vm.runInContext(dates,ctx);vm.runInContext(js,ctx);
const api=ctx.window.FirstHyundaiOfficeBoard;
api.open();
await new Promise(resolve=>setTimeout(resolve,90));
assert(roundTrips>0,'Attempt live refresh first');
assert(el('officeBoardList').innerHTML.includes('032-123-4567'),
 'Server HTTP 500 must not hide the emergency cached telephone number');
assert(el('officeBoardOfflineTitle').textContent.includes('읽기 전용'));
assert(el('officeBoardOfflineDetail').textContent.includes('마지막 동기화'));
assert(!el('officeBoardList').innerHTML.includes('data-action="delete"'));
assert(!el('officeBoardList').innerHTML.includes('data-action="done"'));
assert(!api._test.canEditNote(note),'Even admin cannot edit an old snapshot');
const count=roundTrips;
api.post();
assert.equal(roundTrips,count,'Offline post must not reach the server');
online=true;
await api.refresh();
assert(saved>=1,'Complete successful online sync must save an encrypted snapshot');
assert(el('officeBoardList').innerHTML.includes('서버 최신 방문 예약'));
assert(!el('officeBoardOfflineTitle').textContent.includes('읽기 전용'));
assert(api._test.canEditNote(note),'Online authenticated admin access restored');
online=false;
await api.refresh();
assert(el('officeBoardList').innerHTML.includes('서버 최신 방문 예약'),
 'After a later outage, fallback uses the most recently saved full snapshot');
assert(el('officeBoardOfflineTitle').textContent.includes('읽기 전용'));
console.log('PASS encrypted emergency notes, no false zero, account-bound offline view, no edits, online recovery');
