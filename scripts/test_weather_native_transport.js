'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const client=file('app/src/main/java/kr/co/firsthyundai/app/SharedSettingsClient.java');
const theme=file('app/src/main/assets/weather-briefing.js');
const detailCss=file('app/src/main/assets/weather-detail.css');
const snapshot=file('workers/shared-settings/src/weather-snapshot.mjs');
assert(client.includes('"/weather-briefing".equals(endpoint)?65536:5000'),
 'The large hourly weather response needs a 64KiB cap without relaxing private settings limits');
assert(client.includes('if(result.size()>maxResponseBytes)'),
 'Stream response protection must use per-endpoint byte limits');
assert(client.includes('static JSONObject readWeatherBriefing() throws Exception {return call("GET","/weather-briefing",null,null);}'));
assert(client.includes('if(session!=null&&!session.isEmpty())connection.setRequestProperty("Authorization"'),
 'Public weather must not bypass existing bearer handling for protected settings');
assert(snapshot.includes('text.length<=16384')&&snapshot.includes('validWeatherSnapshot'),
 'Worker snapshot remains bounded and validated');
const now=Date.parse('2026-10-27T02:16:00+09:00');
const observed='2026-10-27T01:00:00+09:00';
const hours=Array.from({length:80},(_,i)=>{
 const at=new Date(Date.parse(observed)+i*3600000).toISOString();
 return {at,type:i===20?'rain':'none',pop:i===20?60:0,temp:13+i%4,sky:1};
});
const forecast={schema:1,status:'ok',area:'송도',date:'2026-10-27',
 issued_at:'2026-10-26T23:00:00+09:00',hours};
const bytes=Buffer.byteLength(JSON.stringify(forecast),'utf8');
assert(bytes>5000,'Recreate the original crash: actual-sized 80h hourly JSON exceeds 5KiB');
assert(bytes<65536,'Bounded 64KiB weather channel can now accept full hourly forecast');
const vmDoc={hidden:true,getElementById:()=>null,addEventListener(){}};
const ctx=vm.createContext({Date,AbortController,clearTimeout,setTimeout,
 document:vmDoc,window:{setInterval(){}}});
vm.runInContext(theme,ctx);
const api=ctx.window.FirstHyundaiWeatherBriefing._test;
assert(api.valid(forecast,now),'The same 80h forecast must pass app-side checks');
assert.equal(api.hourlyRows(forecast,now,12).length,12,'All 12 upcoming slots are available after unblocking transport');
assert(detailCss.includes('.fhdWeatherChart:empty{height:0;min-height:0'),
 'If weather really is missing, the UI must not reserve a huge blank chart');
console.log('Native 5KB weather transport regression reproduced and fixed: '+bytes+' bytes, 12 verified future hours.');
