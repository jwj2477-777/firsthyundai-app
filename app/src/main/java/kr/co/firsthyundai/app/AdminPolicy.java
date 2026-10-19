package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Administrator access is independent from family access.
 *
 * The private GitHub Secret is never shipped. The public API provides a slow,
 * salted PBKDF2 verifier only, which is susceptible to offline dictionary
 * attacks if the administrator chooses a short/reused password.
 *
 * Fail closed when offline. Administrator privilege is session-only, requiring
 * a fresh admin code for every transition from family mode.
 */
final class AdminPolicy {
    private static final String URL =
            "https://raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/admin_policy.json";
    private static final String PREFS = "firsthyundai-admin-policy-v1";

    static final class Data {
        final int version;
        final int iterations;
        final byte[] salt;
        final byte[] verifier;
        final String identity;

        Data(int version, int iterations, byte[] salt, byte[] verifier, String identity) {
            this.version=version;
            this.iterations=iterations;
            this.salt=salt;
            this.verifier=verifier;
            this.identity=identity;
        }
    }

    private static byte[] fromHex(String raw) throws Exception {
        if(raw==null || !raw.matches("[0-9a-f]{32}|[0-9a-f]{64}"))
            throw new Exception("관리자 검증 데이터가 올바르지 않습니다.");
        byte[] result=new byte[raw.length()/2];
        for(int i=0;i<result.length;i++) {
            int hi=Character.digit(raw.charAt(2*i),16);
            int lo=Character.digit(raw.charAt(2*i+1),16);
            result[i]=(byte)((hi<<4)|lo);
        }
        return result;
    }

    static Data parse(String json) throws Exception {
        JSONObject obj=new JSONObject(json);
        if(obj.optInt("schema_version")!=1 || !"ok".equals(obj.optString("state"))) {
            throw new Exception("관리자 비밀번호가 아직 등록되지 않았습니다. GitHub 비공개 Secret을 등록하고 관리자 보안 정책을 적용해 주세요.");
        }
        int version=obj.optInt("policy_version",0);
        int iterations=obj.optInt("iterations",0);
        String saltHex=obj.optString("salt","");
        String hashHex=obj.optString("verifier","");
        if(version<1 || version>100000000 || iterations<300000 || iterations>1000000 ||
                saltHex.length()!=32 || hashHex.length()!=64)
            throw new Exception("관리자 인증 정책의 형식이 올바르지 않습니다.");
        return new Data(version,iterations,fromHex(saltHex),fromHex(hashHex),
                version+":"+saltHex+":"+hashHex);
    }

    static Data fetch(Context context) throws Exception {
        HttpURLConnection conn=null;
        try {
            conn=(HttpURLConnection)new URL(URL+"?t="+System.currentTimeMillis()).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(9000);
            conn.setReadTimeout(9000);
            conn.setRequestProperty("Accept","application/json");
            conn.setRequestProperty("Cache-Control","no-cache, no-store");
            int status=conn.getResponseCode();
            if(status!=200)throw new Exception("관리자 보안 정책 연결 오류 (HTTP "+status+"). 인터넷 연결을 확인하세요.");
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            try(InputStream input=conn.getInputStream()) {
                byte[] bytes=new byte[2048];
                int read;
                while((read=input.read(bytes))!=-1) {
                    output.write(bytes,0,read);
                    if(output.size()>4096)throw new Exception("관리자 보안 정책 크기 오류");
                }
            }
            Data data=parse(output.toString("UTF-8"));
            SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
            int lastVersion=prefs.getInt("version",0);
            String lastIdentity=prefs.getString("identity","");
            if(lastVersion>data.version || (lastVersion==data.version &&
                    !lastIdentity.isEmpty() && !lastIdentity.equals(data.identity)))
                throw new Exception("관리자 인증 정책이 이전 버전으로 돌아갔거나 변경되어 확인할 수 없습니다.");
            prefs.edit().putInt("version",data.version)
                    .putString("identity",data.identity).apply();
            return data;
        } finally {
            if(conn!=null)conn.disconnect();
        }
    }

    static boolean matches(Data policy, char[] code) {
        if(policy==null || code==null || code.length==0)return false;
        PBEKeySpec spec=new PBEKeySpec(code,policy.salt,policy.iterations,256);
        try {
            byte[] derived=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
            boolean valid=MessageDigest.isEqual(derived,policy.verifier);
            Arrays.fill(derived,(byte)0);
            return valid;
        } catch(Exception ignored) {
            return false;
        } finally {
            spec.clearPassword();
        }
    }
}
