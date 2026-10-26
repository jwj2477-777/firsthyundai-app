/* v2.0.98 · A freeform office sticky board. No public HTTP or local note storage. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bridge=window.FirstHyundaiNative;
const requests=new Map(),localUpdates=new Map(),localDeletes=new Map();
let sequence=0,items=[],busy=false,lastCheck=0,showCompleted=false,editing='',editDraft='',timer=null;
let timerMs=45000,pendingFocus='',view='notes',scheduleOpen=false,suggestedDate='';
let archiveOpen=false,archived=[];
let lastBriefing=0,briefingBusy=false;
const startKst=()=>kstDate(new Date());
let selectedDate='',calendarMonth='';
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
/* Private shared calendar: use the same authenticated notes; no external sync or browser storage. */
function kstParts(date){
 const d=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(d.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
  hourCycle:'h23'}).formatToParts(d);
 const get=t=>parts.find(p=>p.type===t)?.value||'';
 return {date:get('year')+'-'+get('month')+'-'+get('day'),
  time:get('hour')+':'+get('minute')};
}
function kstDate(date){return kstParts(date)?.date||''}
function dateKey(value){return value?kstDate(value):''}
function inputValue(value){const p=value?kstParts(value):null;return p?p.date+'T'+p.time:''}
function toIso(value){
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('일정 날짜와 시간을 확인해 주세요.');
 const result=new Date(value+':00+09:00');
 if(!Number.isFinite(result.getTime())||inputValue(result)!==value)
  throw Error('일정 날짜 또는 시간이 올바르지 않습니다.');
 return result.toISOString();
}
function extracted(text){return window.FirstHyundaiMemoDates?.parse?.(text)||null}
function scheduleSuggestion(text){return extracted(text)?.local||''}
function checkSuggestion(){
 const result=extracted($('officeBoardDraft')?.value);
 const el=$('officeBoardScheduleSuggestion');if(!el)return;
 el.classList?.toggle?.('hidden',!result);
 if(result)el.textContent='▦ 자동 일정 · '+result.local.slice(0,10).replace(/-/g,'.')+
  (result.all_day?' · 종일':' · '+result.local.slice(11));
}
function calendarEntries(){return items.filter(n=>!!dateKey(n.scheduled_at))}
function drawCalendar(){
 if(!$('officeBoardCalendarDays'))return;
 const today=kstDate(new Date());
 if(!selectedDate)selectedDate=today;
 if(!calendarMonth)calendarMonth=selectedDate.slice(0,7);
 const [year,month]=calendarMonth.split('-').map(Number);
 const first=new Date(Date.UTC(year,month-1,1)),start=first.getUTCDay();
 const count=new Date(Date.UTC(year,month,0)).getUTCDate();
 const days=calendarEntries(),byDay=new Map();
 for(const note of days){
  const key=dateKey(note.scheduled_at);if(!byDay.has(key))byDay.set(key,[]);
  byDay.get(key).push(note);
 }
 $('officeBoardCalendarMonth').textContent=year+'년 '+month+'월';
 let markup='';
 for(let i=0;i<start;i++)markup+='<span class="officeBoardDayEmpty"></span>';
 for(let d=1;d<=count;d++){
  const key=calendarMonth+'-'+String(d).padStart(2,'0'),dayNotes=byDay.get(key)||[];
  markup+='<button type="button" class="officeBoardDay'+
   (key===today?' today':'')+(key===selectedDate?' selected':'')+
   '" aria-pressed="'+String(key===selectedDate)+'" onclick="FirstHyundaiOfficeBoard.chooseDay(\''+key+'\')">'+
   '<span>'+d+'</span>'+(dayNotes.length?'<small>'+dayNotes.length+'건</small>':'')+'</button>';
 }
 $('officeBoardCalendarDays').innerHTML=markup;
 const matching=days.filter(n=>dateKey(n.scheduled_at)===selectedDate)
  .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
 $('officeBoardAgendaHeading').textContent=selectedDate.replace(/-/g,'.')+' · 일정 '+matching.length+'건';
 $('officeBoardAgendaList').innerHTML=matching.length?matching.map(note=>{
  const p=kstParts(note.scheduled_at),intro=String(note.text).split('\n')[0];
  return '<button type="button" class="officeBoardAgendaItem'+(note.done?' completed':'')+
    '" onclick="FirstHyundaiOfficeBoard.openCalendarNote(\''+esc(note.id)+'\')"><strong>'+
    esc(note.all_day?'종일':p?.time||'')+'</strong><span>'+esc(intro)+'</span>'+
    (note.done?'<small>완료</small>':'')+'</button>';
 }).join(''):'<p class="tiny">등록된 일정이 없습니다.</p>';
}
function syncViews(){
 const isCal=view==='calendar';
 $('officeBoardCalendar')?.classList?.toggle?.('hidden',!isCal);
 $('officeBoardList')?.classList?.toggle?.('hidden',isCal);
 $('officeBoardListHeading')?.classList?.toggle?.('hidden',isCal);
 for(const [id,selected] of [['officeBoardNotesView',!isCal],['officeBoardCalendarView',isCal]]){
  const e=$(id);if(!e)continue;e.classList?.toggle?.('selected',selected);
  e.setAttribute?.('aria-pressed',String(selected));
 }
 if(isCal)drawCalendar();
}
function setView(next){if(next!=='calendar'&&next!=='notes')return;view=next;archiveOpen=false;
 $('officeBoardArchive')?.classList?.add?.('hidden');syncViews();}
