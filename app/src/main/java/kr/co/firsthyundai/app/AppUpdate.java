package kr.co.firsthyundai.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Fresh, pinned release feeds; a valid APK is required for every version result. */
public final class AppUpdate {
    private static final String OWNER="jwj2477-777/firsthyundai-app";
    private static final String API="https://api.github.com/repos/"+OWNER+"/releases/latest";
    private AppUpdate(){}

    static int compareVersion(String candidate,String installed){
        if(!candidate.matches("[0-9]{1,3}(\\.[0-9]{1,3}){2}"))return -1;
        if(!installed.matches("[0-9]{1,3}(\\.[0-9]{1,3}){2}"))return -1;
        String[] a=candidate.split("\\."), b=installed.split("\\.");
        for(int i=0;i<3;i++){
            int diff=Integer.compare(Integer.parseInt(a[i]),Integer.parseInt(b[i]));
            if(diff!=0)return diff;
        }
        return 0;
    }
    static boolean allowedDownload(String url){
        if(url==null||url.length()>210)return false;
        if(!url.matches("^https://github[.]com/jwj2477-777/firsthyundai-app/releases/download/v([0-9]{1,3}[.]){2}[0-9]{1,3}/FirstHyundai-v([0-9]{1,3}[.]){2}[0-9]{1,3}[.]apk$"))return false;
        String version=url.substring(url.indexOf("/download/v")+11,url.indexOf("/FirstHyundai-v"));
        String fileVersion=url.substring(url.indexOf("/FirstHyundai-v")+15,url.length()-4);
        return version.equals(fileVersion);
    }

    static JSONObject readRelease(String payload,String installed){
        JSONObject result=new JSONObject();
        try{
            JSONObject release=new JSONObject(payload);
            if(release.optBoolean("draft",false)||release.optBoolean("prerelease",false)
                ||installed==null||!installed.matches("[0-9]{1,3}(\\.[0-9]{1,3}){2}"))
                throw new IllegalArgumentException("Not a stable installed/release version");
            String tag=release.optString("tag_name","");
            if(!tag.matches("v[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"))
                throw new IllegalArgumentException("Invalid release tag");
            String version=tag.substring(1);
            String expected="FirstHyundai-"+tag+".apk";
            String expectedUrl="https://github.com/"+OWNER+"/releases/download/"+tag+"/"+expected;
            JSONArray assets=release.optJSONArray("assets");
            boolean matched=false;
            if(assets!=null)for(int i=0;i<assets.length();i++){
                JSONObject asset=assets.optJSONObject(i);
                if(asset!=null&&expected.equals(asset.optString("name",""))
                    &&expectedUrl.equals(asset.optString("browser_download_url",""))
                    &&asset.optLong("size",0)>100000L
                    &&asset.optLong("size",0)<=80L*1024*1024){matched=true;break;}
            }
            if(!matched||!allowedDownload(expectedUrl))
                throw new IllegalArgumentException("No verified APK asset");
            int comparison=compareVersion(version,installed);
            result.put("newVersion",version);
            result.put("state",comparison>0?"available":comparison==0?"latest":"stale");
            result.put("available",comparison>0);
            if(comparison>0)result.put("downloadUrl",expectedUrl);
        }catch(Exception ex){
            try{result.put("state","error");result.put("available",false);}
            catch(Exception ignored){}
        }
        return result;
    }
    private static final String FALLBACK="https://raw.githubusercontent.com/"
        +OWNER+"/main/data/app_latest.json";

    static String freshUrl(String address){
        return address+"?check="+UUID.randomUUID().toString();
    }

    static JSONObject selectRelease(JSONObject primary,JSONObject secondary){
        JSONObject best=null;
        for(JSONObject candidate:new JSONObject[]{primary,secondary}){
            if(candidate==null)continue;
            String state=candidate.optString("state","");
            if(!"available".equals(state)&&!"latest".equals(state)&&!"stale".equals(state))continue;
            if(best==null||compareVersion(candidate.optString("newVersion"),best.optString("newVersion"))>0)
                best=candidate;
        }
        if(best!=null&&!"stale".equals(best.optString("state")))return best;
        JSONObject unavailable=new JSONObject();
        try{
            unavailable.put("state",best==null?"unavailable":"stale");
            unavailable.put("available",false);
            unavailable.put("fallbackUrl","https://github.com/"+OWNER+"/releases/latest");
        }catch(Exception ignored){}
        return unavailable;
    }

    /** The fallback uses the same strict tag, APK filename, URL and size validation.
     * A public JSON file is only a release *locator*: actual downloaded APKs still
     * require package name, higher build number and installed signing certificate.
     */
    private static String fetch(String address,int limit) throws Exception {
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(freshUrl(address)).openConnection();
            c.setRequestProperty("Accept","application/vnd.github+json");
            c.setRequestProperty("User-Agent","FirstHyundaiAndroidUpdate/2.0");
            c.setRequestProperty("Cache-Control","no-cache, no-store, max-age=0");
            c.setRequestProperty("Pragma","no-cache");
            c.setConnectTimeout(8000);c.setReadTimeout(9000);c.setUseCaches(false);
            if(c.getResponseCode()!=200)
                throw new IllegalStateException("Unable to reach update origin");
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){
                byte[] buffer=new byte[4096];int n;
                while((n=in.read(buffer))!=-1){
                    if(out.size()+n>limit)throw new IllegalArgumentException("Oversized update feed");
                    out.write(buffer,0,n);
                }
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }finally{if(c!=null)c.disconnect();}
    }

    public static JSONObject check(Context ctx){
        String installed=AppVersion.name(ctx);
        JSONObject primary=null,secondary=null;
        try {
            primary=readRelease(fetch(API,200000),installed);
        } catch(Exception ignored) { /* Try the pinned raw release index. */ }
        // Some phone networks block or rate-limit api.github.com while GitHub
        // raw snapshot data still works. Also handle temporarily stale API cache.
        try {
            secondary=readRelease(fetch(FALLBACK,16000),installed);
        } catch(Exception ignored) { /* Preserve the valid primary result below. */ }
        return selectRelease(primary,secondary);
    }
}
