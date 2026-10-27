// Foreground favorite-complex new trade alerts: baseline, dedupe, preferences, stable 14-block identity.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),asset=path.join(root,'app/src/main/assets');
const html=fs.readFileSync(path.join(asset,'index.html'),'utf8');
const source=fs.readFileSync(path.join(asset,'trade-alerts.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/new_trades.json'),'utf8'));
const tradeUi=html.split('<script>')[1].split('</script>')[0];
new vm.Script(tradeUi);new vm.Script(source);
assert(html.includes('<script src="trade-alerts.js"></script>'));
assert(html.includes('FirstHyundaiTradeAlerts?.process(fresh,'));
assert(html.includes('favoriteTradeAlertEnabled'));
assert(html.includes('FirstHyundaiTradeAlerts.view()'));
assert(html.includes('id="favoriteTradeAlertDialog"'));
assert(html.includes('id="favoriteAlertSettingsDialog"')&&html.includes('id="favoriteAlertButton"'));
assert(html.includes('FirstHyundaiTradeAlerts.preview()'));
assert(html.includes("filename==='new_trades'"),'Check the official new_trades feed, not contract_date of trades.json');
const mapping=tradeUi.slice(tradeUi.indexOf('/* FAVORITES_MAPPING_START:'),tradeUi.indexOf('/* FAVORITES_MAPPING_END */')+'/* FAVORITES_MAPPING_END */'.length);
const {groups,lookup}=vm.runInNewContext(mapping+'\n({groups:FAVORITE_APTS,lookup:favoriteIdForBuilding})');
assert.equal(groups.length,14);
const stores={};
function storage(){return {getItem:k=>stores[k]??null,setItem:(k,v)=>{stores[k]=v}};}
const elements=new Map();
function element(id){
 if(!elements.has(id)){
  const classes=new Set(['hidden']);
  elements.set(id,{id,value:'',textContent:'',innerHTML:'',open:false,checked:true,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
   showModal(){this.open=true},close(){this.open=false}});
 }
 return elements.get(id);
}
const window={localStorage:storage()},ctx=vm.createContext({window,document:{getElementById:element},localStorage:window.localStorage,console});
vm.runInContext(source,ctx);
const a=window.FirstHyundaiTradeAlerts;
let views=[];
const context={repository:'jwj2477-777/firsthyundai-app',favorites:groups,lookup,
 openNew:date=>views.push(date)};
const re=(id,building,type='전세',day='2026-10-21')=>({
 id,building,type,first_seen_date:day,contract_date:'2026-10-18',
 deposit_10k:40000,amount_10k:95000,monthly_10k:0
});
const first=re('first','송도더샵퍼스트파크F15BL');
let response=a.process({state:'ok',records:[first]},context);
assert.equal(response.status,'baseline');
assert.equal(response.newCount,0,'First install must not create an alert flood');
assert(!element('favoriteTradeAlertDialog').open);
assert(!element('favoriteTradeAlertBanner').classList.contains('hidden')===false);
a.openSettings();assert(element('favoriteAlertSettingsDialog').open,'Bell opens global preferences');
assert(element('favoriteTradeAlertEnabled').checked,'Existing persisted alert preference remains available');
a.previewFromSettings();assert(!element('favoriteAlertSettingsDialog').open);
assert(element('favoriteTradeAlertDialog').open,'Preview is available from the moved setting');
a.later();
response=a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매')]},context);
assert.equal(response.newCount,1);
assert(element('favoriteTradeAlertDialog').open);
assert(element('favoriteTradeAlertCount').textContent.includes('1건'));
assert(!element('favoriteAlertButton').classList.contains('hasNewTrade'),'Bell is reserved for recorded Android notifications, not unposted trade popups');
assert(element('favoriteTradeAlertRows').innerHTML.includes('퍼스트파크 15블럭'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('매매 1건'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('9억 5,000만원'));
assert.equal(a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매')]},context).newCount,0);
assert(element('favoriteTradeAlertCount').textContent.includes('1건'),'Repeated sync must not replay the record');
a.view();assert.deepEqual(views,['2026-10-21']);
assert(!element('favoriteTradeAlertDialog').open);
assert(element('favoriteTradeAlertBanner').classList.contains('hidden'));
// Neighboring similarly named complex is not one of the 14.
response=a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매'),
 re('not-favorite','송도더샵센트럴시티'),re('not-block','더샵송도프라임뷰21BL')]},context);
