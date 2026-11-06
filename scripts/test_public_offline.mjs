import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root='app/src/main/';
const source=fs.readFileSync(root+'assets/public-offline-ui.js','utf8');
const html=fs.readFileSync(root+'assets/index.html','utf8');
const native=fs.readFileSync(root+'java/kr/co/firsthyundai/app/MainActivity.java','utf8');
const store=fs.readFileSync(root+'java/kr/co/firsthyundai/app/PublicSnapshotStore.java','utf8');
const weather=fs.readFileSync(root+'assets/weather-briefing.js','utf8');
const forecastStore=fs.readFileSync(root+'java/kr/co/firsthyundai/app/WeatherOfflineStore.java','utf8');
const manifest=fs.readFileSync(root+'AndroidManifest.xml','utf8');
const nodes=new Map();
function get(id){
 if(!nodes.has(id)){
  const hidden=new Set(['hidden']);
  nodes.set(id,{textContent:'',classList:{
   add:c=>hidden.add(c),remove:c=>hidden.delete(c),contains:c=>hidden.has(c),
   toggle(c,flag){if(flag===undefined)flag=!hidden.has(c);
    if(flag)hidden.add(c);else hidden.delete(c);return flag;}
  }});
 }
 return nodes.get(id);
}
const context={window:{},document:{getElementById:get}};
vm.runInNewContext(source,context);
const ui=context.window.FirstHyundaiPublicOffline;
assert(ui);
ui.track('trades',{ok:true,offlineCopy:true,offlineSavedAt:1794000000000,deviceSnapshotSaved:true});
assert(ui.isCached('trades'));
assert(!get('publicOfflineBanner').classList.contains('hidden'));
assert(get('publicOfflineTitle').textContent.includes('최신 정보 아님'));
assert(get('publicOfflineDetail').textContent.includes('실거래'));
assert(get('publicOfflineDetail').textContent.includes('마지막 저장본'));
ui.track('news',{ok:false});
assert(ui.isMissing('news'));
assert(get('publicOfflineDetail').textContent.includes('0건이라는 뜻이 아닙니다'));
ui.track('trades',{ok:true,deviceSnapshotSaved:true});
assert(!ui.isCached('trades'));
assert(ui.stored('trades'));
ui.track('news',{ok:true});
assert(get('publicOfflineBanner').classList.contains('hidden'));

assert(store.includes('getNoBackupFilesDir()'));
assert(store.includes('AtomicFile'));
assert(store.includes('MAX_BYTES=8*1024*1024'));
assert(store.includes('ROOT_REPO="jwj2477-777/firsthyundai-app"'));
for(const name of ['trades.json','new_trades.json','complexes.json','news.json',
 'public_services.json','school_districts.json','maintenance_estimates.json',
 'maintenance_partial.json','nearby_config.json'])assert(store.includes(name));
assert(store.includes('doc.optInt("schema_version")!=1'));
assert(!store.includes('office-postit')&&!store.includes('contract'));
assert(native.includes('publicFeedsIo = Executors.newFixedThreadPool(3)'));
assert(native.includes('publicNetworkPresent()'));
assert(native.includes('PublicSnapshotStore.save('));
assert(native.includes('PublicSnapshotStore.read('));
assert(native.includes('if(!PublicSnapshotStore.valid(filename,parsed))'));
assert(native.includes('.put("offlineCopy",true)') || native.includes('obj.put("offlineCopy",true)'));
assert(native.includes('offline.optLong("cachedAt",0L)'));
assert(manifest.includes('android.permission.ACCESS_NETWORK_STATE'));
assert(html.includes('public-offline-ui.js'));
assert(html.includes('public-offline-ui.css'));
assert(html.includes('publicOfflineBanner'));
assert(html.includes('pending[id]={resolve,reject,filename}'));
assert(html.includes("if(filename==='new_trades'&&!window.FirstHyundaiPublicOffline?.isCached?.(filename))"));
assert(html.includes('offline.length?'));
assert(html.includes('id="overviewWeatherOfflineWarning"'));
assert(forecastStore.includes('getNoBackupFilesDir()'));
assert(forecastStore.includes('AtomicFile'));
assert(native.includes('WeatherOfflineStore.save('));
assert(native.includes('WeatherOfflineStore.read('));
assert(weather.includes("offlineForecast=!!(result.ok&&result.offlineCopy)"));
assert(weather.includes('최신 비·눈 예보를 확인할 수 없습니다'));
assert(weather.includes('지도함은 실내에 보관'));
assert(fs.statSync('data/trades.json').size<8*1024*1024,'Largest official public feed must fit cache');
new vm.Script(source);
new vm.Script(weather);
console.log('PASS private-free public offline feeds, stale warnings, airplane-mode fast path and conservative weather');
