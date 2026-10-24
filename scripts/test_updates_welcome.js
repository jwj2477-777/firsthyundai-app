'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const html=read('app/src/main/assets/index.html');
const source=read('app/src/main/assets/app-updates.js');
const java=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdate.java');
const main=read('app/src/main/java/kr/co/firsthyundai/app/MainActivity.java');
const lock=read('app/src/main/java/kr/co/firsthyundai/app/LockActivity.java');
const icon=read('scripts/generate_launcher_icon.py');
const gradle=read('app/build.gradle');
new vm.Script(source);
assert(html.includes('src="app-updates.js"'));
assert(html.includes('id="appUpdateBanner"')&&html.includes('id="appUpdateCheck"'));
assert(html.includes('class="foot compactAppFooter"'),'Compact update and installed version section should be present');
const actualFooter=html.match(/<footer[^>]*>[\s\S]*?<\/footer>/)?.[0]||'';
assert(actualFooter.includes('appFooterRow')&&actualFooter.includes('installedAppVersion')&&actualFooter.includes('appUpdateStatus'));
assert(!actualFooter.includes('관심 14개 단지'),'Remove redundant repeated app description');
assert(!html.includes('이전 수집에 없었고 새로 확인된 날짜'),'Remove unnecessary public trades intro paragraph');
const estimates=JSON.parse(read('data/maintenance_estimates.json'));
const f15Fee=estimates.records.find(x=>x.complex_id==='f15');
assert(f15Fee&&f15Fee.kapt_code==='A10026679'&&f15Fee.month==='202607'&&f15Fee.won_per_exclusive_m2===3831,
 'Only real sourced F15 K-apt monthly fee rate should be loaded as an initial record');
assert(f15Fee.monthly_total_won===270762294&&f15Fee.source_url==='https://apt.koreacharts.com/apt/A10026679/contents.html');
assert(!html.includes('class="brandEdition"'),'Stale 2.0 badge removed');
assert(html.includes('<h1>퍼스트현대</h1>'));
assert(html.includes('brandSubtitle'));
assert(!html.includes('fill="#FF0000"'),'Top logo should not use vivid red');
assert(html.includes('fill="#116A71"'),'Original FHD paths recolored to teal');
assert(icon.includes('GOLD_STOPS')&&icon.includes('TEAL_STOPS')&&icon.includes('WHITE_LOGO'),'Launcher and startup badge preserve the original FHD FIRST vector with true gold and teal gradients');
assert(html.includes('style="fill:url(#fhdPremiumGold)"'),'Header follows the premium gold and emerald branding');
assert(lock.includes('R.drawable.ic_launcher_badge')&&lock.includes('showWelcome(stage)'));
assert(lock.includes('if(!welcomeDone){openAfterWelcome=true;return;}'),'Startup must not bypass splash and login');
assert(lock.includes('loadLatestPolicy()')&&lock.includes('AccessPolicy.authorized('),'Authentication stays intact');
assert(lock.includes('welcomeOverlay.setOnClickListener')&&lock.includes('ANIMATOR_DURATION_SCALE'));
assert(lock.includes('FrameLayout emblemFrame')&&lock.includes('haloRing')&&lock.includes('goldRule')&&lock.includes('R.drawable.ic_launcher_badge'),'Native FHD welcome uses approved emblem with warm ring and accent');
assert(lock.includes('BrandIdentityStyle.title(title)')&&lock.includes('BrandIdentityStyle.subtitle(subtitle)'),'Intro and moving brand share fonts, tracking, colors and wording');
const nativeBrand=read('app/src/main/java/kr/co/firsthyundai/app/BrandIdentityStyle.java');
assert(nativeBrand.includes('TITLE_COLOR=Color.WHITE')&&nativeBrand.includes('SUBTITLE_COLOR=Color.rgb(246,215,145)'),'Original splash white and gold preserved into the header');
assert(lock.includes('reducedMotion?0:920')&&lock.includes('welcomeHandler.postDelayed'),'Welcome is short and skippable, including reduced-motion');
assert(main.includes('web.setAlpha(0f)')&&main.includes('onPageFinished')&&main.includes('webFirstFrameShown'),'WebView stays hidden until local first frame is loaded');
assert(main.includes('window.FirstHyundaiMotion?.nativeHeaderRects?.()')&&
 main.includes('overlay.moveToHeader(positions,viewport,view,done)')&&
 !main.includes('beginNativeHandoffLanding?.()'),
 'True native shared-element handoff uses actual DOM measurements without mid-flight JS synchronization');
