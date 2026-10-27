/* FirstHyundai — foreground-only newly published favorite transactions.
   Only the office's fixed 14 groups; never infer a block from similar names.
   This is not Android background push or the government's exact publication timestamp.
   Android system notifications additionally require the user's explicit opt-in and permission. */
(function(){
'use strict';
const PREFIX='firsthyundai-favorite-trades-alerts-v1:';
const PREF='firsthyundai-favorite-trades-alert-enabled-v1';
const NATIVE_PREF='firsthyundai-favorite-trades-native-alert-enabled-v1';
let pending=[];
let previewing=false;
let latestContext=null;
let latestFeedRecords=[];
let historyView=null;
let memory=new Map();
let memoryEnabled=true;
const get=id=>document.getElementById(id);
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(){try{return window.localStorage||localStorage;}catch(e){return null;}}
function load(key){
 try{return store()?.getItem(key)||memory.get(key)||null;}catch(e){return memory.get(key)||null;}
}
function save(key,value){
 memory.set(key,value);
 try{store()?.setItem(key,value);}catch(e){/* memory fallback for storage-restricted devices */}
}
function enabled(){
 const raw=load(PREF);
 return raw!=='0'&&memoryEnabled;
}
function nativeEnabled(){return enabled()&&load(NATIVE_PREF)!=='0';}
function nativePermissionStatus(){
 try{return window.FirstHyundaiNative?.getTradeNotificationPermissionStatus?.()||'unavailable';}
 catch(e){return 'unavailable';}
}
function syncNativeStatus(){
 const label=get('favoriteTradeNativeStatus');
 if(!label)return;
 const setting=get('favoriteTradeNativeEnabled');
 if(setting)setting.checked=load(NATIVE_PREF)!=='0';
 const status=nativePermissionStatus();
 const wanted=load(NATIVE_PREF)!=='0';
 label.textContent=status==='enabled'?
  (wanted?'휴대폰 알림 사용 중 · 앱을 열거나 갱신하면 알려드립니다.':'휴대폰 알림 권한 허용됨 · 알림을 사용하려면 위 옵션을 켜세요.') :
  status==='permission_required'?'휴대폰 알림 권한이 필요합니다. 허용 요청 후에도 차단되면 휴대폰 설정에서 변경하세요.' :
  status==='blocked'?'휴대폰 설정에서 퍼스트현대 알림이 차단됐습니다. 앱 정보 → 알림에서 허용해 주세요.' :
  '웹 미리보기에서는 휴대폰 알림을 사용할 수 없습니다.';
}
function setNativeEnabled(flag){
 save(NATIVE_PREF,flag?'1':'0');
 if(flag){
  // Called directly from user tapping the checkbox; request the platform permission.
  try{window.FirstHyundaiNative?.requestTradeNotificationPermission?.();}catch(e){}
 }
 syncNativeStatus();
}
function tradeSnapshot(items){
 // Persist only public transaction attributes; never store clients, memos or account data.
 const allowed=['id','building','type','contract_date','first_seen_date','area_m2','floor',
  'amount_10k','deposit_10k','monthly_10k','contract_type_raw','status'];
 return JSON.stringify({version:1,items:items.slice(0,100).map(({key,group,row})=>({
  key,group:{id:group.id,label:group.label},
  row:Object.fromEntries(allowed.filter(name=>row[name]!=null).map(name=>[name,row[name]]))
 }))});
}
function notifyPhone(items){
 if(!nativeEnabled()||nativePermissionStatus()!=='enabled'||!items.length)return;
 const grouped=new Map();
 for(const {group} of items)grouped.set(group.id,{label:group.label,n:(grouped.get(group.id)?.n||0)+1});
 const detail=[...grouped.values()].slice(0,5).map(x=>x.label+' '+x.n+'건').join(' · ')+
  (grouped.size>5?' 외 '+(grouped.size-5)+'개 단지':'');
 try{window.FirstHyundaiNative?.postFavoriteTradeNotification?.(Math.min(items.length,100),detail.slice(0,240),tradeSnapshot(items));}
 catch(e){/* The in-app popup remains available even without Android permission. */}
}
function syncBell(){
 // The bell is now an inbox. New trade popups must not overwrite its
 // accessible name or simulate unread OS notifications.
 window.FirstHyundaiNotificationInbox?.refresh?.();
}
function syncOption(){
 syncBell();
 const checkbox=get('favoriteTradeAlertEnabled');
 if(checkbox)checkbox.checked=enabled();
 syncNativeStatus();
}
function setEnabled(flag){
 memoryEnabled=!!flag;
 save(PREF,flag?'1':'0');
 if(!flag){pending=[];hide();}
 syncOption();
}
function hide(){
 syncBell();
 const box=get('favoriteTradeAlertBanner');
 if(box)box.classList.add('hidden');
 const dialog=get('favoriteTradeAlertDialog');
 if(dialog?.open)dialog.close();
}
function later(){
 const dialog=get('favoriteTradeAlertDialog');
 if(dialog?.open)dialog.close();
 previewing=false;
 historyView=null;
}
function dismiss(){pending=[];previewing=false;historyView=null;hide();}
function stableId(r){
 if(r?.id&&typeof r.id==='string'&&r.id.length<160)return r.id;
 // Safe fallback in case a legacy collector omitted a unique record ID.
 return [r?.building,r?.type,r?.contract_date,r?.area_m2,r?.floor,
  r?.amount_10k,r?.deposit_10k,r?.monthly_10k,r?.first_seen_date].map(x=>String(x??'')).join('|');
}
function select(records,context){
 const grouped=new Map((context.favorites||[]).map(g=>[g.id,g]));
 const selected=new Map();
 for(const row of Array.isArray(records)?records:[]){
  if(!row||!row.first_seen_date||typeof row.building!=='string')continue;
  const id=context.lookup(row.building);
  if(!id||!grouped.has(id))continue;
  const key=stableId(row);
  if(!key||selected.has(key))continue;
  selected.set(key,{key,row,group:grouped.get(id)});
 }
 return selected;
}
function formatAmount(row){
 const n=x=>{if(x==null||String(x).trim()==='')return '금액 미기재';
  let val=Number(x);if(!Number.isFinite(val)||val<0)return '금액 확인 필요';
  const whole=Math.floor(val/10000),remain=val%10000;
  return whole?(whole+'억'+(remain?' '+remain.toLocaleString('ko-KR')+'만':'')+'원'):(val.toLocaleString('ko-KR')+'만원');
 };
 return row.type==='매매'?n(row.amount_10k):
  row.type==='전세'?'보증금 '+n(row.deposit_10k):
  row.type==='월세'?'보증금 '+n(row.deposit_10k)+' / 월세 '+n(row.monthly_10k):'금액 확인 필요';
}
function renderDialog(items,isPreview=false){
 const types={매매:0,전세:0,월세:0};
 const groups=new Map();
 for(const item of items){
  if(item.row.type in types)types[item.row.type]++;
  if(!groups.has(item.group.id))groups.set(item.group.id,{label:item.group.label,rows:[]});
  groups.get(item.group.id).rows.push(item.row);
 }
 const title=get('favoriteTradeAlertTitle');
 if(title)title.textContent=isPreview?'알림 화면 미리보기':'새 실거래 '+items.length+'건';
 const caption=get('favoriteTradeAlertCaption');
 if(caption)caption.textContent=isPreview?'예시 화면입니다. 실제 거래나 휴대폰 알림이 아닙니다.':groups.size+'개 관심 단지에서 새로 확인했습니다.';
 const summary=get('favoriteTradeAlertSummary');
 if(summary)summary.innerHTML=Object.entries(types).filter(([,n])=>n).map(([type,n])=>
  '<span class="alertType '+(type==='매매'?'sale':type==='전세'?'lease':'monthly')+'">'+type+' <b>'+n+'건</b></span>').join('');
 const viewButton=get('favoriteTradeAlertView');if(viewButton)viewButton.textContent=isPreview?'미리보기 닫기':'신규 거래 보기';
 const body=get('favoriteTradeAlertRows');
 if(body)body.innerHTML=[...groups.values()].map(g=>{
  const sorted=g.rows.slice().sort((a,b)=>String(b.first_seen_date).localeCompare(String(a.first_seen_date)));
  const byType={매매:0,전세:0,월세:0};for(const row of sorted)if(row.type in byType)byType[row.type]++;
  const breakdown=Object.entries(byType).filter(([,n])=>n).map(([type,n])=>type+' '+n+'건').join(' · ');
  return '<li class="favoriteTradeAlertItem"><div class="alertComplexHeading"><strong>'+html(g.label)+'</strong><span>'+html(breakdown)+'</span></div>'+sorted.map(row=>{
   const kind=row.type==='매매'?'sale':row.type==='전세'?'lease':'monthly';
   const area=row.area_m2!=null&&Number(row.area_m2)>0?'전용 '+row.area_m2+'㎡':'면적 미기재';
   const floor=row.floor!=null&&String(row.floor).trim()!==''?row.floor+'층':'층 미기재';
   const renewal=['갱신','갱신계약'].includes(row.contract_type_raw)?' · 갱신계약':['신규','신규계약'].includes(row.contract_type_raw)?' · 신규계약':'';
   return '<div class="alertTransaction"><div class="alertTransactionTop"><span class="alertDealLabel '+kind+'">'+html(row.type)+html(renewal)+'</span>'+
    (row.status==='해제'?'<span class="alertCancelled">해제</span>':'')+'</div><p class="alertAmount">'+html(formatAmount(row))+'</p><p class="alertDetails">'+html(area)+' · '+html(floor)+'</p><p class="alertDate">계약 '+html(row.contract_date||'미기재')+' · 확인 '+html(row.first_seen_date)+'</p></div>';
  }).join('')+'</li>';
 }).join('');
}
function render(){
 if(!pending.length||!enabled()){hide();return;}
 syncBell();
 const banner=get('favoriteTradeAlertBanner'),count=get('favoriteTradeAlertCount');
 if(count)count.textContent='새 실거래 '+pending.length+'건';
 const names=[...new Set(pending.map(x=>x.group.label))];
 const detail=get('favoriteTradeAlertBannerDetail');
 if(detail)detail.textContent=names[0]+(names.length>1?' 외 '+(names.length-1)+'개 단지':'');
 if(banner)banner.classList.remove('hidden');
 if(!previewing&&!historyView)renderDialog(pending);
}
function tryPopup(manual=false){
 const dialog=get('favoriteTradeAlertDialog');
 if(!dialog||(!previewing&&!historyView&&(!pending.length||!enabled()))||dialog.open)return;
 const others=['noteDialog','complexEditor','favoriteAlertSettingsDialog'].some(id=>get(id)?.open);
 if(others)return;
 if(!manual&&(document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')||
   document.body?.classList?.contains?.('apartmentSheetActive')||
   (typeof currentPage!=='undefined'&&currentPage==='contracts')))return;
 try{if(typeof dialog.showModal==='function')dialog.showModal();}catch(e){/* banner remains actionable */}
}
function open(){if(!pending.length)return;previewing=false;historyView=null;render();tryPopup(true);}
function openSettings(){
 const dialog=get('favoriteAlertSettingsDialog');
 if(!dialog||dialog.open)return;
 // Never place the trade-detail popup over the settings popup.
 if(get('favoriteTradeAlertDialog')?.open)later();
 syncOption();
 try{dialog.showModal?.();}catch(e){}
}
function closeSettings(){
 const dialog=get('favoriteAlertSettingsDialog');
 if(dialog?.open)dialog.close?.();
 get('notificationInboxClear')?.focus?.();
}
function previewFromSettings(){closeSettings();preview();}
function preview(){
 // Preserve the existing preview action while moving its button into the header settings dialog.
 if(get('favoriteAlertSettingsDialog')?.open)closeSettings();
 if(['noteDialog','complexEditor'].some(id=>get(id)?.open))return;
 previewing=true;
 renderDialog([
  {group:{id:'f15',label:'퍼스트파크 15블럭'},row:{type:'매매',amount_10k:95000,area_m2:84.9,floor:18,contract_date:'2026-10-18',first_seen_date:'2026-10-21'}},
  {group:{id:'m23',label:'마스터뷰 23블럭'},row:{type:'전세',deposit_10k:52000,area_m2:84.9,floor:12,contract_date:'2026-10-19',first_seen_date:'2026-10-21',contract_type_raw:'갱신'}}
 ],true);
 tryPopup(true);
}
function historyDate(when){
 const n=Number(when);
 return Number.isFinite(n)&&n>0?new Date(n+9*3600000).toISOString().slice(0,10):'';
}
function legacyGroups(detail){
 return String(detail||'').split(/\s*·\s*/).map(piece=>{
  const match=piece.trim().match(/^(.+?)\s+(\d+)건$/);
  return match?{label:match[1].trim(),count:Number(match[2])}:null;
 }).filter(Boolean);
}
function openHistory(entry){
 if(!entry||entry.kind!=='trade')return false;
 const popup=get('favoriteTradeAlertDialog');
 if(!popup)return false;
 if(popup.open)later();
 const snapshot=entry.tradeSnapshot;
 let items=snapshot?.version===1&&Array.isArray(snapshot.items)?snapshot.items.filter(x=>
  x&&typeof x.key==='string'&&x.group&&typeof x.group.id==='string'&&
  typeof x.group.label==='string'&&x.row&&typeof x.row==='object'&&
  ['매매','전세','월세'].includes(x.row.type)
 ).slice(0,100):[];
 const day=historyDate(entry.when);
 let reconstructed=false;
 const groups=legacyGroups(entry.detail);
 if(!items.length&&groups.length&&day&&latestContext){
  // Pre-upgrade history had only a summary. Reconstruct exclusively when today's
  // public feed matches every group count, otherwise show the original summary.
  const available=[...select(latestFeedRecords,latestContext).values()].filter(x=>x.row.first_seen_date===day);
  const picked=[];
  for(const group of groups){
   const rows=available.filter(x=>x.group.label===group.label);
   if(rows.length!==group.count){picked.length=0;break;}
   picked.push(...rows);
  }
  const count=Number(String(entry.title||'').match(/(\d+)건/)?.[1]);
  if(picked.length&&picked.length===count&&groups.length===new Set(picked.map(x=>x.group.id)).size){
   items=picked;reconstructed=true;
  }
 }
 historyView={date:items.map(x=>x.row.first_seen_date).sort().reverse()[0]||day,
  ids:items.map(x=>x.key)};
 previewing=false;
 if(items.length){
  renderDialog(items);
  get('favoriteTradeAlertTitle').textContent=entry.title||'관심 단지 새 실거래';
  get('favoriteTradeAlertCaption').textContent=reconstructed?
   '당시 거래별 기록이 없어 현재 공개자료에서 단지별 건수가 일치하는 거래를 다시 조회했습니다.':
   '알림이 도착했을 때 저장한 관심 14개 단지의 거래 내역입니다.';
 }else{
  get('favoriteTradeAlertTitle').textContent=entry.title||'관심 단지 새 실거래';
  get('favoriteTradeAlertCaption').textContent='이전 버전에서 받은 알림으로 당시 거래별 상세 기록은 보관되지 않았습니다. 저장된 단지별 소식을 보여드립니다.';
  get('favoriteTradeAlertSummary').innerHTML='';
  get('favoriteTradeAlertRows').innerHTML=groups.length?groups.map(g=>
   '<li class="favoriteTradeAlertItem"><div class="alertComplexHeading"><strong>'+
   html(g.label)+'</strong><span>'+g.count+'건</span></div></li>').join(''):
   '<li class="favoriteTradeAlertItem">'+html(entry.detail||'상세 알림 기록이 없습니다.')+'</li>';
 }
 const button=get('favoriteTradeAlertView');
 if(button)button.textContent=items.length?'해당 거래 보기':'관심 14개 새 거래 보기';
 tryPopup(true);
 return true;
}
function view(){
 if(previewing){later();return;}
 if(historyView){
  const selection=historyView;
  later();
  latestContext?.openNew?.(selection.date,selection.ids.length?selection.ids:null);
  return;
 }
 if(!latestContext||!pending.length)return;
 const date=pending.map(x=>x.row.first_seen_date).sort().reverse()[0];
 const ids=pending.map(x=>x.key);
 dismiss();
 latestContext.openNew(date,ids);
}
function process(payload,context){
 if(!payload||!['ok','partial'].includes(payload.state)||!Array.isArray(payload.records)||
  !context||typeof context.lookup!=='function'||!Array.isArray(context.favorites))return {status:'ignored',newCount:0};
 latestContext=context;
 latestFeedRecords=payload.records;
 syncOption();
 const key=PREFIX+String(context.repository||'default');
 const snapshot=select(payload.records,context);
 let previous=null;
 try{previous=JSON.parse(load(key)||'null');}catch(e){previous=null;}
 const existing=new Set(Array.isArray(previous?.ids)?previous.ids:[]);
 const initialized=previous?.schema===1&&Array.isArray(previous.ids);
 // The FIRST successful sync only establishes a baseline to avoid historical alert floods.
 const fresh=initialized?[...snapshot.values()].filter(item=>!existing.has(item.key)):[];
 const merged=initialized?[...new Set([...existing,...snapshot.keys()])]:[...snapshot.keys()];
 // Preserve unseen older IDs while bounding on-device storage size.
 save(key,JSON.stringify({schema:1,ids:merged.slice(-6000)}));
 if(!enabled())return {status:initialized?'disabled':'baseline',newCount:0};
 if(fresh.length){
  const ids=new Set(pending.map(x=>x.key));
  pending=[...pending,...fresh.filter(x=>!ids.has(x.key))];
  render();
  tryPopup();
  notifyPhone(fresh);
 }
 return {status:initialized?'updated':'baseline',newCount:fresh.length};
}
get('favoriteTradeAlertDialog')?.addEventListener?.('close',()=>{previewing=false;});
get('favoriteAlertSettingsDialog')?.addEventListener?.('close',()=>{});
window.FirstHyundaiTradeAlerts={process,setEnabled,enabled,syncOption,syncNativeStatus,setNativeEnabled,open,openHistory,view,dismiss,later,preview,openSettings,closeSettings,previewFromSettings,stableId,
 _test:{stableId,select,formatAmount,hide}};
})();
