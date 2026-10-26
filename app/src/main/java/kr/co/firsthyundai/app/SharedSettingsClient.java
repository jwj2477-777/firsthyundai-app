package kr.co.firsthyundai.app;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
/** Native-only shared settings authentication, no credential delivered to JS. */
final class SharedSettingsClient {
    static final String BASE="https://firsthyundai-shared-settings.jwj2477.workers.dev";
    private static JSONObject call(String method,String endpoint,JSONObject data,String session) throws Exception {
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL(BASE+endpoint).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(9000);
            connection.setReadTimeout(9000);
            connection.setUseCaches(false);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 17; FirstHyundai/2.0)");
            connection.setRequestProperty("Cache-Control","no-store");
            if(session!=null&&!session.isEmpty())connection.setRequestProperty("Authorization","Bearer "+session);
            if(data!=null){
                byte[] body=data.toString().getBytes(StandardCharsets.UTF_8);
                if(body.length>2400)throw new Exception("공통 설정 크기 제한 초과");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
                try(OutputStream out=connection.getOutputStream()){out.write(body);}
            }
            int status=connection.getResponseCode();
            InputStream response=status>=200&&status<300?connection.getInputStream():connection.getErrorStream();
            if(response==null)throw new Exception("공통 설정 서버 응답 없음");
            ByteArrayOutputStream result=new ByteArrayOutputStream();
            try(InputStream stream=response){
                byte[] chunk=new byte[1024];int n;
                while((n=stream.read(chunk))!=-1){
                    result.write(chunk,0,n);
                    if(result.size()>5000)throw new Exception("서버 응답 용량 제한 초과");
                }
            }
            if(status<200||status>=300)throw new Exception(status==401?
                "공통 설정 게시 인증 만료 · 관리자모드를 다시 인증해 주세요.":
                "공통 설정 서버 오류 (HTTP "+status+")");
            return new JSONObject(result.toString("UTF-8"));
        }finally {if(connection!=null)connection.disconnect();}
    }
    static String authorize(char[] code) throws Exception {
        // A short-lived string exists only during the HTTPS login exchange.
        JSONObject body=new JSONObject().put("code",new String(code));
        JSONObject reply=call("POST","/session",body,null);
        String token=reply.optString("token","");
        if(token.length()<60||token.length()>1100)throw new Exception("공통 설정 인증 세션 형식 오류");
        return token;
    }
    static JSONObject readWeather() throws Exception {return call("GET","/theme-weather",null,null);}
    static JSONObject read() throws Exception {return call("GET","/settings",null,null);}
    static JSONObject publish(String token,String json) throws Exception {
        if(token==null||token.isEmpty())throw new Exception("공통 설정 게시 인증이 필요합니다. 관리자모드에 다시 로그인해 주세요.");
        if(json==null||json.length()>2400)throw new Exception("공통 설정 데이터 형식 오류");
        return call("PUT","/settings",new JSONObject(json),token);
    }
    private SharedSettingsClient(){}
}