assert(lock.includes('overridePendingTransition(0,0)'),'Prevent conflicting native activity slide');
assert(lock.includes('overlay!=null && openAfterWelcome'),'Preserve native badge during authorized activity handoff');
assert(main.includes('if(motionOff){')&&main.includes('view.setAlpha(1f);'),
 'Reduced motion must show the page without any travel animation');

assert(main.includes('downloadAndInstallVerifiedAppUpdate()')&&main.includes('AppUpdate.allowedDownload(url)'));
assert(main.includes('AppUpdateInstaller.download(')&&main.includes('beginVerifiedInstallation(apk)'));
const installSrc=read('app/src/main/java/kr/co/firsthyundai/app/AppUpdateInstaller.java');
assert(installSrc.includes('verifyPackage(context,temp)')&&installSrc.includes('getPackageArchiveInfo'));
assert(installSrc.includes('newBuild<=oldBuild')&&installSrc.includes('getSigningCertificateHistory'));
assert(java.includes('https://api.github.com/repos/jwj2477-777/firsthyundai-app/releases/latest')===false);
assert(java.includes('releases/latest')&&java.includes('allowedDownload'));
assert(java.includes('comparison>0')&&java.includes('comparison==0?"latest":"stale"'),'Offer only higher versions; distinguish stale feed from same installed version');
assert(/versionName '[0-9]+\.[0-9]+\.[0-9]+'/.test(gradle),'App release must declare a semantic version');
assert(gradle.includes('FHD_SIGNING_KEYSTORE'),'Release signing must use persistent private key');
const objects={};
function E(id){if(!objects[id])objects[id]={hidden:id==='appUpdateBanner',textContent:'',
 handlers:{},addEventListener(type,fn){this.handlers[type]=fn}};
 return objects[id];}
let queries=0,opens=0;const bridge={checkForAppUpdate(){queries++},downloadAndInstallVerifiedAppUpdate(){opens++}};
const w={FirstHyundaiNative:bridge};vm.runInNewContext(source,{window:w,document:{getElementById:E}});
assert.equal(queries,1,'Checks at launch');
w.onFirstHyundaiAppUpdate({state:'available',available:true,newVersion:'2.0.15'});
assert.equal(E('appUpdateBanner').hidden,false);
assert(E('appUpdateBannerText').textContent.includes('2.0.15'));
E('appUpdateInstall').handlers.click();assert.equal(opens,1);
assert(E('appUpdateStatus').textContent.includes('준비'));
w.onFirstHyundaiAppUpdateProgress({phase:'downloading',percent:45});
assert(E('appUpdateStatus').textContent.includes('45%'));
w.onFirstHyundaiAppUpdateProgress({phase:'verifying'});
assert(E('appUpdateStatus').textContent.includes('서명'));
w.onFirstHyundaiAppUpdateProgress({phase:'permission'});
assert(E('appUpdateStatus').textContent.includes('설치 허용'));
w.onFirstHyundaiAppUpdateProgress({phase:'installing'});
assert(E('appUpdateStatus').textContent.includes('안드로이드 설치'));
w.onFirstHyundaiAppUpdateProgress({phase:'error',message:'검증 실패'});
assert(E('appUpdateStatus').textContent.includes('검증 실패'));
E('appUpdateDismiss').handlers.click();assert.equal(E('appUpdateBanner').hidden,true);
w.onFirstHyundaiAppUpdate({state:'latest',available:false});assert.equal(E('appUpdateBanner').hidden,true);
assert(E('appUpdateStatus').textContent.includes('최신'));
w.onFirstHyundaiAppUpdate({state:'unavailable'});assert(E('appUpdateStatus').textContent.includes('공식 다운로드 페이지'));
E('appUpdateCheck').handlers.click();assert.equal(queries,2);
console.log('Update UI, welcome branding, version and signing source tests passed');
