package kr.co.firsthyundai.app;

import android.content.Context;
import android.util.AtomicFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Public KMA forecast. Kept only as a dated reference when internet is down.
 * The UI MUST never interpret an outdated forecast as a verified dry period. */
final class WeatherOfflineStore {
    private static final int LIMIT=250000;
    private WeatherOfflineStore(){}
    private static AtomicFile file(Context ctx){
        return new AtomicFile(new File(ctx.getNoBackupFilesDir(),"fhd-weather-last-known.json"));
    }
    private static boolean valid(JSONObject payload){
        return payload!=null&&payload.optInt("schema")==1&&
          "ok".equals(payload.optString("status"))&&
          payload.optJSONArray("hours")!=null&&payload.optJSONArray("hours").length()>0&&
          payload.optJSONArray("hours").length()<=144&&
          !payload.optString("issued_at","").isEmpty();
    }
    static synchronized boolean save(Context context,JSONObject forecast){
        if(!valid(forecast))return false;
        AtomicFile target=file(context);FileOutputStream out=null;
        try{
            JSONObject envelope=new JSONObject().put("schema",1)
               .put("cachedAt",System.currentTimeMillis()).put("forecast",forecast);
            byte[] bytes=envelope.toString().getBytes(StandardCharsets.UTF_8);
            if(bytes.length>LIMIT)return false;
            out=target.startWrite();out.write(bytes);target.finishWrite(out);
            return true;
        }catch(Exception ignored){
            if(out!=null)target.failWrite(out);
            return false;
        }
    }
    static synchronized JSONObject read(Context context){
        try(InputStream in=file(context).openRead();
            ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
            byte[] block=new byte[4096];int n;
            while((n=in.read(block))!=-1){
                buffer.write(block,0,n);
                if(buffer.size()>LIMIT)return null;
            }
            JSONObject saved=new JSONObject(buffer.toString("UTF-8"));
            if(saved.optInt("schema")!=1||saved.optLong("cachedAt",0)<=0||
               saved.optLong("cachedAt",0)>System.currentTimeMillis()+300000L||
               !valid(saved.optJSONObject("forecast")))return null;
            return saved;
        }catch(Exception ignored){return null;}
    }
}
