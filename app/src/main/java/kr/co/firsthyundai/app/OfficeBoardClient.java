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
import java.security.SecureRandom;

/** Private access-code authenticated office note exchange. Token never enters WebView. */
final class OfficeBoardClient {
    private static final String URL_ROOT="https://firsthyundai-shared-settings.jwj2477.workers.dev";
    private static final String PREF="firsthyundai-private-office-board-v1";
    private static final long VALIDITY_MS=60L*24*60*60*1000;
    static void clear(Context context){
        // Do not clear the stable device ID; revoked devices must not silently rejoin.
        SharedPreferences p=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        p.edit().remove("token").remove("expiry").remove("member_id").remove("member_name").apply();
    }
    static String memberName(Context c){
        return c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString("member_name","");
    }
    static String memberId(Context c){
        return c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString("member_id","");
    }
    // One-time update migration: show existing users the newly-added three-account picker.
    // Unlike token / device ID this local UI acknowledgement contains no security state.
    static boolean pickerReviewed(Context c){
        return c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getBoolean("picker_reviewed_v209",false);
    }
    static void markPickerReviewed(Context c){
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
            .putBoolean("picker_reviewed_v209",true).apply();
    }
    static boolean pickerReviewedV210(Context c){
        return c.getSharedPreferences(PREF,Context.MODE_PRIVATE)
            .getBoolean("password_then_member_v210",false);
    }
    static void markPickerReviewedV210(Context c){
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
            .putBoolean("password_then_member_v210",true).apply();
    }
    static JSONObject memberChoices(Context c) throws Exception{
        String auth=token(c);
        if(auth.isEmpty())throw new Exception("사무실 계정 인증이 필요합니다.");
        return request("GET","/board/accounts",null,auth);
    }
    private static String token(Context context){
        SharedPreferences pref=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        long expiry=pref.getLong("expiry",0);
        if(System.currentTimeMillis()>expiry)return "";
        return pref.getString("token","");
    }
    static boolean enrolled(Context context){return !token(context).isEmpty()&&!memberId(context).isEmpty();}
    static JSONObject checkAccount(Context context) throws Exception {
        if(!enrolled(context))throw new Exception("사무실 계정 연결이 필요합니다.");
        try{
            JSONObject result=request("GET","/board/account",null,token(context));
            JSONObject member=result.optJSONObject("member");
            if(member!=null&&memberId(context).equals(member.optString("id",""))){
                String name=member.optString("name","");
                if(!name.isEmpty()&&!name.equals(memberName(context)))
                    context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
                        .putString("member_name",name).apply();
            }
            return result;
        }
        catch(Exception e){
            if(e.getMessage()!=null&&e.getMessage().startsWith("account_revoked"))clear(context);
            throw e;
        }
    }
    static JSONObject choices(Context context,char[] code) throws Exception {
        if(code==null||code.length<8||code.length>64)throw new Exception("사무실 보안코드를 확인해 주세요.");
        return request("POST","/board/choices",new JSONObject().put("code",new String(code)),null);
    }
    static String deviceId(Context context){
        SharedPreferences pref=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String id=pref.getString("device_id","");
        if(id.matches("[a-f0-9]{32}"))return id;
        byte[] data=new byte[16];new SecureRandom().nextBytes(data);
        StringBuilder sb=new StringBuilder(32);
        for(byte b:data)sb.append(String.format(java.util.Locale.ROOT,"%02x",b&0xff));
        id=sb.toString();
        pref.edit().putString("device_id",id).apply();return id;
    }
    static JSONObject registerPush(Context context,String fcm) throws Exception {
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 메모 보안 인증 필요");
        if(fcm==null||fcm.length()<32||fcm.length()>4096||
            !fcm.matches("[A-Za-z0-9_:.~-]+"))throw new Exception("기기 알림 토큰 오류");
        return request("POST","/board/push/register",
            new JSONObject().put("device",deviceId(context)).put("fcm",fcm),auth);
    }
    static JSONObject firebasePublicConfig(Context context) throws Exception {
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 메모 보안 인증 필요");
        return request("GET","/board/push/config",null,auth);
    }
    static JSONObject pushAvailability(Context context) throws Exception{
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 메모 보안 인증 필요");
        return request("GET","/board/push/status",null,auth);
    }
    static JSONObject preview(Context context,String noteId) throws Exception {
        if(noteId==null||!noteId.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
            throw new Exception("invalid_note_id");
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 메모 인증이 필요합니다.");
        return request("GET","/board/"+noteId+"/preview",null,auth);
    }
    static JSONObject activity(Context context) throws Exception {
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 보안 인증 필요");
        return request("GET","/board/updates",null,auth);
    }
    static void enroll(Context context,char[] code,String memberId) throws Exception{
        if(code==null||code.length<8||code.length>64)throw new Exception("사무실 보안코드를 확인해 주세요.");
        if(memberId==null||!memberId.matches("[0-9a-f-]{36}"))throw new Exception("사용자 계정을 선택해 주세요.");
        String existing=token(context);
        boolean changing=!existing.isEmpty()&&!memberId.equals(memberId(context));
        JSONObject body=new JSONObject().put("code",new String(code))
                .put("member_id",memberId).put("device",deviceId(context))
                .put("reassign",changing);
        JSONObject data=request("POST","/board/session",body,changing?existing:null);
        String token=data.optString("token","");
        if(token.length()<40||token.length()>1100)throw new Exception("보안 인증 응답이 올바르지 않습니다.");
        JSONObject member=data.optJSONObject("member");
        if(member==null||!memberId.equals(member.optString("id",""))||member.optString("name","").isEmpty())
            throw new Exception("계정 인증 응답이 올바르지 않습니다.");
        long now=System.currentTimeMillis();
        context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
            .putString("token",token).putString("member_id",memberId)
            .putString("member_name",member.optString("name"))
            .putLong("expiry",now+VALIDITY_MS-300_000L)
            .putBoolean("picker_reviewed_v209",true)
            .putBoolean("password_then_member_v210",true).apply();
    }
    static JSONObject members(Context context,String action,JSONObject payload,String adminToken) throws Exception {
        if(adminToken==null||adminToken.isEmpty())throw new Exception("관리자 모드 인증이 필요합니다.");
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("사무실 계정 인증이 필요합니다.");
        if("list".equals(action))return request("GET","/board/members",null,auth,adminToken);
        if("add".equals(action))return request("POST","/board/members",
                new JSONObject().put("name",payload.optString("name","")),auth,adminToken);
        if("rename".equals(action)){
            String id=payload.optString("id","");
            String name=payload.optString("name","").trim();
            if(!id.matches("[0-9a-f-]{36}")||name.isEmpty()||name.length()>24)
                throw new Exception("계정 이름이나 계정 번호를 확인해 주세요.");
            JSONObject result=request("PATCH","/board/members/"+id+"/rename",
                new JSONObject().put("name",name),auth,adminToken);
            JSONObject renamed=result.optJSONObject("account");
            if(renamed!=null&&memberId(context).equals(id)){
                context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
                    .putString("member_name",renamed.optString("name",name)).apply();
            }
            return result;
        }
        if("remove".equals(action)){
            String id=payload.optString("id","");
            if(!id.matches("[0-9a-f-]{36}"))throw new Exception("계정 번호를 확인해 주세요.");
            return request("DELETE","/board/members/"+id,null,auth,adminToken);
        }
        throw new Exception("지원하지 않는 계정 작업입니다.");
    }
    static JSONObject perform(Context context,String action,JSONObject payload,String adminToken) throws Exception {
        String auth=token(context);
        if(auth.isEmpty())throw new Exception("최초 한 번 사무실 보안코드 인증이 필요합니다.");
        if("list".equals(action))return request("GET","/board",null,auth);
        if("archive".equals(action))return request("GET","/board/archive",null,auth,adminToken);
        if("post".equals(action)){
            String text=payload.optString("text","");
            if(text.isEmpty()||text.length()>1600)throw new Exception("메모 내용은 1~1600자로 적어 주세요.");
            return request("POST","/board",new JSONObject().put("text",text)
                    .put("scheduled_at",payload.has("scheduled_at")?payload.opt("scheduled_at"):JSONObject.NULL)
                    .put("all_day",payload.optBoolean("all_day",false)),auth);
        }
        String id=payload.optString("id","");
        if(!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))throw new Exception("메모 번호가 올바르지 않습니다.");
        if("imageAdd".equals(action)){
            String image=payload.optString("data_url","");
            if(!image.matches("data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+")||
                    image.length()>195000)throw new Exception("사진 크기를 확인해 주세요.");
            return request("POST","/board/"+id+"/images",new JSONObject().put("data_url",image),auth,adminToken);
        }
        if("imageGet".equals(action)||"imageRemove".equals(action)){
            String imageId=payload.optString("image_id","");
            if(!imageId.matches("[0-9a-f-]{36}"))throw new Exception("사진 번호가 올바르지 않습니다.");
            return request("imageGet".equals(action)?"GET":"DELETE",
                "/board/"+id+"/images/"+imageId,null,auth,"imageRemove".equals(action)?adminToken:null);
        }
        if("preview".equals(action))return preview(context,id);
        if("delete".equals(action))return request("DELETE","/board/"+id,null,auth,adminToken);
        if("restore".equals(action))return request("POST","/board/archive/"+id+"/restore",null,auth,adminToken);
        if("edit".equals(action)){
            String text=payload.optString("text","");
            if(text.isEmpty()||text.length()>1600)throw new Exception("메모 내용은 1~1600자로 적어 주세요.");
            JSONObject patch=new JSONObject().put("text",text);
            if(payload.has("scheduled_at"))patch.put("scheduled_at",payload.opt("scheduled_at"));
            if(payload.has("all_day"))patch.put("all_day",payload.optBoolean("all_day",false));
            return request("PATCH","/board/"+id,patch,auth,adminToken);
        }
        if("schedule".equals(action)){
            if(!payload.has("scheduled_at"))throw new Exception("일정 날짜가 필요합니다.");
            return request("PATCH","/board/"+id,new JSONObject().put("scheduled_at",payload.opt("scheduled_at")),auth,adminToken);
        }
        if("done".equals(action)){
            if(!payload.has("done")||!(payload.opt("done") instanceof Boolean))throw new Exception("완료 표시 값이 올바르지 않습니다.");
            return request("PATCH","/board/"+id,new JSONObject().put("done",payload.getBoolean("done")),auth,adminToken);
        }
        throw new Exception("지원하지 않는 게시판 작업입니다.");
    }
    private static JSONObject request(String method,String path,JSONObject body,String token) throws Exception {
        return request(method,path,body,token,null);
    }
    private static JSONObject request(String method,String path,JSONObject body,String token,String adminToken) throws Exception {
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
            if(adminToken!=null&&!adminToken.isEmpty())connection.setRequestProperty("X-FHD-Admin-Authorization","Bearer "+adminToken);
            if(body!=null){
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
                int max=path.endsWith("/images")&&"POST".equals(method)?200000:7000;
                if(bytes.length>max)throw new Exception("사진 또는 메모 크기가 너무 큽니다.");
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
            if(status==401){
                if(path.startsWith("/board")&&!path.equals("/board/choices")&&!path.equals("/board/session"))
                    throw new Exception("account_revoked · 관리자에게 계정 상태를 확인해 주세요.");
                throw new Exception("게시판 보안 인증 만료 · 다시 인증해 주세요.");
            }
            if(status==403){
                if("PATCH".equals(method)||("POST".equals(method)&&path.endsWith("/images"))||
                   ("DELETE".equals(method)&&path.contains("/images/")))
                    throw new Exception("이 메모는 최초 작성자와 관리자만 수정할 수 있습니다.");
                throw new Exception("요청 권한이 없습니다. 관리자에게 계정 상태를 확인해 주세요.");
            }
            if(status<200||status>=300)throw new Exception("게시판 서버에 연결할 수 없습니다. HTTP "+status);
            return new JSONObject(bytes.toString("UTF-8"));
        }finally{if(connection!=null)connection.disconnect();}
    }
    private OfficeBoardClient(){}
}
