/* v2.0.98 · A freeform office sticky board. No public HTTP or local note storage. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bridge=window.FirstHyundaiNative;
const requests=new Map(),localUpdates=new Map(),localDeletes=new Map();
let sequence=0,items=[],busy=false,lastCheck=0,showCompleted=false,editing='',editDraft='',timer=null;
let timerMs=45000,pendingFocus='',view='notes',scheduleOpen=false,suggestedDate='';
let archiveOpen=false,archived=[];
let memoStatus='active',memoQuery='',memoAuthor='all',memoLimit=12,composerOpen=false;
let lastBriefing=0,briefingBusy=false;
const startKst=()=>kstDate(new Date());
let selectedDate='',calendarMonth='',editingBirthday='';
function focusNote(id){
 if(!valid(id))return false;
 pendingFocus=id;
 memoStatus='all';memoQuery='';memoAuthor='all';memoLimit=Math.max(items.length,12);if($('officeBoardSearch'))$('officeBoardSearch').value='';
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
function canEditNote(note){
 if(!note||!valid(note.id))return false;
 if(bridge?.getMode?.()==='admin')return true;
 const ownId=String(bridge?.getOfficeMemberId?.()||'');
 // Do not use display names: they can change and are not unique.
 return !!ownId&&note.author?.id===ownId;
}
function canEditId(id){return canEditNote(items.find(note=>note.id===id))}
function denied(){msg('이 메모는 최초 작성자 또는 관리자만 수정할 수 있습니다.')}
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
function annualCalendar(){return window.FirstHyundaiAnnualCalendar}
function birthdayOf(note){return annualCalendar()?.parseNote?.(note?.text)||null}
function memoItems(){return items.filter(note=>!birthdayOf(note))}
function calendarEntries(year,month){
 const annual=annualCalendar(),prefix=String(year)+'-'+String(month).padStart(2,'0');
 const regular=memoItems().filter(n=>dateKey(n.scheduled_at).startsWith(prefix));
 const recurring=[];
 if(annual)for(const note of items){
  const birthday=annual.parseNote(note.text);
  if(!birthday)continue;
  for(const day of annual.occurrencesInMonth(birthday,year,month))
   recurring.push({...note,scheduled_at:annual.isoAllDay(day),all_day:true,recurring:true});
 }
 return regular.concat(recurring);
}
function drawCalendar(){
 if(!$('officeBoardCalendarDays'))return;
 const today=kstDate(new Date());
 if(!selectedDate)selectedDate=today;
 if(!calendarMonth)calendarMonth=selectedDate.slice(0,7);
 const [year,month]=calendarMonth.split('-').map(Number);
 const first=new Date(Date.UTC(year,month-1,1)),start=first.getUTCDay();
 const count=new Date(Date.UTC(year,month,0)).getUTCDate();
 const days=calendarEntries(year,month),byDay=new Map();
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
   '<span>'+d+'</span>'+(dayNotes.some(n=>birthdayOf(n))?'<i class="officeBoardBirthdayDot" aria-label="생일 일정"></i>':'')+
   (dayNotes.length?'<small>'+dayNotes.length+'건</small>':'')+'</button>';
 }
 $('officeBoardCalendarDays').innerHTML=markup;
 const matching=days.filter(n=>dateKey(n.scheduled_at)===selectedDate)
  .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
 $('officeBoardAgendaHeading').textContent=selectedDate.replace(/-/g,'.')+' · 일정 '+matching.length+'건';
 $('officeBoardAgendaList').innerHTML=matching.length?matching.map(note=>{
  const p=kstParts(note.scheduled_at),birthday=birthdayOf(note),id=esc(note.id);
  if(birthday){
   const annualText=birthday.kind+' '+birthday.month+'월 '+birthday.day+'일 · 매년';
   const management=bridge?.getMode?.()==='admin'?
    '<span class="officeBoardBirthdayManage"><button type="button" onclick="FirstHyundaiOfficeBoard.editBirthday(\''+id+'\')">수정</button>'+
    '<button type="button" onclick="FirstHyundaiOfficeBoard.deleteBirthday(\''+id+'\')">삭제</button></span>':'';
   return '<div class="officeBoardAgendaItem officeBoardBirthdayEvent"><span class="officeBoardBirthdayMark" aria-hidden="true">🎂</span>'+
    '<div class="officeBoardBirthdayCopy"><strong>'+esc(birthday.name)+' 생일</strong><small>'+esc(annualText)+'</small></div>'+
    management+'</div>';
  }
  const intro=String(note.text).split('\n')[0];
  return '<button type="button" class="officeBoardAgendaItem'+(note.done?' completed':'')+
    '" onclick="FirstHyundaiOfficeBoard.openCalendarNote(\''+id+'\')"><strong>'+
    esc(note.all_day?'종일':p?.time||'')+'</strong><span>'+esc(intro)+'</span>'+
    (note.done?'<small>완료</small>':'')+'</button>';
 }).join(''):'<p class="tiny">등록된 일정이 없습니다.</p>';
}
function syncViews(){
 const isCal=view==='calendar';
 // One tab, one job. The free-form composer and its feedback belong to notes,
 // not to the calendar. Keep the typed draft untouched when switching tabs.
 for(const id of ['officeBoardComposer','officeBoardFeedback','officeBoardList','officeBoardListHeading','officeBoardFindTools','officeBoardNewMemo']){
  const e=id==='officeBoardComposer'?document.querySelector?.('#officeBoard .officeBoardComposer'):$(id);
  e?.classList?.toggle?.('hidden',isCal);
 }
 $('officeBoardCalendar')?.classList?.toggle?.('hidden',!isCal);
 for(const [id,selected] of [['officeBoardNotesView',!isCal],['officeBoardCalendarView',isCal]]){
  const e=$(id);if(!e)continue;e.classList?.toggle?.('selected',selected);
  e.setAttribute?.('aria-pressed',String(selected));
 }
 if(!isCal)document.querySelector?.('#officeBoard .officeBoardComposer')?.classList?.toggle?.('hidden',!composerOpen);
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
 setView('notes');toggleComposer(true);$('officeBoardDraft')?.focus?.();
}
function openCalendarNote(id){
 if(!valid(id))return;
 if(birthdayOf(items.find(n=>n.id===id)))return; // Birthdays have no completion workflow.
 showCompleted=true;memoStatus='all';memoQuery='';memoAuthor='all';memoLimit=Math.max(items.length,12);if($('officeBoardSearch'))$('officeBoardSearch').value='';setView('notes');focusNote(id);
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
function toggleComposer(force){
 composerOpen=typeof force==='boolean'?force:!composerOpen;
 const panel=document.querySelector?.('#officeBoard .officeBoardComposer');
 panel?.classList?.toggle?.('hidden',!composerOpen||view==='calendar');
 $('officeBoardNewMemo')?.setAttribute?.('aria-expanded',String(composerOpen));
 if(composerOpen)$('officeBoardDraft')?.focus?.();
}
function setMemoStatus(status){
 if(!['active','done','all'].includes(status))return;
 memoStatus=status;memoLimit=12;draw();
}
function searchMemo(value){memoQuery=String(value||'');memoLimit=12;draw()}
function filterMemoAuthor(value){memoAuthor=String(value||'all');memoLimit=12;draw()}
function loadMoreMemos(){memoLimit+=12;draw()}
function draw(){
 const list=$('officeBoardList');if(!list)return;
 const memos=memoItems();
 $('officeBoardCount').textContent=String(memos.filter(x=>!x.done).length);
 const completedCount=memos.filter(x=>x.done).length;
 const authors=[...new Map(memos.filter(n=>n.author?.id).map(n=>[n.author.id,n.author.name||'작성자'])).entries()];
 const authorSelect=$('officeBoardAuthorFilter');
 if(authorSelect){
  authorSelect.innerHTML='<option value="all">작성자 전체</option>'+authors.map(([id,name])=>
   '<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
  authorSelect.value=authors.some(([id])=>id===memoAuthor)?memoAuthor:'all';
  if(authorSelect.value==='all')memoAuthor='all';
 }
 for(const [id,active] of [['officeBoardActiveFilter',memoStatus==='active'],
  ['officeBoardCompletedFilter',memoStatus==='done'],['officeBoardAllFilter',memoStatus==='all']]){
  const el=$(id);el?.classList?.toggle?.('selected',active);el?.setAttribute?.('aria-pressed',String(active));
 }
 $('officeBoardActiveFilterCount')&&( $('officeBoardActiveFilterCount').textContent=String(memos.length-completedCount));
 $('officeBoardCompletedFilterCount')&&( $('officeBoardCompletedFilterCount').textContent=String(completedCount));
 $('officeBoardAllFilterCount')&&( $('officeBoardAllFilterCount').textContent=String(memos.length));
 $('officeBoardShowDone').textContent=showCompleted?'완료 숨기기':'완료 '+completedCount+'건 보기';
 $('officeBoardShowDone').setAttribute?.('aria-pressed',showCompleted?'true':'false');
 const admin=bridge?.getMode?.()==='admin';
 $('officeBoardArchiveOpen')?.classList?.toggle?.('hidden',!admin);
 const q=memoQuery.trim().toLocaleLowerCase();
 const matches=memos.filter(n=>(memoStatus==='all'||(memoStatus==='done'?n.done:!n.done))&&
  (memoAuthor==='all'||n.author?.id===memoAuthor)&&
  (!q||[n.text,n.author?.name,n.scheduled_at].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
 const visible=matches.slice(0,memoLimit);
 $('officeBoardResultCount')&&($('officeBoardResultCount').textContent=matches.length+'건');
 $('officeBoardLoadMore')?.classList?.toggle?.('hidden',matches.length<=memoLimit);
 if(!visible.length){
  list.innerHTML='<div class="empty">'+(memos.length?'조건에 맞는 메모가 없습니다. 검색어나 필터를 변경해 보세요.':'아직 메모가 없습니다. 새 메모를 작성해 보세요.')+'</div>';
  drawCalendar();syncViews();return;
 }
 list.innerHTML=visible.map(note=>{
  const id=esc(note.id),editable=canEditNote(note),isEdit=editable&&editing===note.id;
  const body=isEdit?'<textarea class="officeBoardEdit" maxlength="1600" data-edit="'+id+'" aria-label="메모 수정">'+esc(editDraft)+'</textarea>':
   '<div class="officeBoardText">'+(preferences().memoPhones==='off'?esc(note.text):phones(note.text))+'</div>';
  const actions=isEdit?'<button class="officeBoardSave" data-action="save" data-id="'+id+'">저장</button>'+
    '<button data-action="cancel" data-id="'+id+'">취소</button>':
   (editable?
    '<button class="officeBoardDoneAction" data-action="done" data-id="'+id+'">'+(note.done?'완료 취소':'완료')+'</button>'+
    '<button data-action="edit" data-id="'+id+'">수정</button>'+
    (!Array.isArray(note.images)||note.images.length<3?'<button data-action="photoAdd" data-id="'+id+'">사진 추가</button>':'')
    :'<span class="officeBoardReadOnly">작성자·관리자만 수정 가능</span>')+
   (admin?'<button data-action="delete" data-id="'+id+'" class="officeBoardDelete">삭제</button>':'');
  return '<article class="officeBoardNote'+(note.done?' completed':'')+'" data-note="'+id+'">'+
   '<div class="officeBoardNoteTop"><span class="officeBoardNoteLabel">'+(note.done?'✓ 완료':'공유 메모')+'</span>'+
   '<span class="officeBoardAuthor">'+esc(note.author?.name||'작성자 미기록')+'</span><time>'+esc(dateText(note.created_at))+'</time></div>'+
   body+(note.scheduled_at?'<div class="officeBoardNoteSchedule">▦ '+esc(note.all_day?kstDate(note.scheduled_at)+' · 종일':dateText(note.scheduled_at))+
     (!note.all_day&&!note.done?'<small class="officeBoardReminderHint">🔔 시작 30분 전 알림</small>':'')+'</div>':'')+
   (Array.isArray(note.images)&&note.images.length?'<div class="officeBoardPhotoStrip" aria-label="첨부 사진">'+
    note.images.filter(x=>/^[0-9a-f-]{36}$/.test(x)).map((photo,i)=>
      '<button type="button" class="officeBoardPhotoTile" data-action="photoView" data-id="'+id+
      '" data-photo="'+photo+'">▧ 사진 '+(i+1)+' 보기</button>').join('')+'</div>':'')+
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
 document.dispatchEvent?.(new Event('firsthyundai-office-schedule-updated'));
}
// Today's briefing reuses the exact same authenticated private memo records.
function nextDay(date){
 const [y,m,d]=date.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
}
function briefingRows(day,limit){
 // Birthdays belong only to the calendar, not to daily actionable tasks.
 return memoItems().filter(note=>!note.done&&note.scheduled_at&&dateKey(note.scheduled_at)===day)
  .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))).slice(0,limit);
}

/* Dates explicitly recorded as whole-day closure/holiday in the private shared board.
   Supports a simple "10월 2일~10월 6일 휴무" range without public data storage. */
