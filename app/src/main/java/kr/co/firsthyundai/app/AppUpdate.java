package kr.co.firsthyundai.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Pinned public GitHub release feed, strictly checks tag+APK name before opening a browser. */
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
        java.util.regex.Matcher matcher=java.util.regex.Pattern.compile(
            "^https://github\\\\.com/jwj2477-777/firsthyundai-app/releases/download/v([0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3})/FirstHyundai-v([0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3})\\\\.apk$"
        ).matcher(url);
        return matcher.matches()&&matcher.group(1).equals(matcher.group(2));
    }

    static JSONObject readRelease(String payload,String installed){
        JSONObject result=new JSONObject();
        try{
            JSONObject release=new JSONObject(payload);
            String tag=release.optString("tag_name","");
            if(!tag.matches("v[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"))
                throw new IllegalArgumentException("Invalid release tag");
            String version=tag.substring(1);
            result.put("newVersion",version);
            if(compareVersion(version,installed)<=0){
                result.put("state","latest");result.put("available",false);
                return result;
            }
            String expected="FirstHyundai-"+tag+".apk";
            String expectedUrl="https://github.com/"+OWNER+"/releases/download/"+tag+"/"+expected;
            JSONArray assets=release.optJSONArray("assets");
            boolean matched=false;
            if(assets!=null)for(int i=0;i<assets.length();i++){
                JSONObject asset=assets.optJSONObject(i);
                if(asset!=null&&expected.equals(asset.optString("name",""))
                    &&expectedUrl.equals(asset.optString("browser_download_url",""))
                    &&asset.optLong("size",0)>100000L){matched=true;break;}
            }
            if(!matched||!allowedDownload(expectedUrl))
                throw new IllegalArgumentException("No verified APK asset");
            result.put("state","available");result.put("available",true);
            result.put("downloadUrl",expectedUrl);
        }catch(Exception ex){
            try{result.put("state","error");result.put("available",false);}
            catch(Exception ignored){}
        }
        return result;
    }
    public static JSONObject check(Context ctx){
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(API).openConnection();
            c.setRequestProperty("Accept","application/vnd.github+json");
            c.setRequestProperty("User-Agent","FirstHyundaiAndroidUpdate/1.0");
            c.setConnectTimeout(8000);c.setReadTimeout(9000);c.setUseCaches(false);
            if(c.getResponseCode()!=200)throw new IllegalStateException("Release service unavailable");
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){
                byte[] buffer=new byte[4096];int n;
                while((n=in.read(buffer))!=-1){
                    if(out.size()+n>200000)throw new IllegalArgumentException("Oversized release response");
                    out.write(buffer,0,n);
                }
            }
            return readRelease(out.toString(StandardCharsets.UTF_8.name()),AppVersion.name(ctx));
        }catch(Exception ex){
            JSONObject result=new JSONObject();
            try{result.put("state","offline");result.put("available",false);}catch(Exception ignored){}
            return result;
        }finally{if(c!=null)c.disconnect();}
    }
}
