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
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** One most recently approved contract NOTICE per signed-in office member.
 * Stored only on this handset, encrypted with Android Keystore AES-GCM and
 * excluded from cloud/Android Auto Backup. No Web Storage or network sync.
 * An older version is never treated as approved automatically on restore. */
final class ContractRevisionStore {
    private static final String ALIAS="firsthyundai-contract-approved-aes-v1";
    private static final int LIMIT=90000;
    private ContractRevisionStore(){}

    private static boolean validMember(String member){
        return member!=null&&member.matches("[0-9a-f-]{36}");
    }
    private static AtomicFile file(Context context,String member){
        return new AtomicFile(new File(context.getNoBackupFilesDir(),
            "firsthyundai-contract-approved-"+member+".enc"));
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
    private static boolean valid(JSONObject row){
        if(row==null||row.optInt("schema")!=1||
           row.optInt("revision")<1||row.optInt("revision")>999||
           row.optLong("approvedAt")<=0)return false;
        JSONObject fields=row.optJSONObject("fields");
        if(fields==null||fields.length()>38)return false;
        String preview=row.optString("preview","");
        if(preview.isEmpty()||preview.length()>20000)return false;
        for(java.util.Iterator<String> keys=fields.keys();keys.hasNext();){
            String id=keys.next();
            if(!id.matches("[a-zA-Z][a-zA-Z0-9]{0,30}") ||
                !(fields.opt(id) instanceof String))return false;
            String value=fields.optString(id,"");
            if(value.length()>("rough".equals(id)?12000:"terms".equals(id)?8000:
                "specialMemo".equals(id)?6000:2600))return false;
        }
        return true;
    }
    static synchronized boolean save(Context context,String member,String input){
        if(!validMember(member)||input==null||input.length()>LIMIT)return false;
        AtomicFile target=file(context,member);
        FileOutputStream output=null;
        try{
            JSONObject record=new JSONObject(input);
            if(!valid(record))return false;
            byte[] plain=record.toString().getBytes(StandardCharsets.UTF_8);
            if(plain.length>LIMIT)return false;
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,key());
            cipher.updateAAD(("contract-approved-v1:"+member).getBytes(StandardCharsets.UTF_8));
            byte[] iv=cipher.getIV();
            if(iv.length!=12)return false;
            byte[] ciphertext=cipher.doFinal(plain);
            output=target.startWrite();
            output.write(iv);
            output.write(ciphertext);
            target.finishWrite(output);
            return true;
        }catch(Exception ignored){
            if(output!=null)target.failWrite(output);
            return false;
        }
    }
    static synchronized String read(Context context,String member){
        if(!validMember(member))return "{}";
        try(InputStream input=file(context,member).openRead();
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[4096];int count;
            while((count=input.read(buf))!=-1){
                out.write(buf,0,count);
                if(out.size()>LIMIT+100)return "{}";
            }
            byte[] payload=out.toByteArray();
            if(payload.length<=28)return "{}";
            byte[] iv=Arrays.copyOfRange(payload,0,12);
            byte[] encrypted=Arrays.copyOfRange(payload,12,payload.length);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            cipher.updateAAD(("contract-approved-v1:"+member).getBytes(StandardCharsets.UTF_8));
            byte[] clear=cipher.doFinal(encrypted);
            if(clear.length>LIMIT)return "{}";
            JSONObject row=new JSONObject(new String(clear,StandardCharsets.UTF_8));
            return valid(row)?row.toString():"{}";
        }catch(Exception ignored){return "{}";}
    }
    static synchronized void clear(Context context,String member){
        if(validMember(member))file(context,member).delete();
    }
}
