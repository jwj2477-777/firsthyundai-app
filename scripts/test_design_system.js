'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const java=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
// Brand design is unified, and the SVG mark remains intact.
assert.match(html,/FirstHyundai SOFT MODERN/);
assert.match(html,/class="brandSubtitle">송도 실거래 · 아파트정보 · 뉴스<\/div>/);
assert.match(html,/class="officeMarkSvg"/);
assert.match(html,/\.primaryNav button\.active\{background:#195272/);
assert.match(html,/\.modeBar\{background:#fff/);
assert.match(html,/\.newsSummaryBox\{background:#f0f8fa/);
assert.match(html,/\.dealRow\.sale\{background:#f6f9fc/);
assert.match(html,/\.nearbyCard\{background:#f9fcfd/);
// Footer version is drawn from the APK itself, not stale page content.
assert.equal((html.match(/id="appVersion"/g)||[]).length,1);
assert.match(html,/NATIVE\?\.getAppVersion\?\.\(\)/);
assert.match(java,/@JavascriptInterface public String getAppVersion\(\)/);
assert.match(java,/getPackageManager\(\)\.getPackageInfo\(getPackageName\(\), 0\)/);
assert.match(java,/return info\.versionName == null \? "" : info\.versionName/);
const version=gradle.match(/versionName '([0-9]+\.[0-9]+\.[0-9]+)'/);
assert.ok(version,'build declares a semver version');
assert.doesNotMatch(html,/<footer[^>]*>[^<]*v1\.10/);
assert.doesNotMatch(html,/<footer[^>]*>[^<]*v1\.12/);
// App is not simplified at the expense of critical behavior.
assert.match(html,/id="roleButton"/);
assert.match(html,/class="primaryNav"/);
assert.match(html,/function switchPage\(id\)/);
assert.match(html,/function closeApartmentSheet\(/);
assert.match(html,/function renderNews\(/);
console.log('Soft-modern UI, native APK version, office workflows verified; APK version',version[1]);
