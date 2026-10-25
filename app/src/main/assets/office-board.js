/* v2.0.98 · A freeform office sticky board. No public HTTP or local note storage. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bridge=window.FirstHyundaiNative;
const requests=new Map(),localUpdates=new Map(),localDeletes=new Map();
let sequence=0,items=[],busy=false,lastCheck=0,showCompleted=false,editing='',editDraft='',timer=null;
let timerMs=45000,pendingFocus='';
function focusNote(id){
 if(!valid(id))return false;
 pendingFocus=id;
 if(typeof currentPage!=='undefined'&&currentPage==='officeBoard'){
  draw();refresh(true);
 }
 return true;
}
function preferences(){
 const p=window.FirstHyundaiUIOptions?.get?.()||{};
 return {memoOrder:p.memoOrder||'newest',memoCompleted:p.memoCompleted||'hide',
  memoRefresh:p.memoRefresh||'45',memoClock:p.memoClock||'12',memoPhones:p.memoPhones||'on'};
}
function sortItems(){
 const order=preferences().memoOrder==='oldest'?1:-1;
 items.sort((a,b)=>a.done!==b.done?(a.done?1:-1):
  order*String(a.created_at).localeCompare(String(b.created_at)));
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=id=>/^[a-z0-9]{8,14}-[0-9a-f-]{36}$/.test(String(id||''));
function msg(text){if($('officeBoardFeedback'))$('officeBoardFeedback').textContent=text}
function dateText(value){
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return '';
 return d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',
  hour:'numeric',minute:'2-digit',hour12:preferences().memoClock!=='24'});
}
function phones(value){
 const text=String(value||''),re=/(0\d{1,2}[- ]?\d{3,4}[- ]?\d{4})/g;
 let html='',offset=0,m;
 while((m=re.exec(text))!==null){
  html+=esc(text.slice(offset,m.index));
  html+='<a class="officeBoardPhone" href="tel:'+m[0].replace(/[^0-9]/g,'')+'">'+esc(m[0])+'</a>';
  offset=m.index+m[0].length;
 }
 return html+esc(text.slice(offset));
}
function draw(){
 const list=$('officeBoardList');if(!list)return;
 $('officeBoardCount').textContent=String(items.filter(x=>!x.done).length);
 const completedCount=items.filter(x=>x.done).length;
 $('officeBoardShowDone').textContent=showCompleted?'완료 숨기기':'완료 '+completedCount+'건 보기';
 $('officeBoardShowDone').setAttribute?.('aria-pressed',showCompleted?'true':'false');
 const visible=items.filter(x=>showCompleted||!x.done);
 if(!visible.length){
  list.innerHTML='<div class="empty">'+(items.length?'표시할 메모가 없습니다. 완료 메모를 열어볼 수 있습니다.':'아직 메모가 없습니다. 첫 포스트잇을 붙여보세요.')+'</div>';
  return;
 }
 list.innerHTML=visible.map(note=>{
  const id=esc(note.id),isEdit=editing===note.id;
  const body=isEdit?'<textarea class="officeBoardEdit" maxlength="1600" data-edit="'+id+'" aria-label="메모 수정">'+esc(editDraft)+'</textarea>':
   '<div class="officeBoardText">'+(preferences().memoPhones==='off'?esc(note.text):phones(note.text))+'</div>';
  const actions=isEdit?'<button class="officeBoardSave" data-action="save" data-id="'+id+'">저장</button>'+
    '<button data-action="cancel" data-id="'+id+'">취소</button>':
   '<button class="officeBoardDoneAction" data-action="done" data-id="'+id+'">'+(note.done?'완료 취소':'완료')+'</button>'+
   '<button data-action="edit" data-id="'+id+'">수정</button>'+
   '<button data-action="delete" data-id="'+id+'" class="officeBoardDelete">삭제</button>';
  return '<article class="officeBoardNote'+(note.done?' completed':'')+'" data-note="'+id+'">'+
   '<div class="officeBoardNoteTop"><span class="officeBoardNoteLabel">'+(note.done?'✓ 완료':'공유 메모')+'</span>'+
   '<time>'+esc(dateText(note.created_at))+'</time></div>'+
   body+'<div class="officeBoardNoteActions'+(isEdit?' editing':'')+'">'+actions+'</div></article>';
 }).join('');
 if(pendingFocus){
  const note=list.querySelector?.('[data-note="'+pendingFocus+'"]');
  if(note){
   note.classList?.add?.('officeBoardNotificationTarget');
   note.scrollIntoView?.({behavior:'smooth',block:'center'});
   pendingFocus='';
  }
 }
}
function call(action,payload){
 if(typeof bridge?.officeBoardAction!=='function')return Promise.reject(Error('메모 공유는 최신 안드로이드 앱에서 지원합니다.'));
 const id='postit'+(++sequence);
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{requests.delete(id);reject(Error('서버 응답 시간 초과'))},16000);
  requests.set(id,{resolve:x=>{clearTimeout(timeout);resolve(x)},reject:e=>{clearTimeout(timeout);reject(e)}});
  try{bridge.officeBoardAction(action,JSON.stringify(payload||{}),id)}
  catch(e){clearTimeout(timeout);requests.delete(id);reject(e)}
 });
}
window.onFirstHyundaiOfficeBoardResult=e=>{
 const result=requests.get(e?.requestId);if(!result)return;
 requests.delete(e.requestId);
 if(e.ok)result.resolve(e.data);
 else{
  if(e.needsAuth)$('officeBoardAuth')?.classList?.remove?.('hidden');
  result.reject(Error(e.error||'게시판을 읽을 수 없습니다.'));
 }
};
function merge(server){
 const now=Date.now(),merged=new Map(server.filter(x=>x&&valid(x.id)&&typeof x.text==='string'&&typeof x.done==='boolean').map(x=>[x.id,x]));
 for(const [id,state] of localUpdates){
  const remote=merged.get(id);
  if(now-state.time>120000||(remote&&remote.updated_at>=state.note.updated_at))localUpdates.delete(id);
  else merged.set(id,state.note);
 }
 for(const [id,time] of localDeletes){
  if(now-time>120000)localDeletes.delete(id);else merged.delete(id);
 }
 items=[...merged.values()];
 sortItems();draw();
}
async function refresh(silent=false){
 if(busy||currentPage!=='officeBoard')return;
 if(!silent)msg('메모를 확인하는 중…');
 try{
  const data=await call('list',{});
  merge(Array.isArray(data.notes)?data.notes:[]);
  lastCheck=Date.now();
  $('officeBoardAuth')?.classList?.add?.('hidden');
  if(!silent)msg('메모를 확인했습니다.');
 }catch(e){if(!silent)msg(e.message)}
}
function settingsChanged(){
 const p=preferences();
 showCompleted=p.memoCompleted==='show';
 sortItems();draw();
 const next=Math.max(30000,Math.min(120000,Number(p.memoRefresh)*1000||45000));
 if(timer&&next!==timerMs){clearInterval(timer);timer=null;}
 timerMs=next;
 if(!timer&&typeof currentPage!=='undefined'&&currentPage==='officeBoard')
  timer=setInterval(()=>{if(currentPage==='officeBoard')refresh(true)},timerMs);
}
function syncNotificationStatus(){
 const label=$('officeMemoNotificationStatus'),button=$('officeMemoNotificationPermission');
 if(!label||!button)return;
 let status='unavailable';
 try{status=bridge?.getOfficeMemoNotificationStatus?.()||'unavailable'}catch(e){}
 const push=bridge?.getOfficeMemoPushStatus?.()||'not_configured';
 label.textContent=status==='enabled'?(push==='push_ready'
  ?'새 메모 알림 켜짐 · 앱 종료 상태에서도 FCM 푸시 연결됨'
  :push==='push_pending'?'앱 알림 켜짐 · Firebase 서버 또는 기기 연결 확인 중'
  :'앱 알림 켜짐 · 백그라운드 정기 확인 (FCM 연결 전)') :
   status==='permission_required'?'새 메모 알림을 받으려면 휴대폰 알림을 허용해 주세요.':
   status==='blocked'?'휴대폰 설정에서 퍼스트현대 알림을 허용해 주세요.':
   status==='disabled'?'관리자 설정에서 새 메모 알림이 꺼져 있습니다.':
   '휴대폰 알림은 안드로이드 앱에서 사용할 수 있습니다.';
 button.classList.toggle('hidden',status!=='permission_required');
}
function enableNotifications(){
 bridge?.requestOfficeMemoNotifications?.();
}
function open(){
 settingsChanged();syncNotificationStatus();refresh();
}
async function mutate(action,data){
 if(busy)return null;
 busy=true;$('officeBoardPost').disabled=true;
 try{
  const result=await call(action,data);
  if(action==='delete')localDeletes.set(data.id,Date.now());
  else if(result.note)localUpdates.set(result.note.id,{note:result.note,time:Date.now()});
  if(action==='post')$('officeBoardDraft').value='';
  editing='';editDraft='';
  merge(items);
  msg(action==='post'?'포스트잇을 붙였습니다. 다른 휴대폰에도 공유됩니다.':'메모가 반영됐습니다.');
  return result;
 }catch(e){msg(e.message);return null}
 finally{busy=false;$('officeBoardPost').disabled=false}
}
function post(){
 const value=String($('officeBoardDraft').value||'').trim();
 if(!value){msg('내용을 적어 주세요.');$('officeBoardDraft').focus();return}
 if(value.length>1600){msg('메모는 최대 1600자입니다.');return}
 mutate('post',{text:value});
}
function edit(id){const note=items.find(x=>x.id===id);if(!note)return;editing=id;editDraft=note.text;draw();$('officeBoardList').querySelector('textarea[data-edit]')?.focus?.()}
function cancelEdit(){editing='';editDraft='';draw()}
function saveEdit(id){
 if(id!==editing)return;
 const value=String($('officeBoardList').querySelector('textarea[data-edit]')?.value||'').trim();
 if(!value||value.length>1600){msg('수정 내용은 1~1600자여야 합니다.');return}
 mutate('edit',{id,text:value});
}
function setDone(id,done){if(valid(id))mutate('done',{id,done})}
function remove(id){
 if(!valid(id))return;
 if(typeof confirm==='function'&&!confirm('이 포스트잇을 모든 휴대폰에서 삭제할까요?'))return;
 mutate('delete',{id});
}
function toggleDone(){showCompleted=!showCompleted;draw()}
function authenticate(){
 if(!bridge?.requestOfficeBoardAccess){msg('보안코드 연결은 안드로이드 앱에서만 지원합니다.');return}
 bridge.requestOfficeBoardAccess();
}
window.onFirstHyundaiOfficeBoardAuth=e=>{
 if(e?.ok){$('officeBoardAuth')?.classList?.add?.('hidden');msg('사무실 메모 연결 완료');refresh()}
 else msg('사무실 보안코드를 확인하고 다시 연결해 주세요.');
};
$('officeBoardList')?.addEventListener?.('click',event=>{
 const button=event.target?.closest?.('button[data-action]');if(!button)return;
 const id=button.dataset.id,action=button.dataset.action;
 if(!valid(id))return;
 if(action==='done'){const n=items.find(x=>x.id===id);if(n)setDone(id,!n.done)}
 if(action==='edit')edit(id);
 if(action==='cancel')cancelEdit();
 if(action==='save')saveEdit(id);
 if(action==='delete')remove(id);
});
window.FirstHyundaiOfficeBoard={open,refresh,post,edit,cancelEdit,saveEdit,setDone,remove,toggleDone,authenticate,
 onResume(){syncNotificationStatus();if(currentPage==='officeBoard'&&Date.now()-lastCheck>10000)refresh(true)},
 onNewNotification(){if(currentPage==='officeBoard')refresh(true)},
 syncNotificationStatus,enableNotifications,settingsChanged,focusNote,
 _test:{phones,merge}};
})();
