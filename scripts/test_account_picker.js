'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const android=path.join(__dirname,'../app/src/main/java/kr/co/firsthyundai/app');
const read=f=>fs.readFileSync(path.join(android,f),'utf8');
const lock=read('LockActivity.java'),main=read('MainActivity.java'),client=read('OfficeBoardClient.java');
const assets=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const members=fs.readFileSync(path.join(assets,'office-members.js'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../workers/shared-settings/src/index.mjs'),'utf8');
// First screen shows only the code. A successful password goes to a dedicated
// native account-selection page, never a popup displayed before authentication.
assert(lock.includes('codeField.setVisibility(View.GONE)')&&
 lock.includes('accountChooser.setVisibility(View.VISIBLE)'));
assert(lock.includes('accountChooser.setVisibility(View.GONE)')&&
 lock.includes('codeField.setVisibility(View.VISIBLE)'));
assert(lock.includes('showAccountChoices(boardSecret)'), 'Correct password must trigger member choices');
assert(lock.includes('AccessPolicy.matches(currentPolicy,input)'), 'Locally verify code before listing accounts');
assert(lock.indexOf('AccessPolicy.matches(currentPolicy,input)')<
 lock.lastIndexOf('showAccountChoices(boardSecret)'), 'Password must precede choices');
assert(lock.includes('OfficeBoardClient.choices(getApplicationContext(),code)'),
 'After correct password fetch managed accounts from server');
assert(lock.includes('OfficeBoardClient.enroll(getApplicationContext(),code,id)'),
 'Selecting a member actually binds the device');
assert(lock.includes('loginDetail.setText("사용할 사무실 계정을 선택해 주세요.'),
 'Account selection page must explain its purpose');
assert(!lock.includes('showExistingAccountReview()'),
 'Never show an account-selection dialog before a password');
assert(lock.includes('OfficeBoardClient.pickerReviewedV210(getApplicationContext())'),
 'Existing authorized devices must receive a one-time password-first migration');
assert(lock.includes('getBooleanExtra("force_member_picker",false)'),
 'Admin can reopen selection but still must provide password');
assert(client.includes('.putBoolean("password_then_member_v210",true).apply()'),
 'Only confirmed account enrollment completes v2.1.10 onboarding');
assert(lock.includes('OfficeBoardClient.checkAccount(getApplicationContext())'),
 'Previously confirmed users still get revocation checks');
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
console.log('Password-first dedicated member page, existing-device migration, secured reassignment and admin chooser passed.');