function closureDates(){
 const result=new Set();
 for(const note of items){
  if(note.done||!note.all_day||!note.scheduled_at||
    !/(?:휴무|휴가|연휴|휴업|쉬는\s*날|쉬는날)/.test(note.text||''))continue;
  const first=dateKey(note.scheduled_at);if(!first)continue;
  result.add(first);
  let end='';
  const dates=[...String(note.text).matchAll(/(?:20\d{2}\s*[.\/-]\s*)?(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*일?/g)];
  if(dates.length>=2){
   const second=dates[1],parts=first.split('-').map(Number);
   let year=parts[0],month=Number(second[1]),day=Number(second[2]);
   if(month<parts[1])year++;
   const dt=new Date(Date.UTC(year,month-1,day));
   if(dt.getUTCFullYear()===year&&dt.getUTCMonth()+1===month&&dt.getUTCDate()===day)
    end=dt.toISOString().slice(0,10);
  }
  if(end&&end>first){
   for(let d=nextDay(first),n=0;d<=end&&n++<45;d=nextDay(d))result.add(d);
  }
 }
 return [...result];
}

/* Minimal private schedule projection for forecast matching.
   Never expose names, note text, phone numbers, or customer addresses to weather views. */
function weatherAppointments(reference=Date.now(),hours=48){
 const start=Number(reference),end=start+Math.min(Math.max(Number(hours)||48,1),120)*3600000;
 return items.filter(n=>!n.done&&!n.all_day&&n.scheduled_at&&!annualCalendar()?.parseNote(n.text))
  .map(n=>({id:n.id,at:Date.parse(n.scheduled_at)}))
  .filter(n=>Number.isFinite(n.at)&&n.at>=start&&n.at<end)
  .sort((a,b)=>a.at-b.at)
  .slice(0,6).map(n=>({at:new Date(n.at).toISOString()}));
}
function renderBriefing(){
 if(!$('overviewMemoBriefing'))return;
 const date=kstDate(new Date()),tomorrow=nextDay(date);
 const todayNotes=briefingRows(date,5),tomorrowNotes=briefingRows(tomorrow,2);
 const todayTotal=briefingRows(date,9999).length;
 const tomorrowTotal=briefingRows(tomorrow,9999).length;
 $('overviewMemoCount').textContent=todayTotal+'건';
 $('overviewMemoBriefing').hidden=todayTotal===0;
 const target=$('overviewMemoEntries');if(!target)return;
 const row=(notes)=>notes.map(note=>{
  const t=kstParts(note.scheduled_at),time=note.all_day?'종일':(t?.time||'');
  const title=String(note.text||'').split('\n')[0].trim().slice(0,65);
  return '<button type="button" class="overviewMemoEntry" data-brief-note="'+esc(note.id)+'">'+
   '<span class="overviewMemoTime">'+esc(time)+'</span>'+
   '<span class="overviewMemoCopy">'+esc(title)+'</span>'+
   '<span class="overviewMemoArrow" aria-hidden="true">›</span></button>';
 }).join('');
 target.innerHTML=row(todayNotes);
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
 },()=>{if(target&&!lastBriefing){$('overviewMemoBriefing').hidden=false;target.textContent='일정 연결을 확인해 주세요.'}})
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
 const needsPermission=status==='permission_required';
 button.classList.toggle('hidden',!needsPermission);
 // Healthy FCM status is background operational detail, not an always-on banner.
 // The action row appears only when Android notification permission needs a tap.
 $('officeMemoNotificationStatus')?.parentElement?.classList?.toggle?.('hidden',!needsPermission);
}
function enableNotifications(){
 bridge?.requestOfficeMemoNotifications?.();
}
function open(){
 $('officeBoardBirthdayAdd')?.classList?.toggle?.('hidden',bridge?.getMode?.()!=='admin');
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
  if(action==='post'){$('officeBoardDraft').value='';checkSuggestion();composerOpen=false;}
  if(action==='restore'&&result.note)localUpdates.set(result.note.id,{note:result.note,time:Date.now()});
  editing='';editDraft='';
  merge(items);
  msg(action==='post'?'포스트잇을 붙였습니다. 다른 휴대폰에도 공유됩니다.':'메모가 반영됐습니다.');
  return result;
 }catch(e){msg(e.message);return null}
 finally{busy=false;$('officeBoardPost').disabled=false}
}
async function post(){
 const photos=window.FirstHyundaiBoardImages;
 const value=String($('officeBoardDraft')?.value||'').trim();
 if(!value&&!photos?.pendingCount?.()){msg('메모를 적거나 사진을 첨부해 주세요.');return}
 if(value.length>1600){msg('메모는 최대 1600자입니다.');return}
 if(photos?.pendingTarget?.()&&!value){
  await photos.uploadPending(photos.pendingTarget());return;
 }
 const text=value||'📷 사진 공유';
 const parsed=extracted(text);
 const result=await mutate('post',{text,scheduled_at:parsed?.scheduled_at||null,all_day:parsed?.all_day||false});
 if(result?.note?.id&&photos?.pendingCount?.())
  await photos.uploadPending(result.note.id);
}
function toggleBirthdayForm(show){
 if(bridge?.getMode?.()!=='admin'){msg('생일 관리는 관리자만 사용할 수 있습니다.');return}
 const panel=$('officeBoardBirthdayForm');
 if(!panel)return;
 if(!show)editingBirthday='';
 panel.classList.toggle('hidden',!show);
 if(!show){$('officeBoardBirthdayInput').value='';}
 if($('officeBoardBirthdayFormTitle'))$('officeBoardBirthdayFormTitle').textContent=editingBirthday?'생일 수정':'생일 일괄 등록';
 if($('officeBoardBirthdaySave'))$('officeBoardBirthdaySave').textContent=editingBirthday?'매년 생일 수정':'반복 생일 저장';
 if(show)$('officeBoardBirthdayInput')?.focus?.();
}
async function addBirthdays(){
 if(bridge?.getMode?.()!=='admin'){msg('생일 등록은 관리자만 사용할 수 있습니다.');return}
 const annual=annualCalendar(),el=$('officeBoardBirthdayInput'),button=$('officeBoardBirthdaySave');
 const lines=String(el?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>(editingBirthday?1:20)){msg(editingBirthday?'생일 수정은 한 명만 입력해 주세요.':'생일을 1~20줄 적어 주세요.');return}
 const rows=lines.map(line=>annual?.parseLine(line));
 if(rows.some(x=>!x)){msg('이름 양력 1월 3일 형식으로 한 줄씩 입력해 주세요. (음력 가능)');return}
 const today=startKst();
 const events=rows.map(b=>({text:annual.textFor(b),day:annual.nextDate(b,today)}));
 if(events.some(x=>!x.day)){msg('현재 지원하는 음력 변환 기간은 2025~2050년입니다.');return}
 if(button)button.disabled=true;
 let added=0,skipped=0;
 try{
  const remote=await call('list',{});
  const base=Array.isArray(remote.notes)?remote.notes:items;
  const existing=new Set(base.filter(n=>n.id!==editingBirthday).map(x=>String(x.text||'').trim()));
  const received=[];
  if(editingBirthday){
   const event=events[0],id=editingBirthday;
   if(existing.has(event.text)){msg('이미 등록된 생일입니다.');return}
   const result=await call('edit',{id,text:event.text,scheduled_at:annual.isoAllDay(event.day),all_day:true});
   if(result?.note)received.push(result.note);
   else throw Error('수정 결과 확인 불가');
   merge(base.filter(n=>n.id!==id).concat(received));
   msg('생일을 수정했습니다. 모든 해의 캘린더에 반영됩니다.');
  }else{
   for(const event of events){
    if(existing.has(event.text)){skipped++;continue}
    const result=await call('post',{text:event.text,scheduled_at:annual.isoAllDay(event.day),all_day:true});
    if(result?.note)received.push(result.note);
    existing.add(event.text);added++;
   }
   merge(base.concat(received));
   msg('매년 반복 생일 '+added+'건 등록'+(skipped?' · 중복 '+skipped+'건 제외':'')+' · 캘린더 전용으로 표시됩니다.');
  }
  el.value='';
  toggleBirthdayForm(false);
  setView('calendar');
 }catch(e){msg('생일 등록을 확인해 주세요: '+(e?.message||'서버 연결 오류'))}
 finally{if(button)button.disabled=false}
}
function editBirthday(id){
 if(bridge?.getMode?.()!=='admin'||!valid(id))return;
 const birthday=birthdayOf(items.find(n=>n.id===id));if(!birthday)return;
 editingBirthday=id;
 $('officeBoardBirthdayInput').value=birthday.name+' '+birthday.kind+' '+birthday.month+'월 '+birthday.day+'일';
 toggleBirthdayForm(true);
}
async function deleteBirthday(id){
 if(bridge?.getMode?.()!=='admin'||!valid(id)||!birthdayOf(items.find(n=>n.id===id)))return;
 if(typeof confirm==='function'&&!confirm('이 생일을 모든 해의 캘린더에서 삭제할까요?'))return;
 const ok=await mutate('delete',{id});
 if(ok){editingBirthday='';drawCalendar()}
}
function edit(id){const note=items.find(x=>x.id===id);if(!note)return;
 if(!canEditNote(note)){denied();return}
 editing=id;editDraft=note.text;draw();
 $('officeBoardList')?.querySelector?.('textarea[data-edit]')?.focus?.();}
