import assert from 'node:assert/strict';
import service from '../workers/shared-settings/src/index.mjs';

const secret='TestFakeAdminCodeOnly_2026!';
const items=new Map();
let admitted=true;
const env={
  FIRSTHYUNDAI_ADMIN_CODE:secret,
  SETTINGS:{
    async get(key,format){const x=items.get(key);return x&&format==='json'?JSON.parse(x):null},
    async put(key,value){items.set(key,value)}
  },
  AUTH_LIMITER:{async limit(){return {success:admitted}}}
};
const root='https://firsthyundai-shared-settings.jwj2477.workers.dev';
const invoke=(path,options)=>service.fetch(new Request(root+path,options),env);
const body=async response=>response.json();
const s={schema:1,type:'firsthyundai-ui-settings',tradePopup:true,
  preferences:{schema:1,start:'nearby',density:'compact',reading:'large',motion:'reduced',contrast:'high'}};
const initial=await body(await invoke('/settings'));
assert.equal(initial.status,'not_configured','Fresh KV does not invent a setting');
const health=await body(await invoke('/health'));assert(health.ok&&health.storage&&health.authConfigured);
const wrong=await invoke('/session',{method:'POST',body:JSON.stringify({code:'wrong-password-2026'})});
assert.equal(wrong.status,401);
admitted=false;assert.equal((await invoke('/session',{method:'POST',body:JSON.stringify({code:secret})})).status,429);
admitted=true;
const noBrowser=await invoke('/session',{method:'POST',headers:{Origin:'https://attacker.example'},body:JSON.stringify({code:secret})});
assert.equal(noBrowser.status,403,'Browser origins cannot access session endpoints');
const approved=await body(await invoke('/session',{method:'POST',body:JSON.stringify({code:secret})}));
assert(typeof approved.token==='string'&&approved.token.length>40);
const denied=await invoke('/settings',{method:'PUT',body:JSON.stringify(s)});
assert.equal(denied.status,401,'Unauthenticated public writer blocked');
const authorized={method:'PUT',headers:{Authorization:'Bearer '+approved.token},body:JSON.stringify(s)};
const posted=await invoke('/settings',authorized);
assert.equal(posted.status,200);
const publicDocument=await body(await invoke('/settings'));
assert.equal(publicDocument.status,'ok');
assert.equal(publicDocument.settings.preferences.density,'compact');
assert.equal(publicDocument.settings.tradePopup,true);
assert.equal(publicDocument.settings.preferences.memoRefresh,'45','Old clients receive safe default values');
const extra={...s,preferences:{...s.preferences,start:'officeBoard',reading:'xlarge',density:'roomy',
 quickOrder:'memoFirst',accent:'teal',tradeAmount:'bold',cancelled:'subtle',
 memoOrder:'oldest',memoCompleted:'show',memoRefresh:'120',memoClock:'24',memoPhones:'off'}};
const upgrade=await invoke('/settings',{method:'PUT',headers:{Authorization:'Bearer '+approved.token},body:JSON.stringify(extra)});
assert.equal(upgrade.status,200,'Updated settings are allowed on Worker');
const uploaded=await body(await invoke('/settings'));
assert.equal(uploaded.settings.preferences.memoRefresh,'120');
assert.equal(uploaded.settings.preferences.memoOrder,'oldest');
assert.equal(uploaded.settings.preferences.start,'officeBoard');
assert.equal(uploaded.settings.preferences.memoPhones,'off');
assert(!JSON.stringify(publicDocument).includes(secret),'Server never writes password into public JSON');
const malformed={...s,preferences:{...s.preferences,reading:'script'}};
assert.equal((await invoke('/settings',{method:'PUT',headers:{Authorization:'Bearer '+approved.token},body:JSON.stringify(malformed)})).status,400);
env.FIRSTHYUNDAI_ADMIN_CODE='DifferentFakeCodeOnly_2026!';
assert.equal((await invoke('/settings',{method:'PUT',headers:{Authorization:'Bearer '+approved.token},body:JSON.stringify(s)})).status,401,'Rotated administrator secret revokes tokens');
console.log('Shared Worker public read, admin session, credential rotation, input guard and KV persisted settings passed.');
