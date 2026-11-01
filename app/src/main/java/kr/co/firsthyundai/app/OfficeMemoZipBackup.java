package kr.co.firsthyundai.app;

import android.content.Context;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Explicit administrator export: one ZIP with note metadata and private original
 * JPEGs. Files are downloaded through the existing authenticated native API.
 * An incomplete archive is never copied into the chosen destination. */
final class OfficeMemoZipBackup {
    private static final long MAX_ZIP_BYTES=150L*1024*1024;
    private OfficeMemoZipBackup(){}
    static int write(Context context,JSONObject source,OutputStream destination) throws Exception {
        if(source==null||source.optInt("schema_version")!=1||
           !"office_board_backup_with_photos".equals(source.optString("kind")))
            throw new IllegalArgumentException("백업 내용 형식이 올바르지 않습니다.");
        JSONArray notes=source.optJSONArray("notes");
        if(notes==null||notes.length()>5000)throw new IllegalArgumentException("백업 메모 건수를 확인해 주세요.");
        if(!OfficeBoardClient.enrolled(context))
            throw new IllegalStateException("사무실 인증이 필요합니다.");
        File stage=File.createTempFile("office-memo-archive-", ".zip",context.getCacheDir());
        int photos=0;
        try {
            try(ZipOutputStream zip=new ZipOutputStream(new FileOutputStream(stage))){
                zip.putNextEntry(new ZipEntry("shared-memos.json"));
                zip.write(source.toString().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
                Set<String> processed=new HashSet<>();
                for(int i=0;i<notes.length();i++){
                    JSONObject note=notes.optJSONObject(i);
                    if(note==null)throw new IllegalArgumentException("백업 메모 항목이 비어 있습니다.");
                    String id=note.optString("id","");
                    if(!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
                        throw new IllegalArgumentException("잘못된 메모 식별자");
                    JSONArray images=note.optJSONArray("images");
                    if(images==null)continue;
                    if(images.length()>3)throw new IllegalArgumentException("첨부 사진 개수를 확인해 주세요.");
                    for(int j=0;j<images.length();j++){
                        String photoId=images.optString(j,"");
                        if(!photoId.matches("[0-9a-f-]{36}"))
                            throw new IllegalArgumentException("잘못된 사진 식별자");
                        if(!processed.add(photoId))continue;
                        JSONObject result=OfficeBoardClient.perform(context,"imageGet",
                            new JSONObject().put("id",id).put("image_id",photoId),null);
                        String data=result.optString("data_url","");
                        if(!data.startsWith("data:image/jpeg;base64,")||data.length()>195000)
                            throw new IllegalStateException("사진을 가져오지 못했습니다. 누락 없이 다시 백업해 주세요.");
                        byte[] jpg=Base64.decode(data.substring("data:image/jpeg;base64,".length()),Base64.DEFAULT);
                        if(jpg.length<80||jpg.length>150000||
                           (jpg[0]&255)!=255||(jpg[1]&255)!=216||(jpg[2]&255)!=255)
                            throw new IllegalStateException("사진 파일 형식이 맞지 않습니다.");
                        zip.putNextEntry(new ZipEntry("photos/"+id+"/"+photoId+".jpg"));
                        zip.write(jpg);
                        zip.closeEntry();
                        photos++;
                        if(stage.length()>MAX_ZIP_BYTES)
                            throw new IllegalStateException("백업 용량이 150MB를 넘었습니다.");
                    }
                }
                zip.finish();
            }
            if(stage.length()>MAX_ZIP_BYTES)throw new IllegalStateException("백업 용량이 너무 큽니다.");
            try(FileInputStream input=new FileInputStream(stage)){
                byte[] buffer=new byte[16*1024];int n;
                while((n=input.read(buffer))!=-1)destination.write(buffer,0,n);
                destination.flush();
            }
            return photos;
        } finally {stage.delete();}
    }
}
