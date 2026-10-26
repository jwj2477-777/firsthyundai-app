'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const android=path.join(__dirname,'../app/src/main/java/kr/co/firsthyundai/app');
const read=f=>fs.readFileSync(path.join(android,f),'utf8');
const lock=read('LockActivity.java'),main=read('MainActivity.java'),client=read('OfficeBoardClient.java');
const assets=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const members=fs.readFileSync(path.join(assets,'office-members.js'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../workers/shared-settings/src/index.mjs'),'utf8');
assert(lock.includes('OfficeBoardClient.pickerReviewed(getApplicationContext())'),
 'Existing enrolled users must see the account picker after upgrading');
assert(lock.includes('getBooleanExtra("force_member_picker",false)'),
 'Admin must be able to reopen picker without uninstalling');
assert(lock.includes('showExistingAccountReview()')&&lock.includes('promptReassign('));
assert(lock.includes('OfficeBoardClient.checkAccount(getApplicationContext())'),
 'Always validate revocation before showing account picker');
assert(client.includes('memberChoices(Context c)')&&client.includes('request("GET","/board/accounts",null,auth)'),
 'Account choices must be authenticated');
assert(client.includes('.put("reassign",changing)')&&client.includes('changing?existing:null'),
 'Reassign must prove same-device identity and shared secret');
assert(worker.includes('previous.deviceId!==deviceId')&&worker.includes('previous.member.id!==existing.member_id'));
assert(worker.includes('const binding=changing?crypto.randomUUID()'),
 'Reassigned devices must invalidate previous tokens');
assert(main.includes('requestOfficeMemberPicker()')&&main.includes('adminSessionIdentity')&&
 main.includes('select.putExtra("force_member_picker",true)'));
assert(html.includes('id="officeCurrentMember"')&&
 html.includes('FirstHyundaiOfficeMembers.choose()'));
assert(members.includes('requestOfficeMemberPicker')&&members.includes('if(!allowed()'));
assert(!lock.includes('deleteSharedPreferences('),
 'Do not wipe app data just to reselect an office account');
console.log('One-time upgrade account picker, secured reassignment and administrator reselect UX passed.');
