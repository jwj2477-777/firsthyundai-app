'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const live=read('app/src/main/assets/public-live.js');
const app=read('app/src/main/java/kr/co/firsthyundai/app/MainActivity.java');
const native=read('app/src/main/java/kr/co/firsthyundai/app/PublicLiveVoice.java');
const worker=read('workers/shared-settings/src/index.mjs');
const deploy=read('.github/workflows/deploy-shared-settings.yml');
assert(html.includes('newsLiveVoiceConsent')&&html.includes('FirstHyundaiLive.start()'));
assert(html.includes('public-live.js')&&html.includes('public-live.css'));
assert(html.includes('newsAiOfficePanel')&&html.includes('newsAiOfficeItems'));
assert(live.includes('startPublicLiveVoice(JSON.stringify(rows))'));
assert(live.includes("typeof remote !== 'undefined'"));
assert(live.includes("['gemini_article','groq_article']"));
assert(!live.includes('localStorage')&&!live.includes('officeBoardDraft'));
assert(app.includes('requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}'));
assert(app.includes('MainActivity.this.startPublicLiveVoice(publicNewsJson)'));
assert(app.includes('stopPublicLiveVoice();'));
assert(native.includes('OfficeBoardClient.liveToken(context)'));
assert(native.includes('onMessage(WebSocket ws,ByteString frame)'),'Handle Google binary WebSocket responses');
assert(native.includes('GeminiLiveFrame.text(frame)'),'Must decode binary setupComplete');
assert(native.includes('onMessage(ws,text)'),'Decoded binary frame must use the usual JSON handler');
assert(native.includes('if(msg.has("setupComplete"))'),'Only start mic after actual Google setupComplete');
assert(native.includes('startMicrophone();return;'),'Mic must start after setupComplete');
assert(native.includes('Google 서버에 연결됐습니다. 음성 사용 준비를 확인하고 있습니다.'),'Do not claim mic ready on socket open');
const frameDecoder=read('app/src/main/java/kr/co/firsthyundai/app/GeminiLiveFrame.java');
assert(frameDecoder.includes('frame.utf8()'),'Decode binary bytes as UTF-8');
assert(!frameDecoder.includes('Log.'),'Do not log private audio frames');

assert(native.includes('LiveFailureReason.display(e)'));
assert(native.includes('LiveFailureReason.websocket('));
const liveErrors=read('app/src/main/java/kr/co/firsthyundai/app/LiveFailureReason.java');
const client=read('app/src/main/java/kr/co/firsthyundai/app/OfficeBoardClient.java');
assert(client.includes('LiveFailureReason.fromHttp(status,bytes.toString("UTF-8"))'));
for(const code of ['daily_free_trial_limit','provider_quota','rate_limited','live_not_configured','account_session_required','provider_access_denied','provider_model_unavailable'])
 assert(liveErrors.includes('FHD_LIVE_'+code),'Specific Live error must not disappear: '+code);
assert(worker.includes('response.status===429?"provider_quota"'));
assert(worker.includes('response.status===401||response.status===403?"provider_access_denied"'));

assert(native.includes('BidiGenerateContentConstrained'));
assert(native.includes('audio/pcm;rate=16000'));
assert(native.includes('24000'));
assert(!native.includes('GEMINI_API_KEY'));
assert(worker.includes('validBoardToken(auth.slice(7)'));
assert(worker.includes('env.AUTH_LIMITER.limit({key:"gemini-live-"'));
assert(worker.includes('LIVE_MAX_DAILY=6'));
assert(worker.includes('const config=liveTokenRequestConfig(Date.now())'));
assert(!/liveConnectConstraints\\s*:\\s*\\{/.test(worker),'Google REST must receive the tested minimal token payload');
assert(worker.includes('newSessionExpireTime'));
assert(worker.includes('env.GEMINI_API_KEY'));
assert(worker.includes('if(req.headers.has("origin"))return res({error:"native_only"},403)'));
assert(deploy.includes('wrangler@4 secret put GEMINI_API_KEY'));
assert(read('app/src/main/AndroidManifest.xml').includes('android.permission.RECORD_AUDIO'));
// Voice remains a deliberate user action. The WebView must not request mic on load.
assert(!/FirstHyundaiLive\.start\(\)/.test(live));
const script=new vm.Script(live),dom={
 newsLiveVoiceStart:{disabled:false},newsLiveVoiceStop:{disabled:true},
 newsLiveVoiceStatus:{textContent:''},newsLiveVoiceTranscript:{textContent:'',hidden:true},
 newsLiveVoiceConsent:{checked:false}
};
let requested=[],stopped=0;
const context={window:{FirstHyundaiNative:{
 startPublicLiveVoice:(payload)=>requested.push(JSON.parse(payload)),
 stopPublicLiveVoice:()=>stopped++
 }},document:{getElementById:k=>dom[k]},remote:{news:{briefs:[
  {summary_method:'gemini_article',summary_version:3,summary_source_url:'https://example.com',
   title:'공개 뉴스',summary:'공개 기사 본문을 확인하여 만든 테스트용 3문장 요약입니다.'},
  {summary_method:'headline_only',summary_version:3,title:'추측 기사',summary:'이것은 보내면 안 됩니다.'}
 ]}}};
vm.createContext(context);script.runInContext(context);
context.window.FirstHyundaiLive.start();
assert.equal(requested.length,0,'Consent is required');
dom.newsLiveVoiceConsent.checked=true;context.window.FirstHyundaiLive.start();
assert.equal(requested.length,1);
assert.equal(requested[0].length,1,'Only public, sourced AI articles can reach Live');
assert(dom.newsLiveVoiceStart.disabled&& !dom.newsLiveVoiceStop.disabled);
context.window.onFirstHyundaiLiveStatus({state:'transcript',message:'안녕하세요'});
assert(dom.newsLiveVoiceTranscript.textContent.includes('안녕하세요'));
context.window.FirstHyundaiLive.onPageChange('contracts');
assert.equal(stopped,1,'Navigating to contracts must end microphone session');
assert(!dom.newsLiveVoiceStart.disabled);
console.log('Native Live privacy, consent and navigation tests passed.');
