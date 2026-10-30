package kr.co.firsthyundai.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
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
    private volatile int audioGeneration=0;
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
                            setup.put("inputAudioTranscription",new JSONObject());
                            setup.put("outputAudioTranscription",new JSONObject());
                            if(contractMode){
                                setup.put("systemInstruction",new JSONObject().put("parts",new JSONArray().put(
                                    new JSONObject().put("text",ContractLiveProtocol.prompt()))));
                                setup.put("tools",ContractLiveProtocol.tools());
                            }
                            ws.send(new JSONObject().put("setup",setup).toString());
                            event("connected","Google 서버에 연결됐습니다. 음성 사용 준비를 확인하고 있습니다.");
                            durationLimit.postDelayed(autoStop,7*60*1000L);
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
                                durationLimit.removeCallbacks(connectionTimeout);
                                if(startMicrophone()&&running){
                                    quotaConfirmed=true;
                                    reportQuota("ready");
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
                                audioGeneration++;
                                AudioTrack t=speaker;
                                if(t!=null){try{t.pause();t.flush();t.play();}catch(Exception ignored){}}
                            }
                            JSONObject transcript=content.optJSONObject("outputTranscription");
                            if(transcript!=null){
                                String t=transcript.optString("text","");
                                if(!t.isEmpty())event("transcript",t.substring(0,Math.min(280,t.length())));
                            }
                            JSONObject user=content.optJSONObject("inputTranscription");
                            if(user!=null){
                                String t=user.optString("text","");
                                if(!t.isEmpty())event("heard",t.substring(0,Math.min(200,t.length())));
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
                                if(pcm.length>0&&pcm.length<=100000)play(pcm);
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
                    try{
                        JSONObject proposal=ContractLiveProtocol.validated(fc.optJSONObject("args"));
                        try{
                            ContractLiveProtocol.validateConsistency(proposedConditions,proposal);
                            if(running){
                                java.util.Iterator<String> keys=proposal.keys();
                                while(keys.hasNext()){String key=keys.next();proposedConditions.put(key,proposal.get(key));}
                                event("proposal",proposal.toString());
                                result="proposed_for_user_review";
                            }
                        }catch(Exception conflict){result="rejected_inconsistent_conditions";}
                    }catch(Exception ignored){}
                }
                // Only fixed acknowledgements leave the device; no existing form or previous values.
                responses.put(new JSONObject().put("id",fc.optString("id"))
                    .put("name",fc.optString("name"))
                    .put("response",new JSONObject().put("result",result)));
            }
            if(running)ws.send(new JSONObject().put("toolResponse",new JSONObject().put("functionResponses",responses)).toString());
        }catch(Exception ignored){}
    }
    private synchronized boolean startMicrophone(){
        if(!running)return false;
        try{
            final int minimum=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
            if(minimum<=0)throw new Exception("audio unavailable");
            AudioRecord recorder=new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum,6400));
            if(recorder.getState()!=AudioRecord.STATE_INITIALIZED){
                recorder.release();throw new Exception("audio init unavailable");
            }
            microphone=recorder;recorder.startRecording();
            event("listening",contractMode?"계약 조건을 말씀하세요. 이름·주소·계좌는 말하지 마세요.":"말씀하세요. 공개된 뉴스에 대해서만 질문해 주세요.");
            Thread reader=new Thread(()->{
                byte[] samples=new byte[3200];
                while(running&&microphone==recorder){
                    int n;
                    try{n=recorder.read(samples,0,samples.length);}catch(Exception e){break;}
                    if(!running||microphone!=recorder)break;
                    if(n<=0)continue;
                    WebSocket ws=socket;
                    if(ws==null||ws.queueSize()>256000)continue;
                    try{
                        String payload=Base64.encodeToString(samples,0,n,Base64.NO_WRAP);
                        ws.send(new JSONObject().put("realtimeInput",new JSONObject().put("audio",
                             new JSONObject().put("data",payload).put("mimeType","audio/pcm;rate=16000"))).toString());
                    }catch(Exception ignored){}
                }
            },"fhd-live-voice-capture");
            reader.setDaemon(true);reader.start();
            return true;
        }catch(Exception e){
            event("error","음성을 시작할 수 없습니다. 마이크 권한을 확인해 주세요.");
            stop();
            return false;
        }
    }
    private void play(byte[] pcm){
        final int generation=audioGeneration;
        if(!running||player.isShutdown())return;
        player.execute(()->{
            if(!running||generation!=audioGeneration)return;
            try{
                if(speaker==null){
                    int min=AudioTrack.getMinBufferSize(24000,AudioFormat.CHANNEL_OUT_MONO,
                                      AudioFormat.ENCODING_PCM_16BIT);
                    if(min<=0)return;
                    AudioTrack track=new AudioTrack(AudioManager.STREAM_MUSIC,24000,
                        AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT,
                        Math.max(min,9600),AudioTrack.MODE_STREAM);
                    if(track.getState()!=AudioTrack.STATE_INITIALIZED){track.release();return;}
                    speaker=track;track.play();
                }
                speaker.write(pcm,0,pcm.length);
            }catch(Exception ignored){}
        });
    }
    synchronized void stop(){
        if(closed)return;
        closed=true;running=false;
        if(!quotaConfirmed)reportQuota("abort");
        quotaUpdates.shutdown();
        durationLimit.removeCallbacks(autoStop);
        durationLimit.removeCallbacks(connectionTimeout);
        WebSocket ws=socket;socket=null;
        if(ws!=null)ws.close(1000,"user_closed");
        AudioRecord mic=microphone;microphone=null;
        if(mic!=null){try{mic.stop();}catch(Exception ignored){}try{mic.release();}catch(Exception ignored){}}
        player.execute(()->{
            AudioTrack t=speaker;speaker=null;
            if(t!=null){try{t.pause();t.flush();}catch(Exception ignored){}t.release();}
        });
        event("ended","음성 대화를 종료했습니다.");
        startup.shutdownNow();player.shutdown();
        if(http!=null)http.dispatcher().executorService().shutdown();
    }
}

