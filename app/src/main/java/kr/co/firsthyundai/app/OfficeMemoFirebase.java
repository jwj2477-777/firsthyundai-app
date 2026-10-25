package kr.co.firsthyundai.app;

import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** FCM push bootstrap. Private authentication and service account never enter WebView. */
final class OfficeMemoFirebase {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static volatile boolean configured=false,serverReady=false;
    private static long lastAttempt=0L;
    private OfficeMemoFirebase(){}

    private static synchronized boolean initialize(Context context){
        if(configured)return true;
        // Retry later when the Firebase project gets configured on Cloudflare.
        long now=System.currentTimeMillis();
        if(now-lastAttempt<120000L)return false;
        if(!OfficeBoardClient.enrolled(context))return false;
        lastAttempt=now;
        try{
            JSONObject config=null;
            try(InputStream input=context.getAssets().open("firebase_public_config.json")){
                byte[] bytes=new byte[4096];
                int count=input.read(bytes);
                if(count>1)config=new JSONObject(
                    new String(bytes,0,count,StandardCharsets.UTF_8));
            }catch(Exception ignored){}
            if(config==null){
                JSONObject response=OfficeBoardClient.firebasePublicConfig(context);
                config=response.optJSONObject("config");
            }
            if(config==null)return false;
            String id=config.optString("app_id","");
            String key=config.optString("api_key","");
            String project=config.optString("project_id","");
            String sender=config.optString("sender_id","");
            if(!id.matches("1:[0-9]+:android:[0-9a-fA-F]+")||
               !key.matches("AIza[A-Za-z0-9_-]{20,}")||
               !project.matches("[a-zA-Z0-9._-]{3,120}")||
               !sender.matches("[0-9]{5,30}"))return false;
            FirebaseOptions opts=new FirebaseOptions.Builder()
                .setApplicationId(id).setApiKey(key)
                .setProjectId(project).setGcmSenderId(sender).build();
            if(FirebaseApp.getApps(context).isEmpty())
                FirebaseApp.initializeApp(context,opts);
            configured=!FirebaseApp.getApps(context).isEmpty();
            return configured;
        }catch(Exception ignored){return false;}
    }

    static String status(Context context){
        return !configured?"not_configured":serverReady?"push_ready":"push_pending";
    }
    static void register(Context context){
        final Context app=context.getApplicationContext();
        if(!OfficeBoardClient.enrolled(app))return;
        IO.execute(()->{
            if(!initialize(app))return;
            try{
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{
                    if(token==null||token.length()<32)return;
                    registerNewToken(app,token);
                });
            }catch(Exception ignored){}
        });
    }
    static void registerNewToken(Context context,String token){
        if(token==null||token.length()<32)return;
        Context app=context.getApplicationContext();
        IO.execute(()->{
            try{
                JSONObject record=OfficeBoardClient.registerPush(app,token);
                serverReady=record.optBoolean("push_available",false);
            }catch(Exception ignored){}
        });
    }
}
