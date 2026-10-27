'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=read('app/src/main/AndroidManifest.xml');
const native=read('app/src/main/java/kr/co/firsthyundai/app/MainActivity.java');
const installer=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdateInstaller.java');
const updater=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdate.java');
const ui=read('app/src/main/assets/app-updates.js');
const paths=read('app/src/main/res/xml/contract_share_paths.xml');
const unsafe=['REQUEST_INSTALL_PACKAGES','READ_SMS','RECEIVE_SMS','READ_CALL_LOG',
 'BIND_ACCESSIBILITY_SERVICE','QUERY_ALL_PACKAGES','SYSTEM_ALERT_WINDOW','MANAGE_EXTERNAL_STORAGE'];
for(const permission of unsafe)assert(!manifest.includes(permission),
 'Unexpected privileged permission: '+permission);
assert(manifest.includes('android.permission.POST_NOTIFICATIONS'),
 'Office alert notifications must continue working');
assert(manifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
 'Existing scheduled background office notifications must remain');
assert(manifest.includes('android:exported="false"'),
 'Internal activities, services and providers should remain non-exported');
assert(!native.includes('ACTION_MANAGE_UNKNOWN_APP_SOURCES'));
assert(!native.includes('canRequestPackageInstalls()'));
assert(!native.includes('beginVerifiedInstallation('));
assert(!native.includes('AppUpdateInstaller.download('));
assert(!native.includes('application/vnd.android.package-archive'));
assert(native.includes('openOfficialUpdateInBrowser(url)'),
 'A browser handoff replaces embedded APK download/install');
assert(native.includes('Intent.ACTION_VIEW,Uri.parse(url)'),
 'Only the external Android browser handles the pinned release');
assert(native.includes('if(!AppUpdate.allowedDownload(url))return;'),
 'Do not open any arbitrary URL passed from web UI');
assert(!installer.includes('HttpURLConnection')&&!installer.includes('getPackageArchiveInfo'),
 'No native downloader or package installer may remain in the compiled APK');
assert(!paths.includes('verified_updates'),
 'FileProvider must not share internal APK artifacts');
assert(updater.includes('readRelease(')&&updater.includes('allowedDownload(expectedUrl)'),
 'Two validated Github release feeds and installed version selection remain');
assert(ui.includes("phase==='external'")&&ui.includes('Play 프로텍트'),
 'Update UI must explicitly handle the security-warning state');
assert(!ui.includes('Play 프로텍트를 끄'),'Never advise disabling security scanning');
console.log('Play Protect hardening source checks: least privilege, no APK installer, pinned browser handoff.');