function chooseDay(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return;
 selectedDate=key;calendarMonth=key.slice(0,7);drawCalendar();}
function changeMonth(delta){
 if(!Number.isInteger(delta)||Math.abs(delta)>1)return;
 const [y,m]=calendarMonth.split('-').map(Number);
 const d=new Date(Date.UTC(y,m-1+delta,1));
 calendarMonth=d.toISOString().slice(0,7);
 selectedDate=calendarMonth+'-01';drawCalendar();
}
function today(){selectedDate=kstDate(new Date());calendarMonth=selectedDate.slice(0,7);drawCalendar()}
function addAtSelectedDay(){
 setView('notes');$('officeBoardDraft')?.focus?.();
}
function openCalendarNote(id){
 if(!valid(id))return;showCompleted=true;setView('notes');focusNote(id);
}
async function toggleArchive(){
 if(bridge?.getMode?.()!=='admin'){msg('복구함은 관리자만 열 수 있습니다.');return}
 archiveOpen=!archiveOpen;
 $('officeBoardArchive')?.classList?.toggle?.('hidden',!archiveOpen);
 if(!archiveOpen)return;
 try{const data=await call('archive',{});archived=Array.isArray(data.notes)?data.notes:[];
  drawArchive();}catch(e){msg(e.message)}
}
function drawArchive(){
 const root=$('officeBoardArchiveList');if(!root)return;
 root.innerHTML=archived.length?archived.map(n=>'<article class="officeBoardArchivedItem"><p>'+
  esc(String(n.text).slice(0,140))+'</p><button type="button" data-restore="'+esc(n.id)+'">복구</button></article>').join(''):
  '<p class="tiny">복구 가능한 메모가 없습니다.</p>';
}
$('officeBoardArchiveList')?.addEventListener?.('click',e=>{
 const id=e.target?.closest?.('button[data-restore]')?.dataset?.restore;
 if(valid(id))mutate('restore',{id}).then(result=>{if(result){archived=archived.filter(n=>n.id!==id);drawArchive();refresh(true)}});
});
$('officeBoardDraft')?.addEventListener?.('input',checkSuggestion);
function draw(){
 const list=$('officeBoardList');if(!list)return;
 $('officeBoardCount').textContent=String(items.filter(x=>!x.done).length);
 const completedCount=items.filter(x=>x.done).length;
 $('officeBoardShowDone').textContent=showCompleted?'완료 숨기기':'완료 '+completedCount+'건 보기';
 $('officeBoardShowDone').setAttribute?.('aria-pressed',showCompleted?'true':'false');
 const admin=bridge?.getMode?.()==='admin';
 $('officeBoardArchiveOpen')?.classList?.toggle?.('hidden',!admin);
 const visible=items.filter(x=>showCompleted||!x.done);
 if(!visible.length){
  list.innerHTML='<div class="empty">'+(items.length?'표시할 메모가 없습니다. 완료 메모를 열어볼 수 있습니다.':'아직 메모가 없습니다. 첫 포스트잇을 붙여보세요.')+'</div>';
  drawCalendar();syncViews();return;
 }
 list.innerHTML=visible.map(note=>{
  const id=esc(note.id),isEdit=editing===note.id;
  const body=isEdit?'<textarea class="officeBoardEdit" maxlength="1600" data-edit="'+id+'" aria-label="메모 수정">'+esc(editDraft)+'</textarea>':
   '<div class="officeBoardText">'+(preferences().memoPhones==='off'?esc(note.text):phones(note.text))+'</div>';
  const actions=isEdit?'<button class="officeBoardSave" data-action="save" data-id="'+id+'">저장</button>'+
    '<button data-action="cancel" data-id="'+id+'">취소</button>':
   '<button class="officeBoardDoneAction" data-action="done" data-id="'+id+'">'+(note.done?'완료 취소':'완료')+'</button>'+
   '<button data-action="edit" data-id="'+id+'">수정</button>'+
   (admin?'<button data-action="delete" data-id="'+id+'" class="officeBoardDelete">삭제</button>':'');
  return '<article class="officeBoardNote'+(note.done?' completed':'')+'" data-note="'+id+'">'+
   '<div class="officeBoardNoteTop"><span class="officeBoardNoteLabel">'+(note.done?'✓ 완료':'공유 메모')+'</span>'+
   '<span class="officeBoardAuthor">'+esc(note.author?.name||'작성자 미기록')+'</span><time>'+esc(dateText(note.created_at))+'</time></div>'+
   body+(note.scheduled_at?'<div class="officeBoardNoteSchedule">▦ '+esc(note.all_day?kstDate(note.scheduled_at)+' · 종일':dateText(note.scheduled_at))+'</div>':'')+
   '<div class="officeBoardNoteActions'+(isEdit?' editing':admin?'':' family')+'">'+actions+'</div></article>';
 }).join('');
 if(pendingFocus){
  const note=list.querySelector?.('[data-note="'+pendingFocus+'"]');
  if(note){
   note.classList?.add?.('officeBoardNotificationTarget');
   note.scrollIntoView?.({behavior:'smooth',block:'center'});
   pendingFocus='';
  }
 }
 drawCalendar();syncViews();
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
 sortItems();draw();renderBriefing();
}
// Today's briefing reuses the exact same authenticated private memo records.
function nextDay(date){
 const [y,m,d]=date.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
}
function briefingRows(day,limit){
 return items.filter(n=>!n.done&&n.scheduled_at&&dateKey(n.scheduled_at)===day)
  .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
  .slice(0,limit);
}
function renderBriefing(){
 if(!$('overviewMemoBriefing'))return;
 const date=kstDate(new Date()),tomorrow=nextDay(date);
 const todayNotes=briefingRows(date,5),tomorrowNotes=briefingRows(tomorrow,2);
 const todayTotal=items.filter(n=>!n.done&&dateKey(n.scheduled_at)===date).length;
 const tomorrowTotal=items.filter(n=>!n.done&&dateKey(n.scheduled_at)===tomorrow).length;
 $('overviewMemoCount').textContent=todayTotal+'건';
 const target=$('overviewMemoEntries');if(!target)return;
 const row=(notes)=>notes.map(note=>{
  const t=kstParts(note.scheduled_at),time=note.all_day?'종일':(t?.time||'');
  const title=String(note.text||'').split('\\n')[0].trim().slice(0,65);
  return '<button type="button" class="overviewMemoEntry" data-brief-note="'+esc(note.id)+'">'+
   '<span class="overviewMemoTime">'+esc(time)+'</span>'+
   '<span class="overviewMemoCopy">'+esc(title)+'</span>'+
   '<span class="overviewMemoArrow" aria-hidden="true">›</span></button>';
 }).join('');
 target.innerHTML=(todayNotes.length?row(todayNotes):
  '<p class="overviewMemoEmpty">오늘 예정된 일정이 없습니다.</p>')+
  (tomorrowTotal?'<div class="overviewMemoNextDay">내일 일정 '+tomorrowTotal+'건</div>'+
   row(tomorrowNotes):'');
}
function openBriefing(force=false){
 renderBriefing();
 if(briefingBusy||(!force&&Date.now()-lastBriefing<45000))return;
 briefingBusy=true;
 const target=$('overviewMemoEntries');
 if(target&&!lastBriefing)target.textContent='공유 일정을 확인하는 중…';
 call('list',{}).then(data=>{
  merge(Array.isArray(data.notes)?data.notes:[]);
  lastBriefing=Date.now();
 },()=>{if(target&&!lastBriefing)target.textContent='공유 일정을 불러오지 못했습니다. 메모 연결을 확인해 주세요.'})
 .finally(()=>{briefingBusy=false});
}
function openBriefingNote(id){
 if(!valid(id))return;
 setView('notes');
 if(typeof switchPage==='function')switchPage('officeBoard');
 focusNote(id);
}
function openBriefingCalendar(){
 setView('calendar');
 today();
 if(typeof switchPage==='function')switchPage('officeBoard');
}
$('overviewMemoEntries')?.addEventListener?.('click',e=>{
 const button=e.target?.closest?.('button[data-brief-note]');
 if(button)openBriefingNote(button.dataset.briefNote);
});
async function refresh(silent=false){
 if(busy||currentPage!=='officeBoard')return;
 if(!silent)msg('메모를 확인하는 중…');
 try{
  const data=await call('list',{});
  merge(Array.isArray(data.notes)?data.notes:[]);
  lastCheck=Date.now();
  lastBriefing=lastCheck;
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
 const account=$('officeBoardCurrentMember');
 if(account)account.textContent=bridge?.getOfficeMemberName?.()||'계정 연결 필요';
 settingsChanged();syncNotificationStatus();syncViews();checkSuggestion();refresh();
}
async function mutate(action,data){
 if(busy)return null;
 busy=true;$('officeBoardPost').disabled=true;
 try{
  const result=await call(action,data);
  if(action==='delete')localDeletes.set(data.id,Date.now());
  else if(result.note)localUpdates.set(result.note.id,{note:result.note,time:Date.now()});
  if(action==='post'){$('officeBoardDraft').value='';checkSuggestion();}
  if(action==='restore'&&result.note)localUpdates.set(result.note.id,{note:result.note,time:Date.now()});
  editing='';editDraft='';
  merge(items);
  msg(action==='post'?'포스트잇을 붙였습니다. 다른 휴대폰에도 공유됩니다.':'메모가 반영됐습니다.');
  return result;
 }catch(e){msg(e.message);return null}
 finally{busy=false;$('officeBoardPost').disabled=false}
}
function post(){
 const value=String($('officeBoardDraft')?.value||'').trim();
 if(!value){msg('내용을 적어 주세요.');$('officeBoardDraft')?.focus?.();return}
 if(value.length>1600){msg('메모는 최대 1600자입니다.');return}
 const parsed=extracted(value);
 mutate('post',{text:value,scheduled_at:parsed?.scheduled_at||null,all_day:parsed?.all_day||false});
}
function edit(id){const note=items.find(x=>x.id===id);if(!note)return;editing=id;editDraft=note.text;draw();
 $('officeBoardList')?.querySelector?.('textarea[data-edit]')?.focus?.();}
function cancelEdit(){editing='';editDraft='';draw()}
function saveEdit(id){
 if(id!==editing)return;
 const value=String($('officeBoardList')?.querySelector?.('textarea[data-edit]')?.value||'').trim();
 if(!value||value.length>1600){msg('수정 내용은 1~1600자여야 합니다.');return}
 const parsed=extracted(value);
 mutate('edit',{id,text:value,scheduled_at:parsed?.scheduled_at||null,all_day:parsed?.all_day||false});
}
function setDone(id,done){if(valid(id))mutate('done',{id,done})}
function remove(id){
 if(!valid(id))return;
 if(bridge?.getMode?.()!=='admin'){msg('삭제는 관리자만 할 수 있습니다.');return}
 if(typeof confirm==='function'&&!confirm('이 메모를 복구함으로 이동할까요? 30일 안에 복구할 수 있습니다.'))return;
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
 setView,chooseDay,changeMonth,today,openCalendarNote,toggleArchive,
 onResume(){syncNotificationStatus();if(currentPage==='officeBoard'&&Date.now()-lastCheck>10000)refresh(true);
  else if(currentPage==='overview')openBriefing(true)},
 onNewNotification(){if(currentPage==='officeBoard')refresh(true);
  else if(currentPage==='overview')openBriefing(true)},
 syncNotificationStatus,enableNotifications,settingsChanged,focusNote,
 openBriefing,openBriefingNote,openBriefingCalendar,renderBriefing,
 _test:{phones,merge,scheduleSuggestion,toIso,dateKey,briefingRows,nextDay}};
})();
