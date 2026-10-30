import assert from 'node:assert/strict';
import fs from 'node:fs';
import service from '../workers/shared-settings/src/index.mjs';

const build=service._test.liveTokenRequestConfig;
assert.equal(typeof build,'function','Live request builder must be testable');
const now=Date.parse('2026-10-30T00:01:02Z');
const request=build(now);
assert.equal(request.uses,1,'Never create multi-use Live credentials');
assert.deepEqual(Object.keys(request).sort(),['expireTime','newSessionExpireTime','uses'].sort(),
 'Gemini v1beta REST must not contain unsupported liveConnectConstraints');
assert.equal(request.newSessionExpireTime,'2026-10-30T00:01:47.000Z');
assert.equal(request.expireTime,'2026-10-30T00:09:02.000Z');
assert(!JSON.stringify(request).includes('model')&&!JSON.stringify(request).includes('key'));
const worker=fs.readFileSync(new URL('../workers/shared-settings/src/index.mjs',import.meta.url),'utf8');
assert(worker.includes('liveTokenRequestConfig(now)'));
assert(worker.includes('liveQuota(env,caller.member.id,now)'));
assert(worker.includes('const sessionId=crypto.randomUUID()'));
assert(worker.includes('LIVE_MAX_DAILY=6'),'Keep per-member daily Live limit');
assert(worker.includes('gemini-3.1-flash-live-preview'),'Preserve verified free Live model');
assert(!/liveConnectConstraints\s*:\s*\{/.test(worker),'Do not send rejected REST field');
assert(worker.includes('validBoardToken(auth.slice(7)'),'Office authentication must remain');
assert(worker.includes('env.AUTH_LIMITER.limit({key:"gemini-live-"'),'Rate limiter must remain');
assert(worker.includes('if(quota.remaining<=0)'),'Daily limit must remain');
assert(worker.includes('LIVE_MAX_ATTEMPTS=48'),'Unsuccessful requests must have a finite free safety cap');
assert(worker.includes('liveSession(req,env)'),'Confirm or abort a temporary ticket');
assert(worker.includes('liveStatus(req,env)'),'Expose account-scoped remaining usage');
assert(worker.includes('state:"pending"'),'Token issuance must not immediately charge usage');
assert(worker.includes('const supportsAcknowledgment=requestData?.usage_protocol===2'),'Only updated clients use deferred charging');
assert(worker.includes('const legacyKey="fhd-live-daily-v1:"'),'Old APKs must not bypass free quota');
assert(worker.includes('if(!quotaConfirmed)reportQuota("abort")')===false,'Worker and native concerns must stay separate');
assert(worker.includes('if(!env.GEMINI_API_KEY)'),'API key must stay in Worker Secret');
console.log('Live REST compatibility: single-use/45s/8min, private key, daily quota and fixed client model passed.');

const snapshot=service._test.liveQuota, reset=service._test.liveReset;
const snapshotNow=Date.parse('2026-10-30T05:30:00Z'),member='test-member-id';
const day='2026-10-30',prefix='fhd-live-usage-v2:'+member+':'+day+':';
const entries=new Map([
 ['fhd-live-daily-v1:'+member+':'+day,'1'],
 [prefix+'ready',JSON.stringify({state:'confirmed',expires_at:snapshotNow+60000})],
 [prefix+'pending',JSON.stringify({state:'pending',expires_at:snapshotNow+60000})],
 [prefix+'expired',JSON.stringify({state:'pending',expires_at:snapshotNow-1})],
 [prefix+'aborted',JSON.stringify({state:'aborted',expires_at:snapshotNow+60000})]
]);
const env={SETTINGS:{
 get:async (key,type)=>{const value=entries.get(key);return type==='json'&&value?JSON.parse(value):value??null;},
 list:async ({prefix:base})=>({keys:[...entries.keys()].filter(key=>key.startsWith(base)).map(name=>({name}))})
}};
let quota=await snapshot(env,member,snapshotNow);
assert.equal(quota.used,2,'Only ready sessions plus old usage count');
assert.equal(quota.pending,1,'Pending credential temporarily reserves capacity');
assert.equal(quota.remaining,3,'Aborted/expired sessions must not use quota');
assert.equal(quota.attempts,4,'Even failed attempts count toward anti-abuse request ceiling');
quota=await snapshot(env,member,snapshotNow+61000);
assert.equal(quota.pending,0,'Failed connection automatically frees capacity after 90 seconds');
assert.equal(quota.remaining,4,'Old successful sessions remain counted');
assert.equal(reset(Date.parse('2026-10-30T23:59:59Z')),'2026-10-31 오전 9시');
assert.equal(reset(Date.parse('2026-10-31T00:00:01Z')),'2026-11-01 오전 9시');
console.log('Live account quota: ready vs pending vs abandoned, migration, UTC/KST rollover passed.');
