package kr.co.firsthyundai.app;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Encrypted, read-only last-successful shared memo snapshot for emergencies.
 * Data never enters Web Storage, plaintext app files, cloud backups or logs.
 * Each signed-in member has an isolated AES-GCM document in noBackupFilesDir.
 * Snapshots are replaced atomically ONLY after a complete online sync.
 */
final class OfficeOfflineStore {
    private static final String ALIAS="firsthyundai-office-board-offline-aes-v1";
    private static final int LIMIT=4*1024*1024;
    private static final int MAX_NOTES=5000;
    private OfficeOfflineStore(){}

    private static boolean memberOk(String id){
        return id!=null&&id.matches("[0-9a-f-]{36}");
    }
    private static AtomicFile document(Context context,String member){
        return new AtomicFile(new File(context.getNoBackupFilesDir(),
            "firsthyundai-office-cache-"+member+".enc"));
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
    private static void validateNotes(JSONArray notes) throws Exception {
        if(notes==null||notes.length()>MAX_NOTES)throw new Exception("invalid_snapshot_count");
        for(int i=0;i<notes.length();i++){
            JSONObject row=notes.optJSONObject(i);
            if(row==null||!String.valueOf(row.optString("id",""))
                  .matches("[a-z0-9]{8,14}-[0-9a-f-]{36}")||
                !(row.opt("done") instanceof Boolean)||
                !(row.opt("text") instanceof String)||
                row.optString("text","").length()>1600)
                throw new Exception("invalid_snapshot_note");
        }
    }
    static synchronized boolean save(Context context,String member,String input){
        if(!memberOk(member)||input==null||input.length()>LIMIT)return false;
        FileOutputStream stream=null;
        AtomicFile target=document(context,member);
        try{
            JSONObject source=new JSONObject(input);
            JSONArray notes=source.optJSONArray("notes");
            validateNotes(notes);
            JSONObject snapshot=new JSONObject().put("schema",1)
                .put("cachedAt",System.currentTimeMillis()).put("notes",notes);
            byte[] clear=snapshot.toString().getBytes(StandardCharsets.UTF_8);
            if(clear.length>LIMIT)return false;
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,key());
            cipher.updateAAD(("office-cache-v1:"+member).getBytes(StandardCharsets.UTF_8));
            byte[] encrypted=cipher.doFinal(clear);
            byte[] iv=cipher.getIV();
            if(iv.length!=12)return false;
            stream=target.startWrite();
            stream.write(iv);
            stream.write(encrypted);
            target.finishWrite(stream);
            return true;
        }catch(Exception ignored){
            if(stream!=null)target.failWrite(stream);
            return false;
        }
    }
    static synchronized String read(Context context,String member){
        if(!memberOk(member))return "{}";
        AtomicFile source=document(context,member);
        try(InputStream stream=source.openRead();
            ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] tmp=new byte[4096];
            int length;
            while((length=stream.read(tmp))!=-1){
                output.write(tmp,0,length);
                if(output.size()>LIMIT+64)return "{}";
            }
            byte[] encrypted=output.toByteArray();
            if(encrypted.length<=28)return "{}";
            byte[] iv=java.util.Arrays.copyOfRange(encrypted,0,12);
            byte[] ciphertext=java.util.Arrays.copyOfRange(encrypted,12,encrypted.length);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            cipher.updateAAD(("office-cache-v1:"+member).getBytes(StandardCharsets.UTF_8));
            byte[] plain=cipher.doFinal(ciphertext);
            JSONObject snapshot=new JSONObject(new String(plain,StandardCharsets.UTF_8));
            if(snapshot.optInt("schema")!=1||snapshot.optLong("cachedAt",0)<=0)return "{}";
            validateNotes(snapshot.optJSONArray("notes"));
            return snapshot.toString();
        }catch(Exception ignored){return "{}";}
    }
    static synchronized boolean has(Context context,String member){
        // A complete, authenticated snapshot is required for emergency entry.
        return memberOk(member)&&read(context,member).startsWith("{\"schema\":1");
    }
    static synchronized void clear(Context context,String member){
        if(memberOk(member))document(context,member).delete();
    }
}