assert.equal(response.newCount,0);
response=a.process({state:'partial',records:[first,
 re('new-one','송도더샵퍼스트파크F15BL','매매'),
 re('new-two','더샵송도프라임뷰20BL','월세'),
 re('new-three','더샵송도프라임뷰25BL','전세')]},context);
assert.equal(response.newCount,2,'Prime View 20 and 25 must remain separate');
assert(element('favoriteTradeAlertRows').innerHTML.includes('프라임뷰 20블럭'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('프라임뷰 25블럭'));
assert(element('favoriteTradeAlertCount').textContent.includes('2건'));
a.dismiss();
assert(!element('favoriteAlertButton').classList.contains('hasNewTrade'),'Dismissing new trades clears bell dot');
a.setEnabled(false);
assert(!element('favoriteTradeAlertEnabled').checked);
a.openSettings();assert(element('favoriteAlertSettingsDialog').open,'Settings must remain available when notifications are off');
a.closeSettings();assert(!element('favoriteAlertSettingsDialog').open);
response=a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매'),
 re('new-two','더샵송도프라임뷰20BL','월세'),re('new-three','더샵송도프라임뷰25BL','전세'),
 re('disabled','송도더샵마스터뷰21BL')]},context);
assert.equal(response.newCount,0,'Disabled notification must be silent');
a.setEnabled(true);
assert(element('favoriteTradeAlertEnabled').checked);
response=a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매'),
 re('new-two','더샵송도프라임뷰20BL','월세'),re('new-three','더샵송도프라임뷰25BL','전세'),
 re('disabled','송도더샵마스터뷰21BL')]},context);
assert.equal(response.newCount,0,'Re-enabling must not replay disabled historical deals');
assert(!element('favoriteTradeAlertDialog').open);
const stash=stores['firsthyundai-favorite-trades-alerts-v1:jwj2477-777/firsthyundai-app'];
assert(stash&&JSON.parse(stash).ids.includes('disabled'));
const other={...context,repository:'other/office'};
response=a.process({state:'ok',records:[re('other-one','송도더샵퍼스트파크F15BL')]},other);
assert.equal(response.newCount,0,'Different repository must establish independent baseline');
assert.equal(a.process({state:'not_started',records:[]},other).status,'ignored');
assert.equal(a._test.select(data.records,context).size,
 new Set((data.records||[]).filter(r=>lookup(r.building)).map(r=>r.id)).size,
 'Actual public new-trade records should use exact 14-complex mapping');
