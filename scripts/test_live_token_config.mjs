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
assert(worker.includes('const config=liveTokenRequestConfig(Date.now())'));
assert(worker.includes('LIVE_MAX_DAILY=6'),'Keep per-member daily Live limit');
assert(worker.includes('gemini-3.1-flash-live-preview'),'Preserve verified free Live model');
assert(!/liveConnectConstraints\s*:\s*\{/.test(worker),'Do not send rejected REST field');
assert(worker.includes('validBoardToken(auth.slice(7)'),'Office authentication must remain');
assert(worker.includes('env.AUTH_LIMITER.limit({key:"gemini-live-"'),'Rate limiter must remain');
assert(worker.includes('if(used>=LIVE_MAX_DAILY)'),'Daily limit must remain');
assert(worker.includes('if(!env.GEMINI_API_KEY)'),'API key must stay in Worker Secret');
console.log('Live REST compatibility: single-use/45s/8min, private key, daily quota and fixed client model passed.');
