'use strict';
/* The phone can still update when api.github.com is blocked/rate-limited. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const java=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdate.java');
const installer=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdateInstaller.java');
const html=read('app/src/main/assets/index.html');
const script=read('app/src/main/assets/app-updates.js');
new vm.Script(script);
assert(java.includes('/releases/latest'));
assert(java.includes('raw.githubusercontent.com/'));
assert(java.includes('/main/data/app_latest.json'));
assert(java.includes('readRelease(fetch(FALLBACK,16000),installed)'),
 'Both feeds must use the same strict verified release parser');
assert(java.includes('return selectRelease(primary,secondary);'),'Always compare both verified feeds');
assert(java.includes('new URL(freshUrl(address))')&&java.includes('UUID.randomUUID()'),'Every check bypasses previously cached request URLs');
assert(java.includes('comparison==0?"latest":"stale"'),'Older feed must not claim latest');
assert(java.includes('allowedDownload(expectedUrl)'),'Do not trust arbitrary release URLs');
assert(java.includes('asset.optLong("size",0)>100000L'),'Check published APK exists');
assert(!installer.includes('HttpURLConnection')&&!installer.includes('getPackageArchiveInfo'),
 'Update UI must not embed a package downloader or installer');
assert(!read('app/src/main/AndroidManifest.xml').includes('REQUEST_INSTALL_PACKAGES'));
assert(java.includes('allowedDownload(expectedUrl)'),
 'Even browser handoff continues to require a pinned official GitHub release asset');
assert(html.includes('id="appUpdateManual"'));
assert(html.includes('https://github.com/jwj2477-777/firsthyundai-app/releases/latest'));
const nodes=new Map();
function node(id){
 if(!nodes.has(id)){
  const classes=new Set(['hidden']);
  nodes.set(id,{hidden:id==='appUpdateBanner',textContent:'',disabled:false,attrs:{},
   classList:{add(k){classes.add(k)},toggle(k,enabled){if(enabled)classes.add(k);else classes.delete(k)},
    contains(k){return classes.has(k)}},
   addEventListener(event,handler){this.attrs[event]=handler}});
 }
 return nodes.get(id);
}
let checked=0,downloaded=0;
const window={FirstHyundaiNative:{checkForAppUpdate(){checked++},
 downloadAndInstallVerifiedAppUpdate(){downloaded++}}};
vm.runInNewContext(script,{window,document:{getElementById:node}});
assert.equal(checked,1);
node('appUpdateCheck').attrs.click();assert.equal(checked,1,'Duplicate checks are ignored while pending');
assert(node('appUpdateCheck').disabled);
window.onFirstHyundaiAppUpdate({available:false,state:'unavailable'});
assert(node('appUpdateManual').classList.contains('hidden')===false,
 'Show official release link if both sources fail');
assert(node('appUpdateStatus').textContent.includes('공식 다운로드 페이지'));
assert(node('appUpdateBanner').hidden);
node('appUpdateCheck').attrs.click();
assert(node('appUpdateManual').classList.contains('hidden'),'Hide manual fallback while querying');
window.onFirstHyundaiAppUpdate({available:true,state:'available',newVersion:'2.0.33'});
assert(node('appUpdateManual').classList.contains('hidden'));
assert(node('appUpdateBanner').hidden===false);
node('appUpdateInstall').attrs.click();
assert.equal(downloaded,1);
window.onFirstHyundaiAppUpdate({available:false,state:'latest'});
assert(node('appUpdateManual').classList.contains('hidden'));
assert(node('appUpdateStatus').textContent.includes('최신 버전'));
window.onFirstHyundaiAppUpdate({available:false,state:'stale'});
assert(!node('appUpdateStatus').textContent.includes('최신 버전'));
assert(!node('appUpdateManual').classList.contains('hidden'));
window.onFirstHyundaiAppUpdate({available:false,state:'latest',newVersion:'2.0.39'});
assert(node('appUpdateStatus').textContent.includes('v2.0.39'));
node('appUpdateCheck').attrs.click();
assert(node('appUpdateBanner').hidden&&node('appUpdateCheck').disabled);
console.log('Independent pinned update feeds and browser-only download fallback validated.');
