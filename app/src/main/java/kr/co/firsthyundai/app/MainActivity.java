package kr.co.firsthyundai.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int SAVE_BACKUP = 1021;
    private static final int OPEN_BACKUP = 1022;
    private static final int LIMIT = 8 * 1024 * 1024;
    private WebView web;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String pendingBackup = "";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeExternal(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeExternal(url);
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "FirstHyundaiNative");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private boolean routeExternal(String url) {
        if ("file:///android_asset/index.html".equals(url)) return false;
        Uri uri = Uri.parse(url);
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
        }
        // allow no navigation to untrusted content inside JavascriptInterface-bearing WebView
        return true;
    }

    private void deliver(String name, JSONObject data) {
        runOnUiThread(() -> web.evaluateJavascript("window."+name+"("+data.toString()+")", null));
    }

    public final class Bridge {
        @JavascriptInterface public void fetch(String repository, String filename, String requestId) {
            // Public data ONLY. Never inject API tokens / family records into remote requests.
            if (repository==null || !repository.matches("[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.-]{1,100}") ||
                    !("trades.json".equals(filename) || "news.json".equals(filename))) {
                deliverFeed(requestId, false, "저장소 주소 또는 파일명이 올바르지 않습니다.", null);
                return;
            }
            io.execute(() -> {
                HttpURLConnection conn = null;
                try {
                    // branch fixed to main; HTTPS host fixed to raw.githubusercontent.com
                    String address = "https://raw.githubusercontent.com/"+repository+"/main/data/"+filename;
                    conn=(HttpURLConnection)new URL(address).openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("Accept", "application/json");
                    if (conn.getResponseCode()!=200) throw new Exception("HTTP "+conn.getResponseCode()+" (공개 저장소의 main/data 파일 확인)");
                    ByteArrayOutputStream out=new ByteArrayOutputStream();
                    try(InputStream in=conn.getInputStream()) {
                        byte[] buffer = new byte[16384]; int n;
                        while ((n=in.read(buffer))!=-1) {
                            out.write(buffer,0,n);
                            if(out.size()>LIMIT)throw new Exception("데이터 용량 제한(8MB) 초과");
                        }
                    }
                    JSONObject parsed = new JSONObject(out.toString("UTF-8"));
                    deliverFeed(requestId,true,"",parsed);
                } catch(Exception e) {
                    deliverFeed(requestId,false,e.getMessage()==null?"네트워크 연결 실패":e.getMessage(),null);
                } finally {if(conn!=null)conn.disconnect();}
            });
        }
        @JavascriptInterface public void saveBackup(String json) {
            if(json==null || json.length()>2_000_000)return;
            pendingBackup=json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.setType("application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE,"firsthyundai-notes-backup.json");
                startActivityForResult(intent,SAVE_BACKUP);
            });
        }
        @JavascriptInterface public void openBackup() {
            runOnUiThread(() -> {
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent,OPEN_BACKUP);
            });
        }
    }

    private void deliverFeed(String requestId, boolean ok, String error, JSONObject payload) {
        JSONObject obj=new JSONObject();
        try {
            obj.put("requestId",requestId==null?"":requestId);
            obj.put("ok",ok);
            obj.put("error",error);
            if(payload!=null)obj.put("payload",payload);
        } catch(Exception ignored) {}
        deliver("onFirstHyundaiResult",obj);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK || data==null || data.getData()==null)return;
        Uri uri=data.getData();
        if(request==SAVE_BACKUP) {
            String backup=pendingBackup;pendingBackup="";
            io.execute(() -> {
                try(OutputStream os=getContentResolver().openOutputStream(uri)) {
                    if(os==null)throw new Exception("저장 실패");
                    os.write(backup.getBytes(StandardCharsets.UTF_8));
                    JSONObject o=new JSONObject();o.put("ok",true);deliver("onBackupSaved",o);
                } catch(Exception e) {try {JSONObject o=new JSONObject();o.put("ok",false);deliver("onBackupSaved",o);}catch(Exception ignored){}}
            });
        } else if(request==OPEN_BACKUP) {
            io.execute(() -> {
                try(InputStream in=getContentResolver().openInputStream(uri)) {
                    if(in==null)throw new Exception("읽기 실패");
                    ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;
                    while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>2_000_000)throw new Exception("백업 용량 초과");}
                    JSONObject o=new JSONObject();o.put("ok",true);o.put("json",out.toString("UTF-8"));
                    deliver("onBackupOpened",o);
                }catch(Exception e){try {JSONObject o=new JSONObject();o.put("ok",false);o.put("error",e.getMessage());deliver("onBackupOpened",o);}catch(Exception ignored){}}
            });
        }
    }
    @Override protected void onDestroy(){io.shutdownNow();if(web!=null)web.destroy();super.onDestroy();}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
