package kr.co.firsthyundai.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.MediaRecorder;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Explicit user-initiated Gemini Live for public news or isolated contract-condition proposals.
 * Mic and audio are never recorded to disk, logged, or added to office memos.
 * An office-authenticated short-lived token comes from the Cloudflare Worker.
 */
final class PublicLiveVoice {
    interface Events { void emit(String status,String text); }
    private static final String ENDPOINT="wss://generativelanguage.googleapis.com/ws/"
        +"google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
    private final Context context;
    private final Events events;
    private final ExecutorService startup=Executors.newSingleThreadExecutor();
    private final ExecutorService player=Executors.newSingleThreadExecutor();
    private volatile boolean running=false;
    private final android.os.Handler durationLimit=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable connectionTimeout=()->{
        if(running){event("error","연결 준비가 지연되어 종료했습니다. 잠시 후 다시 시도해 주세요.");stop();}
    };
    private final Runnable autoStop=()->{
        if(running){stop();event("ended","7분 체험 시간이 끝나 음성 대화를 종료했습니다.");}
    };
    private volatile WebSocket socket;
    private volatile AudioRecord microphone;
    private volatile AudioTrack speaker;
    private volatile boolean closed=false;
    private volatile String quotaSessionId="";
    private volatile boolean quotaConfirmed=false;
    private final ExecutorService quotaUpdates=Executors.newSingleThreadExecutor();
    private void reportQuota(String action){
        final String id=quotaSessionId;
        if(id.isEmpty())return;
        try{quotaUpdates.execute(()->{
            try{OfficeBoardClient.liveSession(context,id,action);}catch(Exception ignored){}
        });}catch(java.util.concurrent.RejectedExecutionException ignored){}
    }
    private OkHttpClient http;
    private String publicBrief="";
    private boolean contractMode=false;
    // Conditions proposed during this session only; never the pre-existing contract form.
    private final JSONObject proposedConditions=new JSONObject();
    private final JSONObject deferredConditions=new JSONObject(); // session-only status keys, no customer values
    private final ContractLiveTurnGate contractTurnGate=new ContractLiveTurnGate();
    // Bytes are written only by the playback executor, but must be heard on
    // the speaker before the contract microphone is sent to Google again.
    private long pcmFramesWritten=0;
    private volatile int audioGeneration=0;
    private final LivePcmQueue audioQueue=new LivePcmQueue();
    private final Object audioLock=new Object();
    private boolean playbackDrainScheduled=false;
    private boolean playbackResetPending=false;
    private volatile AcousticEchoCanceler echoCanceler;
    private static final int PCM_PRIME_BYTES=24_000*2*120/1000; // 120ms of 24kHz mono PCM16
    private static final int PCM_OUTPUT_BUFFER_BYTES=24_000*2; // 1-second hardware buffer
    PublicLiveVoice(Context context,Events events){this.context=context.getApplicationContext();this.events=events;}
    private void event(String state,String text){events.emit(state,text);}
    private static String safePublicBrief(String json){
        if(json==null||json.length()>4200)return "";
        StringBuilder out=new StringBuilder();
        try{
            JSONArray rows=new JSONArray(json);
            for(int i=0;i<Math.min(4,rows.length());i++){
                JSONObject item=rows.optJSONObject(i);
                if(item==null||!("gemini_article".equals(item.optString("method"))||
                                  "groq_article".equals(item.optString("method"))))continue;
                String title=item.optString("title","");
                String summary=item.optString("summary","");
                if(title.length()>160||summary.length()>320||summary.length()<25)continue;
                out.append("\\n").append(title).append(" : ").append(summary);
            }
        }catch(Exception ignored){}
        return out.toString();
    }
    void startContract(){contractMode=true;start("");}
    void start(String publicNews){
        if(closed||running)return;
        if(android.os.Build.VERSION.SDK_INT>=23&&
                context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            event("error","마이크 권한을 허용한 뒤 다시 시작해 주세요.");
            stop();return;
        }
        running=true;publicBrief=contractMode?"":safePublicBrief(publicNews);
        event("connecting","무료 Gemini Live 연결을 확인하고 있습니다.");
        durationLimit.postDelayed(connectionTimeout,45_000L);
        startup.execute(()->{
            try{
                JSONObject token=OfficeBoardClient.liveToken(context);
                quotaSessionId=token.optString("session_id","");
                if(!quotaSessionId.matches("[0-9a-f-]{36}"))
                    throw new Exception("실시간 음성 사용권 확인 실패");
                if(!running){reportQuota("abort");return;}
                String name=token.optString("token","");
                String model=token.optString("model","");
                if(name.length()<12||name.length()>2048||!model.matches("[a-z0-9.-]{10,80}"))
                    throw new Exception("실시간 음성 사용권 확인 실패");
                http=new OkHttpClient.Builder().readTimeout(0,TimeUnit.MILLISECONDS).build();
                Request req=new Request.Builder().url(ENDPOINT+"?access_token="+name).build();
                socket=http.newWebSocket(req,new WebSocketListener(){
                    @Override public void onOpen(WebSocket ws,Response response){
                        if(!running){ws.close(1000,"cancelled");return;}
                        try{
                            JSONObject setup=new JSONObject();
                            setup.put("model","models/"+model);
                            setup.put("generationConfig",new JSONObject()
                                .put("responseModalities",new JSONArray().put("AUDIO")));
                            setup.put("systemInstruction",new JSONObject().put("parts",new JSONArray().put(
                                new JSONObject().put("text",
                                  "당신은 퍼스트현대의 공개 부동산·송도 뉴스용 한국어 음성 안내입니다. " +
                                  "제공된 기사 요약만 출처로 활용하고, 없는 최신 거래 숫자나 사업 일정을 지어내지 마세요. " +
                                  "고객 이름, 전화번호, 계좌, 계약서, 공유 메모를 질문하거나 수집하지 마세요. " +
                                  "해당 개인정보가 나오면 자세히 다루지 말고 일반적인 안내로 전환하세요. " +
                                  "메모 저장이나 일정 변경 등 앱 작업을 실행할 권한이 없습니다. " +
                                  "간결한 존댓말로 응답하세요. 공개 기사 참고 정보:\\n"+publicBrief))));
                            // The default barge-in setting can interrupt the model when
                            // its own speaker leaks back into the microphone.
                            // Contract dictation prioritizes uninterrupted spoken confirmation.
                            JSONObject vad=new JSONObject()
                                .put("automaticActivityDetection",new JSONObject()
                                    .put("startOfSpeechSensitivity","START_SENSITIVITY_LOW")
                                    .put("endOfSpeechSensitivity","END_SENSITIVITY_LOW")
                                    .put("silenceDurationMs",700));
                            if(contractMode)vad.put("activityHandling","NO_INTERRUPTION");
                            setup.put("realtimeInputConfig",vad);
                            setup.put("inputAudioTranscription",new JSONObject());
                            setup.put("outputAudioTranscription",new JSONObject());
                            if(contractMode){
                                setup.put("systemInstruction",new JSONObject().put("parts",new JSONArray().put(
                                    new JSONObject().put("text",ContractLiveProtocol.prompt()))));
                                setup.put("tools",ContractLiveProtocol.tools());
                            }
                            ws.send(new JSONObject().put("setup",setup).toString());
                            event("connected","Google 서버에 연결됐습니다. 음성 사용 준비를 확인하고 있습니다.");
                            // The seven minutes start after usable microphone setup,
                            // not while Google is still completing its handshake.
                        }catch(Exception e){event("error","Live 대화를 시작하지 못했습니다.");stop();}
                    }
                    // Gemini returns JSON envelopes in BINARY WebSocket frames as well as text.
                    // Without this callback setupComplete is silently missed and the microphone never starts.
                    @Override public void onMessage(WebSocket ws,ByteString frame){
                        if(!running)return;
                        String text=GeminiLiveFrame.text(frame);
                        if(text.isEmpty()){
                            event("error","Live 응답 형식 또는 크기를 확인할 수 없습니다.");
                            stop();return;
                        }
                        onMessage(ws,text);
                    }
                    @Override public void onMessage(WebSocket ws,String raw){
                        if(!running)return;
                        try{
                            JSONObject msg=new JSONObject(raw);
                            if(msg.has("setupComplete")){
                                if(microphone!=null)return; // Avoid a second recorder and duplicate quota.
                                durationLimit.removeCallbacks(connectionTimeout);
                                if(startMicrophone()&&running){
                                    quotaConfirmed=true;
                                    reportQuota("ready");
                                    durationLimit.removeCallbacks(autoStop);
                                    durationLimit.postDelayed(autoStop,7*60*1000L);
                                }
                                return;
                            }
                            if(msg.has("error")){
                                event("error","Google Live가 음성 준비 요청을 거절했습니다. 모델 및 연결 설정을 확인해 주세요.");
                                stop();return;
                            }
                            JSONObject calls=msg.optJSONObject("toolCall");
                            if(calls!=null){handleTools(ws,calls);return;}
                            JSONObject content=msg.optJSONObject("serverContent");
                            if(content==null)return;
                            if(content.optBoolean("interrupted")){
                                interruptPlayback();
                            }
                            JSONObject transcript=content.optJSONObject("outputTranscription");
                            if(transcript!=null){
                                String t=transcript.optString("text","");
                                if(!t.isEmpty()){
                                    // Output transcription can precede the first playback PCM.
                                    // Close the half-duplex gate before that first syllable.
                                    if(contractMode)contractTurnGate.modelOutputAnnounced();
                                    event("transcript",t.substring(0,Math.min(280,t.length())));
                                }
                            }
                            JSONObject user=content.optJSONObject("inputTranscription");
                            if(user!=null){
                                String t=user.optString("text","");
                                if(!t.isEmpty()){
                                    if(contractMode)contractTurnGate.userSpeechDetected();
                                    event("heard",t.substring(0,Math.min(200,t.length())));
                                }
                            }
                            JSONObject turn=content.optJSONObject("modelTurn");
                            JSONArray parts=turn==null?null:turn.optJSONArray("parts");
                            if(parts!=null)for(int i=0;i<parts.length();i++){
                                JSONObject part=parts.optJSONObject(i);
                                JSONObject data=part==null?null:part.optJSONObject("inlineData");
                                if(data==null)continue;
                                String audio=data.optString("data","");
                                if(audio.isEmpty()||audio.length()>150000)continue;
                                byte[] pcm=Base64.decode(audio,Base64.DEFAULT);
                                if(pcm.length>0&&pcm.length<=100000){
                                    if(contractMode&&contractTurnGate.modelAudioStarted())
                                        event("ai_speaking","AI가 질문 중입니다. 답변이 끝나면 말씀해 주세요.");
                                    play(pcm);
                                }
                            }
                            if(contractMode&&content.optBoolean("turnComplete")){
                                contractTurnGate.modelTurnComplete();
                                resumeMicrophoneAfterPlayback();
                            }
                        }catch(Exception ignored){}
                    }
                    @Override public void onFailure(WebSocket ws,Throwable t,Response response){
                        if(running){event("error",LiveFailureReason.websocket(response==null?0:response.code()));stop();}
                    }
                    @Override public void onClosed(WebSocket ws,int code,String reason){
                        if(running){
                            event("error","Google Live 연결이 종료됐습니다 (연결 코드 "+code+"). 다시 시도해 주세요.");
                            stop();
                        }
                    }
                });
            }catch(Exception e){
                if(running){event("error",LiveFailureReason.display(e));stop();}
            }
        });
    }
    private void handleTools(WebSocket ws,JSONObject call){
        try{
            JSONArray calls=call.optJSONArray("functionCalls"),responses=new JSONArray();
            if(calls==null)return;
            for(int i=0;i<Math.min(calls.length(),20);i++){
                JSONObject fc=calls.optJSONObject(i);if(fc==null)continue;
                String result="rejected_invalid_fields";
                if(contractMode&&ContractLiveProtocol.FUNCTION.equals(fc.optString("name"))){
                    JSONObject args=fc.optJSONObject("args");
                    if(ContractLiveReview.isStatusCall(args)){
                        try{
                            String[] state=ContractLiveReview.validate(args);
                            if(running){
                                ContractLiveReview.record(deferredConditions,proposedConditions,state);
                                event("review_state",ContractLiveReview.publicState(state[0],state[1]).toString());
                                result="review_status_recorded";
                            }
                        }catch(Exception ignored){result="rejected_invalid_fields";}
                    }else{
                        try{
                            JSONObject proposal=ContractLiveProtocol.validated(args);
                            try{
                                ContractLiveProtocol.validateConsistency(proposedConditions,proposal);
                                if(running){
                                    java.util.Iterator<String> keys=proposal.keys();
                                    while(keys.hasNext()){
                                        String key=keys.next();
                                        proposedConditions.put(key,proposal.get(key));
                                    }
                                    ContractLiveReview.clearResolved(deferredConditions,proposal);
                                    event("proposal",proposal.toString());
                                    java.util.Iterator<String> changed=proposal.keys();
                                    while(changed.hasNext())
                                        event("review_state",ContractLiveReview.publicState(
                                            changed.next(),"confirmed").toString());
                                    result="proposed_for_user_review";
                                }
                            }catch(Exception conflict){result="rejected_inconsistent_conditions";}
                        }catch(ContractLiveProtocol.PastContractDateException e){
                            result="rejected_past_date";
                            event("date_warning","말씀하신 날짜가 지난 연도로 인식됐습니다. 연도를 정확히 확인해 주세요.");
                        }catch(Exception ignored){}
                    }
                }
                // Only field names, counts and fixed acknowledgement leave this device.
                JSONObject acknowledgement=new JSONObject().put("result",result);
                if(contractMode&&("proposed_for_user_review".equals(result)||
                                  "review_status_recorded".equals(result)))
                    acknowledgement.put("dialogue",ContractLiveChecklist.reminder(
                        proposedConditions,deferredConditions));
                responses.put(new JSONObject().put("id",fc.optString("id"))
                    .put("name",fc.optString("name"))
                    .put("response",acknowledgement));
            }
            if(running)ws.send(new JSONObject().put("toolResponse",new JSONObject().put("functionResponses",responses)).toString());
        }catch(Exception ignored){}
    }
    private synchronized boolean startMicrophone(){
        if(!running||microphone!=null)return false;
        try{
            final int minimum=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
            if(minimum<=0)throw new Exception("audio unavailable");
            AudioRecord recorder=new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum,6400));
            if(recorder.getState()!=AudioRecord.STATE_INITIALIZED){
                recorder.release();throw new Exception("audio init unavailable");
            }
            if(AcousticEchoCanceler.isAvailable()){
                try{
                    AcousticEchoCanceler echo=AcousticEchoCanceler.create(recorder.getAudioSessionId());
                    if(echo!=null){
                        if(echo.getEnabled()||echo.setEnabled(true)==0)echoCanceler=echo;
                        else echo.release();
                    }
                }catch(Exception ignored){ /* Existing VOICE_COMMUNICATION capture still works. */ }
            }
            microphone=recorder;recorder.startRecording();
            event("listening",contractMode?"계약 조건을 말씀하세요. 이름·주소·계좌는 말하지 마세요.":"말씀하세요. 공개된 뉴스에 대해서만 질문해 주세요.");
            Thread reader=new Thread(()->{
                // 40ms of 16kHz mono PCM16; Google's Live guidance recommends 20–40ms.
                // A 100ms chunk can slow turn detection and feel like clipped speech.
                byte[] samples=new byte[1280];
                LiveMicBuffer pending=new LiveMicBuffer();
                while(running&&microphone==recorder){
                    int n;
                    try{n=recorder.read(samples,0,samples.length);}catch(Exception e){n=-1;}
                    if(!running||microphone!=recorder)break;
                    if(n<0){
                        event("error","마이크에서 음성을 읽지 못해 종료했습니다. 마이크 권한과 연결을 확인해 주세요.");
                        stop();break;
                    }
                    if(n==0)continue;
                    // Contract mode never forwards buffered user audio after the
                    // AI starts talking; that would become a stale imaginary reply.
                    if(contractMode&&!contractTurnGate.microphoneAllowed()){
                        pending.clear();continue;
                    }
                    // Keep short, real user speech in memory while OkHttp is
                    // congested; silently throwing away PCM can lose an amount
                    // or date and lead to a mistaken contract proposal.
                    if(!pending.offer(samples,n)){
                        event("error","네트워크 지연으로 음성이 누락될 수 있어 대화를 종료했습니다. 검토 후보는 유지됩니다.");
                        stop();break;
                    }
                    WebSocket ws=socket;
                    if(ws==null){
                        event("error","음성 연결이 끊겼습니다. 계약 조건을 확인한 뒤 다시 시작해 주세요.");
                        stop();break;
                    }
                    boolean failed=false;
                    while(running&&!pending.isEmpty()&&ws.queueSize()<=64000){
                        if(contractMode&&!contractTurnGate.microphoneAllowed()){
                            pending.clear();break;
                        }
                        byte[] packet=pending.poll();
                        try{
                            String payload=Base64.encodeToString(packet,Base64.NO_WRAP);
                            boolean accepted=ws.send(new JSONObject().put("realtimeInput",new JSONObject().put("audio",
                                new JSONObject().put("data",payload).put("mimeType","audio/pcm;rate=16000"))).toString());
                            if(!accepted)failed=true;
                        }catch(Exception ignored){failed=true;}
                        if(failed)break;
                    }
                    if(failed){
                        event("error","음성 전송 연결이 종료됐습니다. 검토 후보를 확인하고 다시 연결해 주세요.");
                        stop();break;
                    }
                }
                pending.clear();
            },"fhd-live-voice-capture");
            reader.setDaemon(true);reader.start();
            return true;
        }catch(Exception e){
            event("error","음성을 시작할 수 없습니다. 마이크 권한을 확인해 주세요.");
            stop();
            return false;
        }
    }
    /** Google can deliver many audio frames in one burst. Never silently discard
     * the middle of a spoken sentence: use an ordered 12s bounded jitter queue.
     */
    private void play(byte[] pcm){
        if(!running||pcm==null||pcm.length==0)return;
        synchronized(audioLock){
            if(!audioQueue.offer(pcm,audioGeneration)){
                event("error","AI 음성 재생 처리량이 부족해 중간 내용이 누락될 수 있습니다. 대화를 종료했습니다. 휴대전화 성능과 네트워크를 확인해 주세요.");
                stop(); // Report failure instead of silently chopping the contract reply.
                return;
            }
        }
        schedulePlayback();
    }
    private void schedulePlayback(){
        synchronized(audioLock){
            if(playbackDrainScheduled||playbackResetPending||!running||player.isShutdown()
                ||audioQueue.isEmpty())return;
            playbackDrainScheduled=true;
            try{player.execute(this::drainPlayback);}
            catch(java.util.concurrent.RejectedExecutionException ignored){
                playbackDrainScheduled=false;
            }
        }
    }
    /** Speaker is touched only by the single playback executor, including flush.
     * A short prebuffer avoids underflow when Google sends small frames unevenly.
     */
    private void drainPlayback(){
        try{
            if(speaker==null)Thread.sleep(120);
            int[] primed={0};
            while(running){
                LivePcmQueue.Frame frame;
                synchronized(audioLock){
                    if(playbackResetPending)break;
                    frame=audioQueue.poll();
                }
                if(frame==null)break;
                if(frame.generation!=audioGeneration)continue;
                AudioTrack track=speaker;
                if(track==null){
                    int min=AudioTrack.getMinBufferSize(24000,AudioFormat.CHANNEL_OUT_MONO,
                        AudioFormat.ENCODING_PCM_16BIT);
                    if(min<=0)throw new IllegalStateException("audio output unavailable");
                    track=new AudioTrack(AudioManager.STREAM_MUSIC,24000,
                        AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT,
                        Math.max(min,PCM_OUTPUT_BUFFER_BYTES),AudioTrack.MODE_STREAM);
                    if(track.getState()!=AudioTrack.STATE_INITIALIZED){
                        track.release();throw new IllegalStateException("audio output unavailable");
                    }
                    speaker=track;
                    pcmFramesWritten=0;
                }
                if(!writePacket(track,frame.pcm,frame.generation,primed))
                    throw new IllegalStateException("audio output write failed");
            }
            // A very short spoken response might contain under 120ms in total.
            AudioTrack track=speaker;
            if(running&&!playbackResetPending&&track!=null&&
                track.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING)
                track.play();
        }catch(InterruptedException ignored){Thread.currentThread().interrupt();}
        catch(Exception ignored){
            if(running){
                event("error","휴대전화에서 AI 음성을 정상적으로 재생하지 못했습니다. 연결을 종료합니다.");
                stop();
            }
        }finally{
            synchronized(audioLock){playbackDrainScheduled=false;}
            schedulePlayback();
        }
    }
    /** Write all bytes; Android's blocking write may still return a partial count. */
    private boolean writePacket(AudioTrack track,byte[] pcm,int generation,int[] primed){
        int offset=0;
        while(running&&generation==audioGeneration&&offset<pcm.length){
            int available=pcm.length-offset;
            if(track.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING)
                available=Math.min(available,Math.max(1,PCM_PRIME_BYTES-primed[0]));
            int written=track.write(pcm,offset,available,AudioTrack.WRITE_BLOCKING);
            if(written<=0)return false;
            offset+=written;
            pcmFramesWritten+=written/2; // 16-bit mono PCM => 2 bytes per playback frame.
            if(track.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING){
                primed[0]+=written;
                if(primed[0]>=PCM_PRIME_BYTES)track.play();
            }
        }
        return true;
    }
    /** Do not reopen the mic just because Google finished generating:
     * AudioTrack may still be speaking, including buffered final syllables.
     * This is queued after the current speaker drain on the same executor.
     */
    private void resumeMicrophoneAfterPlayback(){
        if(!contractMode||!running)return;
        final int generation=audioGeneration;
        try{player.execute(()->{
            if(!running||generation!=audioGeneration)return;
            try{
                AudioTrack track=speaker;
                if(track!=null){
                    long expected=pcmFramesWritten;
                    long deadline=android.os.SystemClock.elapsedRealtime()+5000L;
                    while(running&&generation==audioGeneration&&speaker==track&&
                          android.os.SystemClock.elapsedRealtime()<deadline){
                        long heard=track.getPlaybackHeadPosition()&0xffffffffL;
                        if(heard+480>=expected)break; // <=20ms tail is effectively silent.
                        Thread.sleep(30);
                    }
                    if(!running||generation!=audioGeneration)return;
                    if(speaker==track&&
                       (track.getPlaybackHeadPosition()&0xffffffffL)+480<expected){
                        event("error","AI 음성 재생이 끝나지 않아 입력을 재개하지 못했습니다. 대화 연결을 종료합니다.");
                        stop();
                        return;
                    }
                }
                if(contractTurnGate.playbackFinished())
                    event("listening","AI 질문이 끝났습니다. 이제 답변을 말씀해 주세요.");
            }catch(InterruptedException ignored){Thread.currentThread().interrupt();}
        });}catch(java.util.concurrent.RejectedExecutionException ignored){}
    }
    private void interruptPlayback(){
        synchronized(audioLock){
            audioGeneration++;
            audioQueue.clear();
            playbackResetPending=true;
            try{
                player.execute(()->{
                    AudioTrack track=speaker;speaker=null;
                    if(track!=null){
                        try{track.pause();track.flush();}catch(Exception ignored){}
                        track.release();
                    }
                    synchronized(audioLock){playbackResetPending=false;}
                    if(contractMode&&running){
                        contractTurnGate.clear(); // speaker is now truly silent.
                        event("listening","AI 응답이 중단됐습니다. 다시 말씀해 주세요.");
                    }
                    schedulePlayback();
                });
            }catch(java.util.concurrent.RejectedExecutionException ignored){
                playbackResetPending=false;
            }
        }
    }
    synchronized void stop(){
        if(closed)return;
        closed=true;running=false;
        contractTurnGate.clear();
        if(!quotaConfirmed)reportQuota("abort");
        quotaUpdates.shutdown();
        durationLimit.removeCallbacks(autoStop);
        durationLimit.removeCallbacks(connectionTimeout);
        WebSocket ws=socket;socket=null;
        if(ws!=null)ws.close(1000,"user_closed");
        audioQueue.clear();
        AudioRecord mic=microphone;microphone=null;
        if(mic!=null){try{mic.stop();}catch(Exception ignored){}try{mic.release();}catch(Exception ignored){}}
        AcousticEchoCanceler echo=echoCanceler;echoCanceler=null;
        if(echo!=null){try{echo.release();}catch(Exception ignored){}}
        player.execute(()->{
            AudioTrack t=speaker;speaker=null;
            if(t!=null){try{t.pause();t.flush();}catch(Exception ignored){}t.release();}
        });
        event("ended","음성 대화를 종료했습니다.");
        startup.shutdownNow();player.shutdown();
        if(http!=null)http.dispatcher().executorService().shutdown();
    }
}

