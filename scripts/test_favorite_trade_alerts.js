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
response=a.process({state:'ok',records:[first,re('new-one','송도더샵퍼스트파크F15BL','매매')]},context);
assert.equal(response.newCount,1);
assert(element('favoriteTradeAlertDialog').open);
assert(element('favoriteTradeAlertCount').textContent.includes('1건'));
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
a.setEnabled(false);
assert(!element('favoriteTradeAlertEnabled').checked);
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
