package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Device-local administrator passphrase, independent from the family access code. */
final class AdminPin {
    private static final String STORE="firsthyundai-admin-secret-v1";
    private static final int ROUNDS=280000;
    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(STORE,Context.MODE_PRIVATE);
    }
    static boolean configured(Context c) {
        return prefs(c).getString("salt","").length()==32 &&
                prefs(c).getString("hash","").length()==64;
    }
    static boolean validFormat(char[] code) {
        if(code==null||code.length<8||code.length>64)return false;
        for(char ch:code)if(ch<33||ch>126)return false;
        return true;
    }
    private static String hex(byte[] bytes) {
        StringBuilder b=new StringBuilder(bytes.length*2);
        for(byte x:bytes)b.append(String.format(java.util.Locale.ROOT,"%02x",x&255));
        return b.toString();
    }
    private static byte[] unhex(String s) {
        if(s==null||s.length()%2!=0)throw new IllegalArgumentException();
        byte[] b=new byte[s.length()/2];
        for(int i=0;i<b.length;i++) {
            int a=Character.digit(s.charAt(i*2),16),c=Character.digit(s.charAt(i*2+1),16);
            if(a<0||c<0)throw new IllegalArgumentException();
            b[i]=(byte)((a<<4)|c);
        }
        return b;
    }
    private static byte[] derive(char[] code,byte[] salt) throws Exception {
        PBEKeySpec spec=new PBEKeySpec(code,salt,ROUNDS,256);
        try {return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec).getEncoded();}
        finally {spec.clearPassword();}
    }
    static boolean set(Context c,char[] code) {
        if(!validFormat(code))return false;
        try {
            byte[] salt=new byte[16];
            new SecureRandom().nextBytes(salt);
            byte[] hash=derive(code,salt);
            boolean ok=prefs(c).edit().putString("salt",hex(salt))
                    .putString("hash",hex(hash)).commit();
            Arrays.fill(hash,(byte)0);
            return ok;
        }catch(Exception ignored){return false;}
    }
    static boolean matches(Context c,char[] code) {
        if(!configured(c)||code==null)return false;
        try {
            byte[] salt=unhex(prefs(c).getString("salt",""));
            byte[] expected=unhex(prefs(c).getString("hash",""));
            byte[] actual=derive(code,salt);
            boolean ok=MessageDigest.isEqual(expected,actual);
            Arrays.fill(actual,(byte)0);
            return ok;
        }catch(Exception ignored){return false;}
    }
}
