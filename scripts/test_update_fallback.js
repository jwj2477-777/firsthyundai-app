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
assert(java.includes('if("available".equals(primary.optString("state")))return primary;'));
assert(java.includes('if(!"error".equals(secondary.optString("state")))return secondary;'));
assert(java.includes('allowedDownload(expectedUrl)'),'Do not trust arbitrary release URLs');
assert(java.includes('asset.optLong("size",0)>100000L'),'Check published APK exists');
assert(installer.includes('Arrays.equals(a,b)')&&installer.includes('newBuild<=oldBuild'),
 'Never weaken Android app signing or version checks');
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
console.log('Two independent verified update feeds, signature guard and direct-link recovery validated.');
