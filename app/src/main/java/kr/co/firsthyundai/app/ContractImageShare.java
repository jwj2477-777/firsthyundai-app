package kr.co.firsthyundai.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

/** Shares short-lived private PNGs using content URIs; never uploads customer data. */
final class ContractImageShare {
    private static final int MAX_PAGES = 12;
    private static final int MAX_TOTAL_PAYLOAD = 22_000_000;
    private static final int MAX_PAGE_BYTES = 5_000_000;
    private static final String PREFIX = "data:image/png;base64,";
    private ContractImageShare() {}

    static void share(Activity activity, String payload) {
        if(payload == null || payload.length() > MAX_TOTAL_PAYLOAD) {
            notice(activity, "이미지 데이터가 너무 큽니다."); return;
        }
        new Thread(() -> {
            try {
                JSONObject data = new JSONObject(payload);
                JSONArray pages = data.optJSONArray("pages");
                if(pages == null || pages.length() < 1 || pages.length() > MAX_PAGES)
                    throw new IllegalArgumentException("이미지 장수를 확인해 주세요.");
                File dir = new File(activity.getCacheDir(), "contract_images");
                if(!dir.exists() && !dir.mkdirs())
                    throw new IllegalStateException("이미지 임시 폴더를 만들 수 없습니다.");
                // Remove only aged, app-owned temporary images. Current share recipients need file access.
                File[] previous = dir.listFiles();
                if(previous != null) for(File old : previous) {
                    if(old.isFile() && old.getName().startsWith("fh_contract_")
                            && System.currentTimeMillis()-old.lastModified()>86_400_000L) old.delete();
                }
                ArrayList<Uri> uris = new ArrayList<>();
                for(int i=0; i<pages.length(); i++) {
                    String encoded = pages.getString(i);
                    if(!encoded.startsWith(PREFIX) || encoded.length()>7_000_000)
                        throw new IllegalArgumentException("PNG 이미지 형식이 잘못되었습니다.");
                    byte[] png = Base64.decode(encoded.substring(PREFIX.length()), Base64.DEFAULT);
                    if(png.length<8 || png.length>MAX_PAGE_BYTES || !pngSignature(png))
                        throw new IllegalArgumentException("PNG 데이터가 손상되었거나 너무 큽니다.");
                    File file = File.createTempFile("fh_contract_", ".png", dir);
                    try(FileOutputStream out = new FileOutputStream(file)) { out.write(png); }
                    uris.add(FileProvider.getUriForFile(activity,
                            activity.getPackageName()+".fileprovider", file));
                }
                activity.runOnUiThread(() -> {
                    Intent intent = new Intent(uris.size()==1?Intent.ACTION_SEND:Intent.ACTION_SEND_MULTIPLE);
                    intent.setType("image/png");
                    if(uris.size()==1) intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                    else intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                    ClipData clip = ClipData.newUri(activity.getContentResolver(),"퍼스트현대 계약 안내",uris.get(0));
                    for(int i=1; i<uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
                    intent.setClipData(clip);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        activity.startActivity(Intent.createChooser(intent, "계약 안내 이미지 공유"));
                    } catch(Exception e) { notice(activity,"이미지 공유 앱을 열지 못했습니다."); }
                });
            } catch(Exception e) {
                notice(activity,"이미지 공유에 실패했습니다. 다시 만들어 주세요.");
            }
        }, "fh-contract-image-share").start();
    }

    private static boolean pngSignature(byte[] b) {
        final int[] magic={137,80,78,71,13,10,26,10};
        for(int i=0;i<magic.length;i++) if((b[i]&0xff)!=magic[i])return false;
        return true;
    }
    private static void notice(Activity a,String message) {
        a.runOnUiThread(() -> Toast.makeText(a,message,Toast.LENGTH_LONG).show());
    }
}