function cancelEdit(){editing='';editDraft='';draw()}
function saveEdit(id){
 if(id!==editing)return;
 if(!canEditId(id)){denied();cancelEdit();return}
 const value=String($('officeBoardList')?.querySelector?.('textarea[data-edit]')?.value||'').trim();
 if(!value||value.length>1600){msg('수정 내용은 1~1600자여야 합니다.');return}
 const parsed=extracted(value);
 mutate('edit',{id,text:value,scheduled_at:parsed?.scheduled_at||null,all_day:parsed?.all_day||false});
}
function setDone(id,done){
 if(!valid(id)||birthdayOf(items.find(n=>n.id===id)))return;
 if(!canEditId(id)){denied();return}
 mutate('done',{id,done});
}
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
 if(action==='photoAdd'){
  const note=items.find(n=>n.id===id);
  if(!canEditNote(note)){denied();return}
  window.FirstHyundaiBoardImages?.selectFor?.(id,Array.isArray(note?.images)?note.images.length:0);
 }
 if(action==='photoView')window.FirstHyundaiBoardImages?.view?.(id,button.dataset.photo);
});
function imageUpdate(note){
 if(!note||!valid(note.id))return;
 localUpdates.set(note.id,{note,time:Date.now()});
 merge(items);
}
window.FirstHyundaiOfficeBoard={open,refresh,post,edit,cancelEdit,saveEdit,setDone,remove,toggleDone,authenticate,
 imageCall:call,imageUpdate,canEdit:canEditId,
 setView,toggleComposer,setMemoStatus,searchMemo,filterMemoAuthor,loadMoreMemos,chooseDay,changeMonth,today,openCalendarNote,toggleArchive,toggleBirthdayForm,addBirthdays,editBirthday,deleteBirthday,
 onResume(){syncNotificationStatus();if(currentPage==='officeBoard'&&Date.now()-lastCheck>10000)refresh(true);
  else if(currentPage==='overview')openBriefing(true)},
 onNewNotification(){if(currentPage==='officeBoard')refresh(true);
  else if(currentPage==='overview')openBriefing(true)},
 syncNotificationStatus,enableNotifications,settingsChanged,focusNote,
 openBriefing,openBriefingNote,openBriefingCalendar,renderBriefing,closureDates,weatherAppointments,
 _test:{phones,merge,scheduleSuggestion,toIso,dateKey,briefingRows,nextDay,calendarEntries,memoItems,birthdayOf,canEditNote}};
})();
