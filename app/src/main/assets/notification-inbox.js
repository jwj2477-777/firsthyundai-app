/* Private, on-device Android alert history. The bell opens this inbox,
 * never settings. The OS provides permission during first authenticated launch. */
(function(){
 'use strict';
 const by=id=>document.getElementById(id);
 const native=()=>window.FirstHyundaiNative;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let entries=[];
 const temporaryPreviews=new Map();
 function load(){
  try{
   const raw=native()?.getNotificationHistory?.();
   const rows=JSON.parse(raw||'[]');
   return Array.isArray(rows)?rows.filter(x=>
    x&&['memo','trade'].includes(x.kind)&&typeof x.title==='string'&&Number.isFinite(Number(x.when))
   ).slice(0,80):[];
  }catch(e){return []}
 }
 function formatTime(ms){
  try{return new Intl.DateTimeFormat('ko-KR',{
   timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',
   minute:'2-digit',hour12:true
  }).format(new Date(Number(ms)))}catch(e){return ''}
 }
 function refresh(){
  entries=load();
  const unread=entries.filter(x=>!x.read).length;
  const bell=by('favoriteAlertButton');
  if(bell){
   bell.classList.toggle('hasUnreadHistory',unread>0);
   bell.setAttribute('aria-label',unread?'알림함 · 읽지 않은 알림 '+unread+'건':'알림함');
   bell.setAttribute('title','알림함');
  }
  const count=by('notificationInboxCount');
  if(count)count.textContent=entries.length?'최근 알림 '+entries.length+'건':'아직 받은 알림이 없습니다';
  const list=by('notificationInboxList');
  if(list){
   list.innerHTML=entries.length?entries.map((x,index)=>'<button type="button" class="inboxItem" data-index="'+index+'" data-kind="'+
    x.kind+'" aria-label="'+escape(x.title)+' 알림 보기">'+
    '<span class="inboxKind '+x.kind+'" aria-hidden="true">'+(x.kind==='memo'?'▤':'↗')+'</span>'+
    '<span class="inboxInfo"><strong>'+escape(x.title)+'</strong><small>'+
    escape(temporaryPreviews.get(x.noteId)||x.detail||'')+'</small></span><time>'+escape(formatTime(x.when))+'</time></button>'
   ).join(''):'<div class="inboxEmpty">도착한 알림이 없습니다.<small>새로운 실거래나 공유 메모 알림이 이곳에 모입니다.</small></div>';
  }
  const clear=by('notificationInboxClear');
  if(clear)clear.disabled=entries.length===0;
 }
 async function showMemoPreviews(){
  const dialog=by('notificationInboxDialog');
  const latest=entries.filter(x=>x.kind==='memo'&&
    /^[a-z0-9]{8,14}-[0-9a-f-]{36}$/.test(x.noteId||'')).slice(0,6);
  for(const row of latest){
   if(!dialog?.open)return;
   if(temporaryPreviews.has(row.noteId))continue;
   try{
    const note=await window.FirstHyundaiOfficeBoard?.imageCall?.('preview',{id:row.noteId});
    if(!dialog.open)return;
    if(!note||typeof note.preview!=='string')continue;
    const safe=note.preview.replace(/\s+/g,' ').trim()
     .replace(/01[016789][- .]?\d{3,4}[- .]?\d{4}/g,'연락처 확인')
     .slice(0,110);
    temporaryPreviews.set(row.noteId,(note.author?note.author+' · ':'')+
     (safe||'사진 첨부')+(note.image_count?' · 사진 '+note.image_count+'장':''));
    refresh();
   }catch(e){/* Keep generic text when offline or no account access. */}
  }
 }
 function open(){
  const dialog=by('notificationInboxDialog');
  if(!dialog)return;
  window.FirstHyundaiTradeAlerts?.closeSettings?.();
  refresh();
  try{dialog.showModal();}catch(e){return}
  try{native()?.markNotificationHistoryRead?.()}catch(e){}
  const bell=by('favoriteAlertButton');
  if(bell)bell.setAttribute('aria-expanded','true');
  // Mark read after opening. The inbox remains browsable.
  refresh();
  showMemoPreviews();
 }
 function close(){
  temporaryPreviews.clear();
  by('notificationInboxDialog')?.close?.();
  const bell=by('favoriteAlertButton');
  bell?.setAttribute('aria-expanded','false');
  bell?.focus?.();
 }
 function go(kind,index){
  const entry=entries[Number(index)];
  close();
  if(kind==='memo'){window.switchPage?.('officeBoard');if(entry?.noteId)window.FirstHyundaiOfficeBoard?.focusNote?.(entry.noteId);return;}
  if(kind==='trade'){
   // Open the specific favorite-14 alert, never the unfiltered whole-city feed.
   if(entry&&window.FirstHyundaiTradeAlerts?.openHistory?.(entry))return;
   const favorite=document.getElementById('newFavoriteFilter');
   if(favorite)favorite.value='favorites';
   window.switchPage?.('new');
  }
 }
 function clear(){
  if(!entries.length)return;
  if(typeof confirm==='function'&&!confirm('이 휴대폰에 저장된 알림 이력을 모두 지울까요?'))return;
  try{native()?.clearNotificationHistory?.()}catch(e){}
  refresh();
 }
 function settings(){
  close();
  window.FirstHyundaiTradeAlerts?.openSettings?.();
 }
 by('notificationInboxList')?.addEventListener('click',e=>{
  const button=e.target?.closest?.('.inboxItem');
  if(button)go(button.dataset.kind,button.dataset.index);
 });
 by('notificationInboxDialog')?.addEventListener('close',()=>{
  by('favoriteAlertButton')?.setAttribute('aria-expanded','false');
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},20000);
 window.FirstHyundaiNotificationInbox={refresh,open,close,clear,go,settings,
  _test:{load,formatTime}};
 refresh();
})();