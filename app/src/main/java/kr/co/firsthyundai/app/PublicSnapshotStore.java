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
 * Last-verified *public* real-estate reference feeds for internet outages.
 * Never accepts private notes, account information, banking details or API keys.
 * No cloud write; exact repository and filename checks prevent cross-feed mixing.
 * App-private no-backup storage and AtomicFile preserve older good data on errors.
 */
final class PublicSnapshotStore {
    static final int MAX_BYTES=8*1024*1024;
    private static final String ROOT_REPO="jwj2477-777/firsthyundai-app";
    private static final String[] FILES={
        "trades.json","new_trades.json","complexes.json","news.json",
        "public_services.json","school_districts.json",
        "maintenance_estimates.json","maintenance_partial.json",
        "nearby_config.json"
    };
    private PublicSnapshotStore(){}
    static boolean permitted(String repo,String name){
        // Only trusted, curated public datasets. The optional admin-provided
        // repositories are deliberately not placed into this emergency cache.
        if(!ROOT_REPO.equals(repo))return false;
        for(String file:FILES)if(file.equals(name))return true;
        return false;
    }
    static boolean valid(String filename,JSONObject doc){
        if(doc==null||doc.optInt("schema_version")!=1)return false;
        if("trades.json".equals(filename)||"new_trades.json".equals(filename)||
           "complexes.json".equals(filename))return doc.optJSONArray("records")!=null;
        if("news.json".equals(filename))return doc.optJSONArray("briefs")!=null;
        if("public_services.json".equals(filename))
            return doc.optJSONObject("schools")!=null&&doc.optJSONObject("office_rents")!=null;
        if("school_districts.json".equals(filename))
            return doc.optJSONObject("elementary_zones")!=null&&doc.optJSONObject("schoolinfo")!=null;
        if("maintenance_estimates.json".equals(filename)||
           "maintenance_partial.json".equals(filename))
            return doc.optJSONArray("records")!=null;
        if("nearby_config.json".equals(filename))return true;
        return false;
    }
    private static AtomicFile target(Context ctx,String repo,String filename)throws Exception {
        MessageDigest md=MessageDigest.getInstance("SHA-256");
        byte[] bytes=md.digest((repo+"/"+filename).getBytes(StandardCharsets.UTF_8));
        StringBuilder id=new StringBuilder();
        for(int i=0;i<12;i++)id.append(String.format(java.util.Locale.ROOT,"%02x",bytes[i]&255));
        return new AtomicFile(new File(ctx.getNoBackupFilesDir(),
             "fhd-public-snapshot-"+id+".json"));
    }
    static synchronized boolean save(Context ctx,String repo,String filename,JSONObject payload){
        if(!permitted(repo,filename)||!valid(filename,payload))return false;
        AtomicFile store=null;FileOutputStream out=null;
        try{
            JSONObject entry=new JSONObject().put("schema",1)
                .put("repo",repo).put("filename",filename)
                .put("cachedAt",System.currentTimeMillis()).put("payload",payload);
            byte[] data=entry.toString().getBytes(StandardCharsets.UTF_8);
            if(data.length>MAX_BYTES)return false;
            store=target(ctx,repo,filename);
            out=store.startWrite();out.write(data);
            store.finishWrite(out);return true;
        }catch(Exception ignored){
            if(store!=null&&out!=null)store.failWrite(out);
            return false;
        }
    }
    static synchronized JSONObject read(Context ctx,String repo,String filename){
        if(!permitted(repo,filename))return null;
        try(InputStream in=target(ctx,repo,filename).openRead();
            ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192];int n;
            while((n=in.read(buf))!=-1){
                output.write(buf,0,n);
                if(output.size()>MAX_BYTES)return null;
            }
            JSONObject doc=new JSONObject(output.toString("UTF-8"));
            if(doc.optInt("schema")!=1||!repo.equals(doc.optString("repo"))||
               !filename.equals(doc.optString("filename")))return null;
            long timestamp=doc.optLong("cachedAt",0L);
            if(timestamp<=0||timestamp>System.currentTimeMillis()+5*60000L)return null;
            if(!valid(filename,doc.optJSONObject("payload")))return null;
            return doc;
        }catch(Exception ignored){return null;}
    }
}
