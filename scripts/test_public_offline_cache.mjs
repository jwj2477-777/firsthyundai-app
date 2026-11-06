import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root='app/src/main/';
const java=fs.readFileSync(root+'java/kr/co/firsthyundai/app/PublicOfflineCache.java','utf8');
const native=fs.readFileSync(root+'java/kr/co/firsthyundai/app/MainActivity.java','utf8');
const html=fs.readFileSync(root+'assets/index.html','utf8');
const css=fs.readFileSync(root+'assets/public-offline.css','utf8');
const mainJs=html.split('<script>')[1].split('</script>')[0];
new vm.Script(mainJs);
assert(java.includes('AtomicFile') && java.includes('getNoBackupFilesDir()'));
assert(java.includes('MAX_BYTES=8*1024*1024') && java.includes('MessageDigest.getInstance("SHA-256")'));
assert(java.includes('filename.matches(') && java.includes('repository.matches('));
assert(java.includes('new JSONObject().put("schema",1)'));
for(const name of ['trades','new_trades','news','complexes','school_districts',
 'maintenance_estimates','maintenance_partial','public_services']){
 assert(java.includes(name+'.json'),name+' must be publicly cached');
}
for(const prohibited of ['office-postit','firsthyundai-office-cache','contractText','memberToken',
 'clientAccount','FIRSTHYUNDAI_ACCESS_CODE'])
 assert(!java.includes(prohibited),'Private data must never be written to public snapshot cache: '+prohibited);
assert(native.includes('@JavascriptInterface public void readPublicOfflineFeed('));
assert(native.includes('PublicOfflineCache.save(getApplicationContext(),repository,filename,parsed)'));
assert(native.includes('PublicOfflineCache.allowed(repository,filename)'));
assert(native.includes('deliver("onFirstHyundaiPublicOfflineFeed",reply)'));
assert(html.includes('id="publicOfflineNotice"')&&css.includes('.publicOfflineNotice.hidden'));
assert(mainJs.includes('window.onFirstHyundaiPublicOfflineFeed=result=>'));
assert(mainJs.includes('const cached=await readPublicOffline(filename);'));
assert(mainJs.includes('remote[filename]=cached.payload;'));
assert(mainJs.includes('showPublicOffline(filename,cached.savedAt);'));
assert(mainJs.includes('clearPublicOffline(filename)'));
assert(mainJs.includes('last-known-good') || mainJs.includes('Last verified phone snapshot'));
const hydrate=mainJs.indexOf('const cached=await readPublicOffline(filename);');
const refresh=mainJs.indexOf('const fresh=await fetchRemote(filename);',hydrate);
assert(refresh>hydrate,'Offline data must render before starting online refresh');
assert(mainJs.includes('if(!Array.isArray(fresh.records))')||mainJs.includes('!Array.isArray(fresh.records)'));
assert(mainJs.includes('refreshPublicServices(manual=false)'));
assert(mainJs.includes("['school_districts','maintenance_estimates','maintenance_partial','public_services']"));
assert(mainJs.includes('latest information')||mainJs.includes('최신 정보 미확인'));
const bytes=fs.statSync('data/trades.json').size;
assert(bytes<8*1024*1024,'A normal published trade snapshot must fit offline file limit');
console.log('PASS 8 offline public feeds, atomic last-good storage, no private data, stale label, cached-before-network');
