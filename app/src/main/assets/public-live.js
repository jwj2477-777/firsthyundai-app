/* Native only: user-opted-in Gemini Live microphone for public news.
   Never sends office notes, contracts, bank details, or private API data. */
(function(root){
 'use strict';
 let active=false;
 const $=id=>document.getElementById(id);
 function status(text){
  const e=$('newsLiveVoiceStatus');if(e)e.textContent=text;
 }
 function buttons(){
  const start=$('newsLiveVoiceStart'),stop=$('newsLiveVoiceStop');
  if(start)start.disabled=active;
  if(stop)stop.disabled=!active;
 }
 function start(){
  if(active)return;
  const native=root.FirstHyundaiNative;
  if(!native?.startPublicLiveVoice){status('실시간 대화는 업데이트된 안드로이드 앱에서만 지원됩니다.');return;}
  const checked=$('newsLiveVoiceConsent');
  if(!checked?.checked){status('외부 AI 음성 전송 안내를 확인하고 체크한 뒤 시작해 주세요.');return;}
  // Whitelist public published news summary fields. No free-text or private memo data.
  const rows=(root.remote?.news?.briefs||[]).filter(b=>
   ['gemini_article','groq_article'].includes(b.summary_method)&&b.summary_version===3&&
   typeof b.summary==='string'&&b.summary_source_url?.startsWith('https://'))
   .slice(0,4).map(b=>({method:b.summary_method,title:String(b.title||'').slice(0,160),
                       summary:b.summary.slice(0,320)}));
  active=true;buttons();status('연결하는 중입니다…');
  try{native.startPublicLiveVoice(JSON.stringify(rows));}
  catch(e){active=false;buttons();status('기기에서 음성 대화를 시작할 수 없습니다.');}
 }
 function stop(){
  if(!active)return;
  active=false;buttons();
  try{root.FirstHyundaiNative?.stopPublicLiveVoice?.();}catch(e){}
  status('실시간 대화를 종료했습니다.');
 }
 function incoming(event){
  const state=String(event?.state||'');
  const message=String(event?.message||'').slice(0,280);
  if(['error','ended'].includes(state)){active=false;buttons();}
  if(['connecting','connected','listening','error','ended'].includes(state))status(message);
  if(state==='transcript' || state==='heard'){
   const output=$('newsLiveVoiceTranscript');
   if(output){output.textContent=(state==='heard'?'내 말: ':'AI: ')+message;output.hidden=false;}
  }
 }
 root.onFirstHyundaiLiveStatus=incoming;
 root.FirstHyundaiLive={start,stop,onPageChange(page){if(page!=='news')stop()}};
})(window);
