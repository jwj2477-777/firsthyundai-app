package kr.co.firsthyundai.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.text.InputType;
import android.widget.EditText;
import java.util.Arrays;
import java.util.Properties;
import java.security.MessageDigest;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
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
    private static final String MODE_PREFS = "firsthyundai-device-mode";
    private static final String ADMIN_TRIES = "firsthyundai-admin-attempts";

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

    private boolean isAdminDeviceMode() {
        return getSharedPreferences(MODE_PREFS, MODE_PRIVATE).getBoolean("admin_mode", false);
    }

    private void changeRole(boolean admin) {
        getSharedPreferences(MODE_PREFS, MODE_PRIVATE).edit()
                .putBoolean("admin_mode", admin).apply();
        // Script only receives a role label; no password travels to JavaScript.
        web.evaluateJavascript("window.onRoleChanged(" +
                (admin ? "'admin'" : "'family'") + ")", null);
    }

    private boolean matchesFamilyCode(char[] candidate) {
        return AccessPolicy.matches(AccessPolicy.cached(this), candidate);
    }

    @Override protected void onResume() {
        super.onResume();
        // When resuming from a long background pause, verify that the manager
        // has not rotated the shared family code. Also applies to admin devices.
        if (AccessPolicy.shouldRecheck(this)) {
            io.execute(() -> {
                boolean allowed;
                try {
                    AccessPolicy.Result latest=AccessPolicy.resolve(this);
                    allowed=AccessPolicy.authorized(this,latest.policy);
                }catch(Exception ignored) {
                    allowed=false;
                }
                if(!allowed) runOnUiThread(() -> {
                    if(isFinishing()||isDestroyed())return;
                    startActivity(new Intent(this,LockActivity.class));
                    finish();
                });
            });
        }
    }

    private void showAdminCodeDialog() {
        if (isAdminDeviceMode()) return;
        SharedPreferences tries = getSharedPreferences(ADMIN_TRIES, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lockedUntil = tries.getLong("locked_until", 0L);
        if (now < lockedUntil) {
            new AlertDialog.Builder(this)
                    .setMessage("여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.")
                    .setPositiveButton("확인", null).show();
            return;
        }
        final EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setHint("기존 가족 보안코드 입력");
        field.setPadding(32, 24, 32, 24);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        new AlertDialog.Builder(this)
                .setTitle("관리자 모드")
                .setMessage("현재 가족 보안코드로 관리자 화면에 진입합니다. 별도 관리자 전용 암호는 추후 지원할 예정입니다.")
                .setView(field)
                .setNegativeButton("취소", null)
                .setPositiveButton("확인", (dialog, which) -> {
                    char[] candidate = field.getText().toString().trim().toCharArray();
                    field.setText("");
                    boolean ok = candidate.length > 0 && matchesFamilyCode(candidate);
                    Arrays.fill(candidate, (char) 0);
                    if (ok) {
                        tries.edit().clear().apply();
                        changeRole(true);
                    } else {
                        int attempt = tries.getInt("attempts", 0) + 1;
                        if (attempt >= 5) {
                            tries.edit().putInt("attempts", 0)
                                    .putLong("locked_until", System.currentTimeMillis() + 60000).apply();
                        } else {
                            tries.edit().putInt("attempts", attempt).apply();
                        }
                        new AlertDialog.Builder(this)
                                .setMessage(attempt >= 5 ?
                                        "5회 실패해 1분 동안 관리자 전환이 제한됩니다." :
                                        "보안코드가 일치하지 않습니다.")
                                .setPositiveButton("확인", null).show();
                    }
                }).show();
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
        @JavascriptInterface public String getMode() {
            return isAdminDeviceMode() ? "admin" : "family";
        }
        @JavascriptInterface public void requestAdminAccess() {
            runOnUiThread(() -> showAdminCodeDialog());
        }
        @JavascriptInterface public void switchToFamilyMode() {
            runOnUiThread(() -> changeRole(false));
        }
        @JavascriptInterface public void fetch(String repository, String filename, String requestId) {
            // Public data ONLY. Never inject API tokens / family records into remote requests.
            if (repository==null || !repository.matches("[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.-]{1,100}") ||
                    !("trades.json".equals(filename) || "new_trades.json".equals(filename) || "news.json".equals(filename))) {
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
