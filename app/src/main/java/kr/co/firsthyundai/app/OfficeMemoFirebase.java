package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.res.AssetManager;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Firebase push transport is optional until Firebase project is configured.
 * Service-account keys remain on the Cloudflare Worker, never in this APK.
 */
final class OfficeMemoFirebase {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static boolean attempted=false,configured=false,serverReady=false;
    private OfficeMemoFirebase(){}

    static synchronized boolean initialize(Context context){
        if(attempted)return configured;
        attempted=true;
        try{
            byte[] bytes;
            try(InputStream input=context.getAssets().open("firebase_public_config.json")){
                bytes=new byte[4096];int n=input.read(bytes);
                if(n<2)return false;
                bytes=java.util.Arrays.copyOf(bytes,n);
            }
            JSONObject config=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
            String id=config.optString("app_id","");
            String key=config.optString("api_key","");
            String project=config.optString("project_id","");
            String sender=config.optString("sender_id","");
            if(!id.matches("1:[0-9]+:android:[0-9a-fA-F]+")||
               !key.matches("AIza[A-Za-z0-9_-]{20,}")||
               !project.matches("[a-zA-Z0-9._-]{3,120}")||
               !sender.matches("[0-9]{5,30}"))return false;
            FirebaseOptions opts=new FirebaseOptions.Builder()
                 .setApplicationId(id).setApiKey(key).setProjectId(project)
                 .setGcmSenderId(sender).build();
            if(FirebaseApp.getApps(context).isEmpty())
                FirebaseApp.initializeApp(context,opts);
            configured=!FirebaseApp.getApps(context).isEmpty();
            return configured;
        }catch(Exception ignored){return false;}
    }

    static boolean available(Context context){return initialize(context);}
    static String status(Context context){
        return !initialize(context)?"not_configured":serverReady?"push_ready":"push_pending";
    }

    static void register(Context context){
        Context app=context.getApplicationContext();
        if(!OfficeBoardClient.enrolled(app)||!initialize(app))return;
        try{
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{
                if(token==null||token.length()<32)return;
                IO.execute(()->{
                    try{
                        org.json.JSONObject result=OfficeBoardClient.registerPush(app,token);
                        serverReady=result.optBoolean("push_available",false);
                    }
                    catch(Exception ignored){} // Retry on app resume / re-enrollment.
                });
            });
        }catch(Exception ignored){}
    }
    static void registerNewToken(Context context,String value){
        if(value==null||value.length()<32)return;
        Context app=context.getApplicationContext();
        IO.execute(()->{
            try{
                org.json.JSONObject result=OfficeBoardClient.registerPush(app,value);
                serverReady=result.optBoolean("push_available",false);
            }
            catch(Exception ignored){}
        });
    }
}