console.log('Favorite popup alerts regression passed: first sync baseline, one-time updates, modal, 14 blocks, preferences, persistence, no server push.');
// v1.19.8: preview is isolated; Later preserves the banner; multi-day alerts retain every ID.
const storedBefore=JSON.stringify(stores),viewCount=views.length;
a.preview();
assert(element('favoriteTradeAlertDialog').open);
assert(element('favoriteTradeAlertCaption').textContent.includes('실제 거래'));
a.view();
assert.equal(JSON.stringify(stores),storedBefore,'Preview cannot change the baseline or seen IDs');
assert.equal(views.length,viewCount,'Preview cannot navigate to fabricated transactions');
assert.equal(a._test.formatAmount({type:'매매'}),'금액 미기재');
let routed=null;
const uiContext={...context,repository:'ui/alerts',openNew:(date,ids)=>{routed={date,ids:Array.from(ids)}}};
a.process({state:'ok',records:[]},uiContext);
const older={...re('older-unread','송도더샵퍼스트파크F15BL','매매','2026-10-20'),area_m2:84.9,floor:18,status:'해제'};
const newer={...re('newer-unread','송도더샵마스터뷰23-1BL','전세','2026-10-21'),area_m2:84.9,floor:12,contract_type_raw:'갱신'};
ctx.document.activeElement={matches:()=>true};
a.process({state:'ok',records:[older,newer]},uiContext);
assert(!element('favoriteTradeAlertDialog').open,'Typing must not be interrupted by an automatic modal');
assert(!element('favoriteAlertButton').classList.contains('hasNewTrade'),'The bell now shows delivered notification history, while typing-safe in-app alerts retain their banner');
assert(!element('favoriteTradeAlertBanner').classList.contains('hidden'));
ctx.document.activeElement=null;
a.open();
assert(element('favoriteTradeAlertRows').innerHTML.includes('계약 2026-10-18'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('84.9㎡'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('해제'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('갱신계약'));
a.later();
assert(!element('favoriteTradeAlertDialog').open);
assert(!element('favoriteTradeAlertBanner').classList.contains('hidden'),'Later retains an actionable banner');
a.open();assert(element('favoriteTradeAlertDialog').open);
a.view();assert.deepEqual(routed,{date:'2026-10-21',ids:['older-unread','newer-unread']});
a.openSettings();assert(element('favoriteAlertSettingsDialog').open);
a.closeSettings();assert(!element('favoriteAlertSettingsDialog').open);
const malicious={...re('escape','송도더샵퍼스트파크F15BL'),contract_date:'<img src=x onerror=bad()>',floor:'<script>'};
a.process({state:'ok',records:[older,newer,malicious]},uiContext);
assert(!element('favoriteTradeAlertRows').innerHTML.includes('<img'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('&lt;script&gt;'));
console.log('Popup UX passed: isolated example, later/reopen, no typing interruption, exact multi-day navigation, escaped fields and no false zero.');
a.later();
assert(a.openHistory({kind:'trade',title:'관심 단지 새 실거래 2건',detail:'퍼스트파크 15블럭 2건',
 when:Date.UTC(2026,9,27),tradeSnapshot:{version:1,items:[
  {key:'saved-1',group:{id:'f15',label:'퍼스트파크 15블럭'},
   row:{type:'매매',amount_10k:90000,first_seen_date:'2026-10-27',contract_date:'2026-10-26'}},
  {key:'saved-2',group:{id:'f15',label:'퍼스트파크 15블럭'},
   row:{type:'월세',deposit_10k:4000,monthly_10k:150,first_seen_date:'2026-10-27'}}
 ]}}));
assert(element('favoriteTradeAlertDialog').open,'Stored alert reopens as detail popup');
assert.equal((element('favoriteTradeAlertRows').innerHTML.match(/alertTransactionTop/g)||[]).length,2,'No truncation in restored popup');
assert(element('favoriteTradeAlertRows').innerHTML.includes('9억원'));
a.later();
assert(a.openHistory({kind:'trade',title:'관심 단지 새 실거래 9건',
 detail:'센트럴파크푸르지오 4건 · 파크애비뉴 1건 · 퍼스트파크 14블럭 2건 · 마스터뷰 23블럭 1건 · 프라임뷰 20블럭 1건',
 when:Date.UTC(2026,9,27)}));
assert(element('favoriteTradeAlertDialog').open,'Legacy notifications still open popup');
assert(element('favoriteTradeAlertRows').innerHTML.includes('센트럴파크푸르지오'));
assert(element('favoriteTradeAlertRows').innerHTML.includes('프라임뷰 20블럭'));
assert(element('favoriteTradeAlertCaption').textContent.includes('이전 버전'),'Legacy details not invented');
a.later();
console.log('Historical favorite-trade alerts reopen their original recorded details or honest legacy summary.');
