package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * V1.1 family access policy. The family secret is NEVER stored in public files;
 * the public document contains only a salted, slow PBKDF2 verifier.
 *
 * Public verifiers can be guessed offline. Users should choose a long random
 * phrase (12+ chars); this is NOT a server-backed identity service.
 */
final class AccessPolicy {
    private static final String PREF = "firsthyundai-policy-v1";
    private static final String ROLE_PREF = "firsthyundai-device-mode";
    private static final long OFFLINE_GRACE_MS = 24L * 60L * 60L * 1000L;
    private static final String URL_PREFIX =
            "https://raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/access_policy.json";

    static final class Policy {
        final int version;
        final int iterations;
        final String saltHex;
        final String verifierHex;
        final byte[] salt;
        final byte[] verifier;
        final String json;

        Policy(int version, int iterations, String saltHex, String verifierHex,
               byte[] salt, byte[] verifier, String json) {
            this.version = version;
            this.iterations = iterations;
            this.saltHex = saltHex;
            this.verifierHex = verifierHex;
            this.salt = salt;
            this.verifier = verifier;
            this.json = json;
        }
        String identity() { return version + ":" + saltHex + ":" + verifierHex; }
    }

    static final class Result {
        final Policy policy;
        final boolean online;
        final boolean changed;
        Result(Policy policy, boolean online, boolean changed) {
            this.policy = policy;
            this.online = online;
            this.changed = changed;
        }
    }

    private static byte[] hex(String x) throws Exception {
        if (x == null || x.length() % 2 != 0 || !x.matches("[0-9a-f]{1,256}"))
            throw new Exception("유효하지 않은 보안 정책 형식");
        byte[] out = new byte[x.length()/2];
        for (int i=0; i<out.length; i++) {
            int a=Character.digit(x.charAt(i*2),16);
            int b=Character.digit(x.charAt(i*2+1),16);
            out[i]=(byte)((a<<4)|b);
        }
        return out;
    }

    static Policy parse(String source) throws Exception {
        JSONObject value = new JSONObject(source);
        if (value.optInt("schema_version",0)!=1 || !"ok".equals(value.optString("state")))
            throw new Exception("아직 활성화되지 않은 보안 정책");
        int version=value.optInt("policy_version",0);
        int count=value.optInt("iterations",0);
        String saltText=value.optString("salt","");
        String verifierText=value.optString("verifier","");
        if (version < 1 || version > 100000000 || count < 200000 || count > 1000000 ||
                saltText.length() != 32 || verifierText.length() != 64)
            throw new Exception("보안 정책 검증값 오류");
        byte[] salt=hex(saltText);
        byte[] verifier=hex(verifierText);
        return new Policy(version,count,saltText,verifierText,salt,verifier,source);
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF,Context.MODE_PRIVATE);
    }

    static Policy cached(Context ctx) {
        String text=prefs(ctx).getString("policy_json","");
        if(text.isEmpty())return null;
        try{return parse(text);}catch(Exception ignored){return null;}
    }

    static boolean shouldRecheck(Context ctx) {
        long last=prefs(ctx).getLong("last_online_check",0L);
        long now=System.currentTimeMillis();
        return last<=0 || now<last || now-last>120_000L;
    }

    static int currentVersion(Context ctx) {
        Policy p=cached(ctx);
        return p == null ? 0 : p.version;
    }

    static boolean authorized(Context ctx, Policy p) {
        String stored=prefs(ctx).getString("accepted_policy", "");
        return p!=null && p.identity().equals(stored);
    }

    static void authorize(Context ctx, Policy p) {
        prefs(ctx).edit().putString("accepted_policy",p.identity()).apply();
    }

    static void resetLocalAuthorization(Context ctx) {
        prefs(ctx).edit().remove("accepted_policy").apply();
        ctx.getSharedPreferences(ROLE_PREF, Context.MODE_PRIVATE)
                .edit().putBoolean("admin_mode",false).apply();
    }

    static boolean matches(Policy policy, char[] input) {
        if(policy==null || input==null || input.length==0)return false;
        PBEKeySpec spec=new PBEKeySpec(input,policy.salt,policy.iterations,256);
        try {
            byte[] actual=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
            boolean match=MessageDigest.isEqual(actual,policy.verifier);
            Arrays.fill(actual,(byte)0);
            return match;
        }catch(Exception ignored){return false;}finally{spec.clearPassword();}
    }

    private static String readRemote() throws Exception {
        HttpURLConnection connection=null;
        try {
            // Cache-busting and no-cache discourage stale raw.githubusercontent CDN results.
            connection=(HttpURLConnection)new URL(URL_PREFIX+"?v="+System.currentTimeMillis()).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(9000);
            connection.setReadTimeout(9000);
            connection.setRequestProperty("Cache-Control","no-cache, no-store");
            connection.setRequestProperty("Accept","application/json");
            if(connection.getResponseCode()!=200)
                throw new Exception("정책 서버 HTTP "+connection.getResponseCode());
            ByteArrayOutputStream result=new ByteArrayOutputStream();
            try(InputStream stream=connection.getInputStream()) {
                byte[] buffer=new byte[2048];int size;
                while((size=stream.read(buffer))!=-1) {
                    result.write(buffer,0,size);
                    if(result.size()>4096)throw new Exception("보안 정책 크기 제한 초과");
                }
            }
            return result.toString("UTF-8");
        } finally {
            if(connection!=null)connection.disconnect();
        }
    }

    static Result resolve(Context ctx) throws Exception {
        SharedPreferences p=prefs(ctx);
        Policy earlier=cached(ctx);
        long now=System.currentTimeMillis();
        try {
            Policy latest=parse(readRemote());
            if (earlier!=null && latest.version<earlier.version)
                throw new SecurityException("보안 정책의 버전이 과거로 되돌아갔습니다.");
            if (earlier!=null && latest.version==earlier.version &&
                    !latest.identity().equals(earlier.identity()))
                throw new SecurityException("보안 정책 동일 버전의 인증값이 다릅니다.");
            boolean changed=earlier!=null && !earlier.identity().equals(latest.identity());
            if(changed)resetLocalAuthorization(ctx);
            p.edit().putString("policy_json",latest.json)
                    .putLong("last_online_check",now).apply();
            return new Result(latest,true,changed);
        }catch(SecurityException security) {
            throw security;
        }catch(Exception networkError) {
            long last=p.getLong("last_online_check",0L);
            if (earlier!=null && last>0 && now>=last &&
                    now-last<=OFFLINE_GRACE_MS)
                return new Result(earlier,false,false);
            throw new Exception("보안 정책을 확인할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
        }
    }
}
