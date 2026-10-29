'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../app/src/main'),dir=path.join(root,'java/kr/co/firsthyundai/app');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const notify=read('OfficeMemoNotifications.java'),job=read('OfficeMemoJobService.java'),
 activity=read('MainActivity.java'),board=read('OfficeBoardClient.java');
const manifest=fs.readFileSync(path.join(root,'AndroidManifest.xml'),'utf8'),
 html=fs.readFileSync(path.join(root,'assets/index.html'),'utf8');
for(const token of ['firsthyundai_private_office_notes','IMPORTANCE_HIGH','VISIBILITY_PRIVATE',
 'LockActivity.class','getString(LAST','OfficeBoardClient.deviceId(c)','setPeriodic(15*60*1000L)'])
 assert((notify+job).includes(token),token);
assert(notify.includes('OfficeBoardClient.preview(context,id)')&&notify.includes('BigTextStyle')
 &&notify.includes('setPublicVersion(hidden.build())'),
 'Preview is fetched with private board token and hidden on lockscreen');
assert(notify.includes('replaceAll("(?<!')&&notify.includes('연락처 확인'),
 'Sensitive telephone numbers are masked in previews');
assert(!notify.includes('getData().get("text")'),
 'Never trust or render private FCM payload text');
assert(manifest.includes('RECEIVE_BOOT_COMPLETED')&&manifest.includes('OfficeMemoJobService'));
assert(board.includes('"/board/updates"')&&board.includes('deviceId(Context context)'));
assert(board.includes('"/board/"+noteId+"/preview"'),'Preview API authenticated natively');
assert(activity.includes('postDelayed(this,12000L)')&&activity.includes('memoTimer.removeCallbacks(memoCheck)'));
assert(activity.includes('getOfficeMemoNotificationStatus')&&activity.includes('requestOfficeMemoNotifications'));
assert(html.includes('id="officeMemoNotificationPermission"')&&html.includes('id="adminMemoAlerts"'));
console.log('Android memo notification privacy/permission, foreground/background and lifecycle source checks passed.');