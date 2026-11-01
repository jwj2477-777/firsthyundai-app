package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Member-isolated, hardware-backed when available, on-device memo draft.
 * No unencrypted note text in Web Storage, system logs or cloud storage. */
final class OfficeDraftStore {
    private static final String PREF="firsthyundai-office-encrypted-drafts-v1";
    private static final String ALIAS="firsthyundai-office-draft-aes-v1";
    private OfficeDraftStore(){}
    private static boolean valid(String id){
        return id!=null&&id.matches("[0-9a-f-]{36}");
    }
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }
    static synchronized boolean save(Context context,String member,String text,String day){
        if(!valid(member)||text==null||text.length()>1600||
            day==null||(!day.isEmpty()&&!day.matches("20[0-9]{2}-[0-9]{2}-[0-9]{2}")))return false;
        if(text.isEmpty()&&day.isEmpty()){clear(context,member);return true;}
        try{
            byte[] plain=new JSONObject().put("text",text).put("day",day)
                .toString().getBytes(StandardCharsets.UTF_8);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,key());
            cipher.updateAAD(member.getBytes(StandardCharsets.UTF_8));
            JSONObject record=new JSONObject()
                .put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
                .put("data",Base64.encodeToString(cipher.doFinal(plain),Base64.NO_WRAP));
            return context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
                .putString(member,record.toString()).commit();
        }catch(Exception ignored){return false;}
    }
    static synchronized String read(Context context,String member){
        if(!valid(member))return "{}";
        SharedPreferences pref=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String source=pref.getString(member,"");
        if(source.isEmpty())return "{}";
        try{
            JSONObject row=new JSONObject(source);
            byte[] iv=Base64.decode(row.getString("iv"),Base64.DEFAULT);
            byte[] bytes=Base64.decode(row.getString("data"),Base64.DEFAULT);
            if(iv.length!=12||bytes.length>12000)return "{}";
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            cipher.updateAAD(member.getBytes(StandardCharsets.UTF_8));
            JSONObject draft=new JSONObject(new String(cipher.doFinal(bytes),StandardCharsets.UTF_8));
            String text=draft.optString("text",""),day=draft.optString("day","");
            if(text.length()>1600||(!day.isEmpty()&&!day.matches("20[0-9]{2}-[0-9]{2}-[0-9]{2}")))
                return "{}";
            return new JSONObject().put("text",text).put("day",day).toString();
        }catch(Exception ignored){return "{}";}
    }
    static synchronized void clear(Context context,String member){
        if(valid(member))context.getSharedPreferences(PREF,Context.MODE_PRIVATE)
            .edit().remove(member).apply();
    }
}
