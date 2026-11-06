package kr.co.firsthyundai.app;

import android.content.Context;
import android.util.AtomicFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/**
 * Last-known-good public feeds for emergency office use.
 *
 * Deliberately stores ONLY approved public GitHub JSON; private office memos,
 * contracts, credentials and personal data must never pass through this class.
 * An atomic replacement preserves an earlier valid snapshot on failed refresh.
 */
final class PublicOfflineCache {
    private static final int MAX_BYTES=8*1024*1024;
    private static final String FILES="|trades.json|new_trades.json|news.json|complexes.json|"+
        "school_districts.json|maintenance_estimates.json|maintenance_partial.json|"+
        "public_services.json|";
    private PublicOfflineCache(){}

    static boolean allowed(String repository,String filename){
        return repository!=null&&repository.matches("[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.-]{1,100}")&&
            filename!=null&&FILES.contains("|"+filename+"|")&&
            filename.matches("[a-z_]{3,30}\\.json");
    }
    private static File path(Context context,String repository,String filename)throws Exception{
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(
            (repository+"|"+filename).getBytes(StandardCharsets.UTF_8));
        StringBuilder key=new StringBuilder();
        for(int i=0;i<16;i++)key.append(String.format(java.util.Locale.ROOT,"%02x",digest[i]&0xff));
        return new File(context.getNoBackupFilesDir(),"public-feed-v1-"+key+".json");
    }
    private static boolean valid(String filename,JSONObject doc){
        if(doc==null||doc.optInt("schema_version",-1)!=1)return false;
        if(("trades.json".equals(filename)||"new_trades.json".equals(filename)||
            "complexes.json".equals(filename))&&!doc.has("records"))return false;
        if("news.json".equals(filename)&&!doc.has("briefs"))return false;
        if("public_services.json".equals(filename)&&(!doc.has("schools")||!doc.has("office_rents")))return false;
        return true;
    }
    static boolean save(Context context,String repository,String filename,JSONObject payload){
        if(!allowed(repository,filename)||!valid(filename,payload))return false;
        AtomicFile file=null;
        FileOutputStream out=null;
        try{
            JSONObject data=new JSONObject().put("schema",1)
                .put("repository",repository).put("filename",filename)
                .put("savedAt",System.currentTimeMillis()).put("payload",payload);
            byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);
            if(bytes.length>MAX_BYTES)return false;
            file=new AtomicFile(path(context,repository,filename));
            out=file.startWrite();
            out.write(bytes);
            file.finishWrite(out);
            return true;
        }catch(Exception ignored){
            if(out!=null&&file!=null)file.failWrite(out);
            return false;
        }
    }
    static JSONObject read(Context context,String repository,String filename){
        if(!allowed(repository,filename))return null;
        try(InputStream in=new AtomicFile(path(context,repository,filename)).openRead();
            ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
            byte[] chunk=new byte[16384];
            int count;
            while((count=in.read(chunk))!=-1){
                buffer.write(chunk,0,count);
                if(buffer.size()>MAX_BYTES)return null;
            }
            JSONObject result=new JSONObject(buffer.toString("UTF-8"));
            if(result.optInt("schema")!=1||result.optLong("savedAt",0)<=0||
                !repository.equals(result.optString("repository"))||
                !filename.equals(result.optString("filename"))||
                !valid(filename,result.optJSONObject("payload")))return null;
            return result;
        }catch(Exception ignored){return null;}
    }
}
