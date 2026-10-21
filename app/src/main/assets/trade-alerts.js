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
let latestContext=null;
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
function nativeEnabled(){return enabled()&&load(NATIVE_PREF)==='1';}
function nativePermissionStatus(){
 try{return window.FirstHyundaiNative?.getTradeNotificationPermissionStatus?.()||'unavailable';}
 catch(e){return 'unavailable';}
}
function syncNativeStatus(){
 const label=get('favoriteTradeNativeStatus');
 if(!label)return;
 const setting=get('favoriteTradeNativeEnabled');
 if(setting)setting.checked=load(NATIVE_PREF)==='1';
 const status=nativePermissionStatus();
 const wanted=load(NATIVE_PREF)==='1';
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
function notifyPhone(items){
 if(!nativeEnabled()||nativePermissionStatus()!=='enabled'||!items.length)return;
 const grouped=new Map();
 for(const {group} of items)grouped.set(group.id,{label:group.label,n:(grouped.get(group.id)?.n||0)+1});
 const detail=[...grouped.values()].slice(0,5).map(x=>x.label+' '+x.n+'건').join(' · ')+
  (grouped.size>5?' 외 '+(grouped.size-5)+'개 단지':'');
 try{window.FirstHyundaiNative?.postFavoriteTradeNotification?.(Math.min(items.length,100),detail.slice(0,240));}
 catch(e){/* The in-app popup remains available even without Android permission. */}
}
function syncOption(){
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
 const box=get('favoriteTradeAlertBanner');
 if(box)box.classList.add('hidden');
 const dialog=get('favoriteTradeAlertDialog');
 if(dialog?.open)dialog.close();
}
function dismiss(){pending=[];hide();}
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
 const n=x=>{let val=Number(x||0);if(!Number.isFinite(val)||val<0)return '금액 확인 필요';
  const whole=Math.floor(val/10000),remain=val%10000;
  return whole?(whole+'억'+(remain?' '+remain.toLocaleString('ko-KR')+'만':'')+'원'):(val.toLocaleString('ko-KR')+'만원');
 };
 return row.type==='매매'?n(row.amount_10k):
  row.type==='전세'?'보증금 '+n(row.deposit_10k):
  row.type==='월세'?'보증금 '+n(row.deposit_10k)+' / 월세 '+n(row.monthly_10k):'금액 확인 필요';
}
function render(){
 if(!pending.length||!enabled()){hide();return;}
 const banner=get('favoriteTradeAlertBanner');
 const count=get('favoriteTradeAlertCount');
 if(count)count.textContent='🔔 관심 단지 신규 실거래 '+pending.length+'건';
 if(banner)banner.classList.remove('hidden');
 const headline=get('favoriteTradeAlertTitle');
 if(headline)headline.textContent='관심 단지에 새 실거래 '+pending.length+'건이 확인됐어요';
 const body=get('favoriteTradeAlertRows');
 if(body){
  const groups=new Map();
  for(const item of pending){
   const k=item.group.id;
   if(!groups.has(k))groups.set(k,{label:item.group.label,rows:[]});
   groups.get(k).rows.push(item.row);
  }
  const sorted=[...groups.values()].sort((a,b)=>b.rows.length-a.rows.length);
  body.innerHTML=sorted.slice(0,8).map(g=>{
   const byType={매매:0,전세:0,월세:0};
   for(const row of g.rows)if(row.type in byType)byType[row.type]++;
   const breakdown=Object.entries(byType).filter(([,n])=>n).map(([type,n])=>type+' '+n+'건').join(' · ');
   const newest=g.rows.slice().sort((a,b)=>String(b.first_seen_date).localeCompare(String(a.first_seen_date)))[0];
   return '<li class="favoriteTradeAlertItem"><strong>'+html(g.label)+'</strong>'+
    '<span>'+html(breakdown)+'</span>'+
    '<small>최근 확인일 '+html(newest?.first_seen_date||'미확인')+
    ' · '+html(formatAmount(newest||{}))+'</small></li>';
  }).join('')+(sorted.length>8?'<li class="favoriteTradeAlertMore">외 '+(sorted.length-8)+'개 단지</li>':'');
 }
}
function tryPopup(){
 const dialog=get('favoriteTradeAlertDialog');
 if(!dialog||!pending.length||!enabled()||dialog.open)return;
 // Avoid opening a second modal over currently edited notes or the apartment sheet.
 const others=['noteDialog','complexEditor'].some(id=>get(id)?.open);
 if(others)return;
 try{if(typeof dialog.showModal==='function')dialog.showModal();}catch(e){/* banner remains actionable */}
}
function open(){if(!pending.length)return;render();tryPopup();}
function view(){
 if(!latestContext||!pending.length)return;
 const date=pending.map(x=>x.row.first_seen_date).sort().reverse()[0];
 dismiss();
 latestContext.openNew(date);
}
function process(payload,context){
 if(!payload||!['ok','partial'].includes(payload.state)||!Array.isArray(payload.records)||
  !context||typeof context.lookup!=='function'||!Array.isArray(context.favorites))return {status:'ignored',newCount:0};
 latestContext=context;
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
window.FirstHyundaiTradeAlerts={process,setEnabled,enabled,syncOption,syncNativeStatus,setNativeEnabled,open,view,dismiss,
 _test:{stableId,select,formatAmount,hide}};
})();
