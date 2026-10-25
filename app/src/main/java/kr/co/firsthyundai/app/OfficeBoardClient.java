package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Private access-code authenticated office note exchange. Token never enters WebView. */
final class OfficeBoardClient {
    private static final String URL_ROOT="https://firsthyundai-shared-settings.jwj2477.workers.dev";
    private static final String PREF="firsthyundai-private-office-board-v1";
    private static final long VALIDITY_MS=60L*24*60*60*1000;
    static void clear(Context context){
        context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().clear().apply();
    }
    private static String token(Context context){
        SharedPreferences pref=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        long expiry=pref.getLong("expiry",0);
        if(System.currentTimeMillis()>expiry)return "";
        return pref.getString("token","");
    }
    static boolean enrolled(Context context){return !token(context).isEmpty();}
    static void enroll(Context context,char[] code) throws Exception{
        if(code==null||code.length<8||code.length>64)throw new Exception("사무실 보안코드를 확인해 주세요.");
        JSONObject body=new JSONObject().put("code",new String(code));
        JSONObject data=request("POST","/board/session",body,null);
        String token=data.optString("token","");
        if(token.length()<40||token.length()>1100)throw new Exception("보안 인증 응답이 올바르지 않습니다.");
        long now=System.currentTimeMillis();
        context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
            .putString("token",token).putLong("expiry",now+VALIDITY_MS-300_000L).apply();
    }
    static JSONObject perform(Context context,String action,JSONObject payload) throws Exception {
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("최초 한 번 사무실 보안코드 인증이 필요합니다.");
        if("list".equals(action))return request("GET","/board",null,auth);
        if("post".equals(action)){
            String text=payload.optString("text","");
            if(text.isEmpty()||text.length()>1600)throw new Exception("메모 내용은 1~1600자로 적어 주세요.");
            return request("POST","/board",new JSONObject().put("text",text),auth);
        }
        String id=payload.optString("id","");
        if(!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))throw new Exception("메모 번호가 올바르지 않습니다.");
        if("delete".equals(action))return request("DELETE","/board/"+id,null,auth);
        if("edit".equals(action)){
            String text=payload.optString("text","");
            if(text.isEmpty()||text.length()>1600)throw new Exception("메모 내용은 1~1600자로 적어 주세요.");
            return request("PATCH","/board/"+id,new JSONObject().put("text",text),auth);
        }
        if("done".equals(action)){
            if(!payload.has("done")||!(payload.opt("done") instanceof Boolean))throw new Exception("완료 표시 값이 올바르지 않습니다.");
            return request("PATCH","/board/"+id,new JSONObject().put("done",payload.getBoolean("done")),auth);
        }
        throw new Exception("지원하지 않는 게시판 작업입니다.");
    }
    private static JSONObject request(String method,String path,JSONObject body,String token) throws Exception {
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL(URL_ROOT+path).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(9000);
            connection.setReadTimeout(9000);
            connection.setRequestMethod(method);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Cache-Control","no-store");
            connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 17; FirstHyundaiOfficeBoard/1.0)");
            if(token!=null)connection.setRequestProperty("Authorization","Bearer "+token);
            if(body!=null){
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
                if(bytes.length>3600)throw new Exception("메모 크기가 너무 큽니다.");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
                try(OutputStream out=connection.getOutputStream()){out.write(bytes);}
            }
            int status=connection.getResponseCode();
            InputStream stream=status>=200&&status<300?connection.getInputStream():connection.getErrorStream();
            if(stream==null)throw new Exception("사무실 게시판 연결 오류");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=stream){
                byte[] temp=new byte[1024];int n;
                while((n=input.read(temp))!=-1){
                    bytes.write(temp,0,n);
                    if(bytes.size()>250000)throw new Exception("게시판 응답이 너무 큽니다.");
                }
            }
            if(status==401)throw new Exception("게시판 보안 인증 만료 · 다시 인증해 주세요.");
            if(status<200||status>=300)throw new Exception("게시판 서버에 연결할 수 없습니다. HTTP "+status);
            return new JSONObject(bytes.toString("UTF-8"));
        }finally{if(connection!=null)connection.disconnect();}
    }
    private OfficeBoardClient(){}
}
