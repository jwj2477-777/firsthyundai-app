package kr.co.firsthyundai.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.text.InputType;
import android.widget.EditText;
import android.widget.Toast;
import java.util.Arrays;
import java.util.Properties;
import java.security.MessageDigest;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import android.content.Intent;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;
import java.io.File;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.speech.RecognizerIntent;
import java.util.ArrayList;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.ValueCallback;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private static final String DEVICE_DISPLAY_PREF="firsthyundai-device-display-v1";
    private static final String DEVICE_DISPLAY_KEY="mode";
    private String localDeviceDisplayMode() {
        String mode=getSharedPreferences(DEVICE_DISPLAY_PREF,MODE_PRIVATE)
            .getString(DEVICE_DISPLAY_KEY,"standard");
        return "large".equals(mode)||"xlarge".equals(mode)?mode:"standard";
    }
    private static int deviceTextZoom(String mode) {
        return "xlarge".equals(mode)?128:"large".equals(mode)?116:100;
    }
    private static boolean validDeviceDisplayMode(String mode) {
        return "standard".equals(mode)||"large".equals(mode)||"xlarge".equals(mode);
    }
    private static final String INITIAL_PERMISSION_PREF="firsthyundai-initial-notification-request-v1";
    private static final String INITIAL_PERMISSION_ASKED="asked";
    private void requestInitialNotificationPermission(){
        // Android 13+ always requires an explicit system permission dialog.
        // Ask once immediately after a successful authenticated app launch.
        if(Build.VERSION.SDK_INT<33 || isFinishing() || isDestroyed())return;
        if(checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)return;
        SharedPreferences state=getSharedPreferences(INITIAL_PERMISSION_PREF,MODE_PRIVATE);
        if(state.getBoolean(INITIAL_PERMISSION_ASKED,false))return;
        state.edit().putBoolean(INITIAL_PERMISSION_ASKED,true).apply();
        TradeNotifications.requestPermission(this);
    }
    private static final int SAVE_BACKUP = 1021;
    private static final int OPEN_BACKUP = 1022;
    private static final int SAVE_CATALOG = 1023;
    private static final int DICTATE_CONTRACT = 1024;
    private static final int CHOOSE_MEMO_IMAGES = 1025;
    private ValueCallback<Uri[]> pendingMemoImages;
    private static final int LIMIT = 8 * 1024 * 1024;
    private volatile String verifiedUpdateUrl = "";
    private volatile boolean updateDownloading = false;
    private final AtomicBoolean updateChecking = new AtomicBoolean(false);
    private WebView web;
    private SmoothBrandOverlay nativeHandoff;
    private boolean webFirstFrameShown = false;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final android.os.Handler memoTimer = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable memoCheck = new Runnable(){
        @Override public void run(){
            if(isFinishing()||isDestroyed())return;
            io.execute(()->{
                verifyOfficeMember(false);
                int incoming=OfficeMemoNotifications.check(getApplicationContext());
                if(incoming>0)runOnUiThread(()->{
                    if(web!=null&&!isFinishing()&&!isDestroyed())
                        web.evaluateJavascript("window.FirstHyundaiOfficeBoard?.onNewNotification?.();window.FirstHyundaiNotificationInbox?.refresh?.()",null);
                });
            });
            memoTimer.postDelayed(this,12000L);
        }
    };
    private String pendingBackup = "";
    private String pendingCatalog = "";
    private static final String ADMIN_TRIES = "firsthyundai-admin-attempts";
    // Administrator privilege is deliberately session-only; legacy saved
    // admin_mode=true from v1.1 must not bypass independent verification.
    private volatile String adminSessionIdentity = "";
    private volatile String sharedSettingsToken = "";
    private volatile boolean adminCheckInProgress = false;
    private volatile long lastMemberValidation = 0L;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TradeNotifications.ensureChannel(this);
        OfficeMemoNotifications.ensureChannel(this);
        OfficeMemoNotifications.schedule(this);
        OfficeMemoFirebase.register(this);
        web = new WebView(this);
        // Avoid a blank white WebView flash between the native FHD welcome
        // and the actual app page. Reveal only when local index has loaded.
        web.setAlpha(0f);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view,url);
                if(!"file:///android_asset/index.html".equals(url)||webFirstFrameShown)return;
                webFirstFrameShown=true;
                if(isFinishing()||isDestroyed())return;
                memoTimer.postDelayed(()->requestInitialNotificationPermission(),1600L);
                if(getIntent()!=null&&getIntent().getBooleanExtra("office_board_from_notification",false)){
                    getIntent().removeExtra("office_board_from_notification");
                    String id=getIntent().getStringExtra("office_board_note_id");
                    getIntent().removeExtra("office_board_note_id");
                    if(id!=null&&id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
                        view.evaluateJavascript("switchPage('officeBoard');window.FirstHyundaiOfficeBoard?.focusNote?.("+JSONObject.quote(id)+")",null);
                    else view.evaluateJavascript("switchPage('officeBoard')",null);
                }
                boolean motionOff=false;
                try{motionOff=Settings.Global.getFloat(getContentResolver(),
                        Settings.Global.ANIMATOR_DURATION_SCALE,1f)==0f;}
                catch(Exception ignored){}
                if(motionOff){
                    view.setAlpha(1f);
                    if(nativeHandoff!=null)nativeHandoff.finish(null);
                    return;
                }
                // Read real header geometry once DOM layout is stable; animate
                // the native branded image and text without repainting a second
                // incompatible SVG layer across Activity boundaries.
                requestBrandLanding(view,0);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeExternal(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeExternal(url);
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,
                                                         FileChooserParams params){
                if(pendingMemoImages!=null){pendingMemoImages.onReceiveValue(null);pendingMemoImages=null;}
                pendingMemoImages=callback;
                try{
                    Intent select=new Intent(Intent.ACTION_GET_CONTENT);
                    select.addCategory(Intent.CATEGORY_OPENABLE);
                    select.setType("image/*");
                    select.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                    startActivityForResult(Intent.createChooser(select,"공유 메모 사진 선택"),CHOOSE_MEMO_IMAGES);
                }catch(Exception e){
                    pendingMemoImages=null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        WebSettings s = web.getSettings();
        // Set before page load. Standard always uses 100%, independent of
        // Android system font scaling. Other modes are per-handset opt-in.
        s.setTextZoom(deviceTextZoom(localDeviceDisplayMode()));
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "FirstHyundaiNative");
        FrameLayout stage=new FrameLayout(this);
        stage.setBackgroundColor(android.graphics.Color.rgb(3,33,42));
        stage.setBackground(ThemeAppearance.background(this,true));
        stage.addView(web,new FrameLayout.LayoutParams(-1,-1));
        nativeHandoff=new SmoothBrandOverlay(this);
        stage.addView(nativeHandoff,new FrameLayout.LayoutParams(-1,-1));
        SystemBars.install(this,stage);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Wait for bundled font layout; never fly toward fallback-font metrics. */
    private void requestBrandLanding(WebView view,int attempt){
        if(isFinishing()||isDestroyed())return;
        view.evaluateJavascript(
                    "window.FirstHyundaiMotion?.nativeHeaderRects?.() ?? null",json->{
                    if(isFinishing()||isDestroyed())return;
                    float[] positions=null,metrics=null;float viewport=0f;
                    try{
                        JSONArray data=new JSONArray(json);
                        if(data.length()!=17)throw new IllegalArgumentException("header coordinates missing");
                        positions=new float[12];
                        for(int i=0;i<12;i++)positions[i]=(float)data.getDouble(i);
                        viewport=(float)data.getDouble(12);
                        metrics=new float[4];
                        for(int i=0;i<4;i++)metrics[i]=(float)data.getDouble(13+i);
                    }catch(Exception ignored){}
                    if(positions==null&&attempt<12){
                        view.postDelayed(()->requestBrandLanding(view,attempt+1),32);
                        return;
                    }
                    view.setAlpha(1f);
                    SmoothBrandOverlay overlay=nativeHandoff;
                    if(overlay==null){
                        view.evaluateJavascript("window.FirstHyundaiMotion?.finishNativeHandoff?.()",null);
                        return;
                    }
                    // Manual tap skips the animation without leaving hidden
                    // header elements or an unresponsive transparent layer.
                    final Runnable done=()->{
                        if(web==null||isFinishing()||isDestroyed()){
                            if(nativeHandoff==overlay)nativeHandoff=null;
                            overlay.detach();
                            return;
                        }
                        // Reveal the real HTML header before removing the last
                        // native logo frame; otherwise a one-frame gap makes the
                        // supposedly shared logo appear to blink.
                        web.evaluateJavascript(
                            "window.FirstHyundaiMotion?.finishNativeHandoff?.();"+
                            "window.FirstHyundaiMotion?.playEntrance?.()",ignored->{
                                if(nativeHandoff==overlay)nativeHandoff=null;
                                overlay.detach();
                            });
                        overlay.postDelayed(()->{
                            if(nativeHandoff==overlay)nativeHandoff=null;
                            overlay.detach();
                        },240);
                    };
                    overlay.setOnClickListener(v->overlay.finish(done));
                    overlay.moveToHeader(positions,viewport,metrics,view,done);
                });
    }

    private void verifyOfficeMember(boolean force){
        long now=System.currentTimeMillis();
        if(!OfficeBoardClient.enrolled(this))return;
        if(!force&&now-lastMemberValidation<60000L)return;
        lastMemberValidation=now;
        try{OfficeBoardClient.checkAccount(getApplicationContext());}
        catch(Exception e){
            if(!OfficeBoardClient.enrolled(getApplicationContext())){
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    memoTimer.removeCallbacks(memoCheck);
                    startActivity(new Intent(this,LockActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));
                    finish();
                });
            }
        }
    }
    private boolean isAdminDeviceMode() {
        return adminSessionIdentity != null && !adminSessionIdentity.isEmpty();
    }

    private void changeRole(boolean admin) {
        if(!admin){adminSessionIdentity = "";sharedSettingsToken = "";}
        // Never persist the admin session in SharedPreferences.
        // Script receives no credential or verifier.
        web.evaluateJavascript("window.onRoleChanged(" +
                (admin ? "'admin'" : "'family'") + ")", null);
    }

    @Override protected void onResume() {
        super.onResume();
        OfficeMemoNotifications.schedule(this);
        OfficeMemoFirebase.register(this);
        io.execute(()->verifyOfficeMember(true));
        memoTimer.removeCallbacks(memoCheck);
        memoTimer.post(memoCheck);
        updateNotificationPermissionUI();
        if(web!=null)web.evaluateJavascript("window.FirstHyundaiSharedSettings?.refresh?.();window.FirstHyundaiOfficeBoard?.onResume?.();window.FirstHyundaiNotificationInbox?.refresh?.();window.FirstHyundaiWeatherBriefing?.refresh?.();window.FirstHyundaiThemes?.refresh?.()",null);
        final String activeAdmin=adminSessionIdentity;
        if(activeAdmin!=null && !activeAdmin.isEmpty()) {
            io.execute(()->{
                boolean match=false;
                try {
                    match=activeAdmin.equals(AdminPolicy.fetch(MainActivity.this).identity);
                }catch(Exception ignored) {
                    // Administrator mode requires an online, current policy.
                }
                if(!match)runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    if(activeAdmin.equals(adminSessionIdentity)){
                        changeRole(false);
                        Toast.makeText(this,"관리자 정책을 확인할 수 없어 일반모드로 전환했습니다.",Toast.LENGTH_LONG).show();
                    }
                });
            });
        }
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

    /** Explicit handoff to an ordinary browser. No APK is downloaded or installed
     * by this app, so no install-packages permission is required.
     */
    private void openOfficialUpdateInBrowser(String url){
        if(!AppUpdate.allowedDownload(url))return;
        runOnUiThread(()->{
            if(isFinishing()||isDestroyed())return;
            try{
                Intent open=new Intent(Intent.ACTION_VIEW,Uri.parse(url));
                startActivity(open);
                deliver("onFirstHyundaiAppUpdateProgress",
                    AppUpdateInstaller.event("external",100,
                        "공식 GitHub 다운로드를 브라우저에서 엽니다. 보안 경고가 나오면 설치를 중단해 주세요."));
            }catch(Exception e){
                deliver("onFirstHyundaiAppUpdateProgress",
                    AppUpdateInstaller.event("error",-1,
                        "브라우저를 열지 못했습니다. 공식 배포 페이지를 확인해 주세요."));
            }
        });
    }

    @Override protected void onPause() {
        memoTimer.removeCallbacks(memoCheck);
        super.onPause();
    }

    private void updateNotificationPermissionUI() {
        if (web == null || isFinishing() || isDestroyed()) return;
        web.evaluateJavascript("window.FirstHyundaiTradeAlerts?.syncNativeStatus?.();window.FirstHyundaiOfficeBoard?.syncNotificationStatus?.();window.FirstHyundaiNotificationInbox?.refresh?.()", null);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                                     int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == TradeNotifications.REQUEST_PERMISSION || requestCode == OfficeMemoNotifications.PERMISSION) {
            updateNotificationPermissionUI();
        }
    }

    private void showAdminCodeDialog() {
        if(isAdminDeviceMode() || adminCheckInProgress)return;
        SharedPreferences tries=getSharedPreferences(ADMIN_TRIES,MODE_PRIVATE);
        long now=System.currentTimeMillis();
        if(now<tries.getLong("locked_until",0L)) {
            new AlertDialog.Builder(this)
                    .setMessage("관리자 비밀번호를 여러 번 틀렸습니다. 1분 후 다시 시도해 주세요.")
                    .setPositiveButton("확인",null).show();
            return;
        }

        EditText field=new EditText(this);
        field.setSingleLine(true);
        field.setHint("관리자 전용 비밀번호");
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        field.setPadding(32,24,32,24);
        new AlertDialog.Builder(this)
                .setTitle("관리자 전환")
                .setMessage("가족 로그인 코드와는 다른 관리자 전용 비밀번호를 입력하세요. 이 비밀번호가 등록되지 않았다면 GitHub 비공개 Secret을 먼저 설정해야 합니다.")
                .setView(field)
                .setNegativeButton("취소",null)
                .setPositiveButton("확인",(dialog,which)->{
                    if(adminCheckInProgress)return;
                    char[] code=field.getText().toString().trim().toCharArray();
                    field.setText("");
                    if(code.length==0) {
                        Arrays.fill(code,(char)0);
                        return;
                    }
                    adminCheckInProgress=true;
                    AlertDialog waiting=new AlertDialog.Builder(this)
                            .setMessage("관리자 비밀번호를 온라인으로 확인하고 있습니다...")
                            .setCancelable(false).create();
                    waiting.show();
                    io.execute(()->{
                        boolean valid=false;
                        String error="";
                        String identity="";
                        String syncToken="";
                        try {
                            AdminPolicy.Data policy=AdminPolicy.fetch(MainActivity.this);
                            valid=AdminPolicy.matches(policy,code);
                            identity=policy.identity;
                            if(valid){
                                try{syncToken=SharedSettingsClient.authorize(code);}
                                catch(Exception ignored){/* Admin UI still available while KV server is down. */}
                            }
                        }catch(Exception e){
                            error=e.getMessage()==null?"관리자 보안 정책을 확인할 수 없습니다.":e.getMessage();
                        }finally {
                            Arrays.fill(code,(char)0);
                        }
                        final boolean success=valid;
                        final String errorMessage=error;
                        final String verifiedIdentity=identity;
                        final String verifiedSyncToken=syncToken;
                        runOnUiThread(()->{
                            waiting.dismiss();
                            adminCheckInProgress=false;
                            if(isFinishing()||isDestroyed())return;
                            if(success){
                                tries.edit().clear().apply();
                                adminSessionIdentity=verifiedIdentity;
                                sharedSettingsToken=verifiedSyncToken;
                                changeRole(true);
                                web.evaluateJavascript("window.FirstHyundaiSharedSettings?.authReady?.("+
                                  (verifiedSyncToken.isEmpty()?"false":"true")+")",null);
                            }else {
                                String message;
                                if(!errorMessage.isEmpty()) {
                                    message=errorMessage;
                                }else {
                                    int attempts=tries.getInt("attempts",0)+1;
                                    if(attempts>=5) {
                                        tries.edit().putInt("attempts",0)
                                                .putLong("locked_until",System.currentTimeMillis()+60000L).apply();
                                        message="관리자 비밀번호가 5회 틀렸습니다. 1분 동안 잠깁니다.";
                                    }else {
                                        tries.edit().putInt("attempts",attempts).apply();
                                        message="관리자 비밀번호가 올바르지 않습니다. ("+attempts+"/5)";
                                    }
                                }
                                new AlertDialog.Builder(this).setMessage(message)
                                        .setPositiveButton("확인",null).show();
                            }
                        });
                    });
                }).show();
    }

    private boolean routeExternal(String url) {
        if ("file:///android_asset/index.html".equals(url)) return false;
        Uri uri = Uri.parse(url);
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
        } else if ("tel".equalsIgnoreCase(uri.getScheme())) {
            String number=uri.getSchemeSpecificPart();
            // Public apartment management-office number only; open dial pad, never call automatically.
            if(number!=null && number.matches("[+0-9-]{7,22}")) {
                try { startActivity(new Intent(Intent.ACTION_DIAL, uri)); } catch (Exception ignored) {}
            }
        }
        // allow no navigation to untrusted content inside JavascriptInterface-bearing WebView
        return true;
    }

    private void deliver(String name, JSONObject data) {
        runOnUiThread(() -> web.evaluateJavascript("window."+name+"("+data.toString()+")", null));
    }

    private void sharedSettingsDenied(String requestId,String message){
        try{deliver("onFirstHyundaiSharedSettingsPublished",new JSONObject()
                .put("requestId",requestId).put("ok",false).put("error",message));}
        catch(Exception ignored){}
    }

    private void officeBoardLoginDialog(){
        if(isFinishing()||isDestroyed())return;
        new AlertDialog.Builder(this)
            .setTitle("사무실 구성원 계정")
            .setMessage("계정 선택은 설치 후 최초 인증 화면에서 한 번만 진행합니다. 사무실 공통 보안코드는 관리자만 입력하면 됩니다.")
            .setNegativeButton("닫기",null)
            .setPositiveButton("계정 연결하기",(dialog,which)->{
                startActivity(new Intent(this,LockActivity.class));
                finish();
            }).show();
    }

    public final class Bridge {
        @JavascriptInterface public String getDeviceDisplayMode() {
            return localDeviceDisplayMode();
        }
        @JavascriptInterface public boolean setDeviceDisplayMode(String mode) {
            if(!validDeviceDisplayMode(mode))return false;
            boolean saved=getSharedPreferences(DEVICE_DISPLAY_PREF,MODE_PRIVATE).edit()
                .putString(DEVICE_DISPLAY_KEY,mode).commit();
            if(!saved)return false;
            runOnUiThread(()->{
                if(web==null||isFinishing()||isDestroyed())return;
                web.getSettings().setTextZoom(deviceTextZoom(mode));
                web.evaluateJavascript(
                    "requestAnimationFrame(()=>window.FirstHyundaiNavCollapse?.update?.(true))",null);
            });
            return true;
        }
        @JavascriptInterface public String getNotificationHistory(){
            return NotificationHistory.list(getApplicationContext());
        }
        @JavascriptInterface public void markNotificationHistoryRead(){
            NotificationHistory.markRead(getApplicationContext());
        }
        @JavascriptInterface public void clearNotificationHistory(){
            NotificationHistory.clear(getApplicationContext());
        }
        @JavascriptInterface public String getOfficeMemoPushStatus(){
            return OfficeMemoFirebase.status(getApplicationContext());
        }
        @JavascriptInterface public String getOfficeMemoNotificationStatus(){
            return OfficeMemoNotifications.status(MainActivity.this);
        }
        @JavascriptInterface public void requestOfficeMemoNotifications(){
            runOnUiThread(()->{
                OfficeMemoNotifications.requestPermission(MainActivity.this);
                updateNotificationPermissionUI();
            });
        }
        @JavascriptInterface public void setOfficeMemoNotificationsEnabled(boolean enabled){
            OfficeMemoNotifications.setEnabled(getApplicationContext(),enabled);
            runOnUiThread(()->updateNotificationPermissionUI());
        }
        @JavascriptInterface public String getTradeNotificationPermissionStatus() {
            return TradeNotifications.status(MainActivity.this);
        }
        @JavascriptInterface public void requestTradeNotificationPermission() {
            runOnUiThread(() -> {
                TradeNotifications.requestPermission(MainActivity.this);
                updateNotificationPermissionUI();
            });
        }
        @JavascriptInterface public void postFavoriteTradeNotification(int count, String detail, String snapshotJson) {
            if (count < 1 || count > 100 || detail == null || detail.length() > 240 ||
                    snapshotJson == null || snapshotJson.length() > 48000) return;
            runOnUiThread(() -> TradeNotifications.post(MainActivity.this, count, detail, snapshotJson));
        }
        @JavascriptInterface public String getInstalledAppVersion() {
            return AppVersion.name(MainActivity.this);
        }
        @JavascriptInterface public int getInstalledAppBuildNumber() {
            return AppVersion.buildNumber(MainActivity.this);
        }
        @JavascriptInterface public void checkForAppUpdate() {
            if(updateDownloading||!updateChecking.compareAndSet(false,true))return;
            verifiedUpdateUrl="";
            io.execute(()->{
                try{
                JSONObject check=AppUpdate.check(MainActivity.this);
                verifiedUpdateUrl=check.optBoolean("available",false)
                    ?check.optString("downloadUrl",""):"";
                deliver("onFirstHyundaiAppUpdate",check);
                }finally{updateChecking.set(false);}
            });
        }
        @JavascriptInterface public void downloadAndInstallVerifiedAppUpdate() {
            // Kept for backward compatibility with the existing app UI.
            // Never download APK bytes, open a package installer, or grant installation privileges.
            String url=verifiedUpdateUrl;
            if(!AppUpdate.allowedDownload(url))return;
            openOfficialUpdateInBrowser(url);
        }
        @JavascriptInterface public String getMode() {
            return isAdminDeviceMode() ? "admin" : "family";
        }
        @JavascriptInterface public int getPolicyVersion() {
            return AccessPolicy.currentVersion(MainActivity.this);
        }
        @JavascriptInterface public void requestAdminAccess() {
            runOnUiThread(() -> showAdminCodeDialog());
        }
        @JavascriptInterface public void switchToFamilyMode() {
            runOnUiThread(() -> changeRole(false));
        }
        @JavascriptInterface public String getOfficeMemberName(){
            return OfficeBoardClient.memberName(getApplicationContext());
        }
        @JavascriptInterface public void requestOfficeMemberPicker(){
            final String authorized=adminSessionIdentity;
            runOnUiThread(()->{
                if(authorized==null||authorized.isEmpty()||!authorized.equals(adminSessionIdentity)){
                    Toast.makeText(MainActivity.this,"계정 변경은 관리자모드에서만 가능합니다.",Toast.LENGTH_LONG).show();
                    return;
                }
                Intent select=new Intent(MainActivity.this,LockActivity.class);
                select.putExtra("force_member_picker",true);
                startActivity(select);
                finish();
            });
        }
        @JavascriptInterface public void officeMembersAction(String action,String payload,String requestId){
            if(requestId==null||!requestId.matches("[A-Za-z0-9_-]{1,30}"))return;
            if(action==null||!java.util.Arrays.asList("list","add","remove","rename").contains(action)||
                payload==null||payload.length()>600)return;
            final String identity=adminSessionIdentity,admin=sharedSettingsToken;
            io.execute(()->{
                JSONObject event=new JSONObject();
                try{
                    if(identity==null||identity.isEmpty()||!identity.equals(adminSessionIdentity)||
                        admin==null||admin.isEmpty())throw new Exception("관리자모드에서 다시 인증해 주세요.");
                    JSONObject data=OfficeBoardClient.members(getApplicationContext(),action,new JSONObject(payload),admin);
                    event.put("requestId",requestId).put("ok",true).put("data",data);
                }catch(Exception e){try{event.put("requestId",requestId).put("ok",false)
                    .put("error",e.getMessage()==null?"계정 관리 오류":e.getMessage());}
                    catch(Exception ignored){}}
                deliver("onFirstHyundaiOfficeMembersResult",event);
            });
        }
        @JavascriptInterface public void requestOfficeBoardAccess() {
            runOnUiThread(()->officeBoardLoginDialog());
        }
        @JavascriptInterface public void officeBoardAction(String action,String payload,String requestId){
            if(requestId==null||!requestId.matches("[A-Za-z0-9_-]{1,30}"))return;
            if(action==null||!java.util.Arrays.asList("list","post","edit","done","schedule","delete","archive","restore",
                "imageAdd","imageGet","imageRemove").contains(action)||payload==null||
               payload.length()>("imageAdd".equals(action)?200000:3000))return;
            final boolean needsAdmin="delete".equals(action)||"restore".equals(action)||"archive".equals(action);
            final String adminIdentity=adminSessionIdentity;
            final String adminToken=sharedSettingsToken;
            io.execute(()->{
                JSONObject event=new JSONObject();
                try{
                    if(needsAdmin&&(adminIdentity==null||adminIdentity.isEmpty()||
                         !adminIdentity.equals(adminSessionIdentity)||adminToken==null||adminToken.isEmpty()))
                        throw new Exception("메모 삭제와 복구는 관리자모드에서만 가능합니다. 관리자모드로 로그인해 주세요.");
                    JSONObject incoming=new JSONObject(payload);
                    JSONObject data=OfficeBoardClient.perform(getApplicationContext(),action,incoming,needsAdmin?adminToken:null);
                    event.put("requestId",requestId).put("ok",true).put("data",data);
                }catch(Exception e){
                    try{event.put("requestId",requestId).put("ok",false)
                        .put("needsAuth",!OfficeBoardClient.enrolled(getApplicationContext()))
                        .put("error",e.getMessage()==null?"메모 공유 연결 실패":e.getMessage());}
                    catch(Exception ignored){}
                }
                deliver("onFirstHyundaiOfficeBoardResult",event);
            });
        }
        @JavascriptInterface public void fetchSharedSettings(String requestId) {
            if(requestId==null||!requestId.matches("[A-Za-z0-9_-]{1,30}"))return;
            io.execute(()->{
                JSONObject response=new JSONObject();
                try{
                    response.put("requestId",requestId).put("ok",true)
                            .put("payload",SharedSettingsClient.read());
                }catch(Exception e){
                    try{response.put("requestId",requestId).put("ok",false)
                            .put("error","공통 설정 서버를 확인할 수 없습니다.");}
                    catch(Exception ignored){}
                }
                deliver("onFirstHyundaiSharedSettingsFetched",response);
            });
        }
        @JavascriptInterface public void cacheThemeAppearance(String json) {
            ThemeAppearance.cache(getApplicationContext(),json);
        }
        @JavascriptInterface public void fetchWeatherBriefing(String requestId) {
            if(requestId==null || !requestId.matches("forecast[0-9]{1,10}"))return;
            io.execute(() -> {
                JSONObject response=new JSONObject();
                try {response.put("requestId",requestId).put("payload",SharedSettingsClient.readWeatherBriefing()).put("ok",true);}
                catch(Exception e){try{response.put("requestId",requestId).put("ok",false);}catch(Exception ignored){}}
                deliver("onFirstHyundaiWeatherBriefingFetched",response);
            });
        }
        @JavascriptInterface public void fetchThemeWeather(String requestId) {
            if(requestId==null || !requestId.matches("theme[0-9]{1,10}"))return;
            io.execute(() -> {
                JSONObject response=new JSONObject();
                try {
                    response.put("requestId",requestId);
                    response.put("payload",SharedSettingsClient.readWeather());
                    response.put("ok",true);
                } catch(Exception e) {
                    try {response.put("requestId",requestId);response.put("ok",false);}catch(Exception ignored){}
                }
                deliver("onFirstHyundaiThemeWeatherFetched",response);
            });
        }
        @JavascriptInterface public void publishSharedSettings(String json,String requestId) {
            if(requestId==null||!requestId.matches("[A-Za-z0-9_-]{1,30}"))return;
            if(!isAdminDeviceMode()||json==null||json.length()>2400){
                sharedSettingsDenied(requestId,"관리자 인증 또는 공통 설정 데이터가 올바르지 않습니다.");
                return;
            }
            final String identity=adminSessionIdentity;
            final String token=sharedSettingsToken;
            io.execute(()->{
                JSONObject response=new JSONObject();
                try{
                    if(token.isEmpty()||!identity.equals(adminSessionIdentity))
                        throw new Exception("공통 설정 게시 인증이 필요합니다. 관리자모드에 다시 로그인해 주세요.");
                    JSONObject payload=SharedSettingsClient.publish(token,json);
                    if(!identity.equals(adminSessionIdentity))
                        throw new Exception("관리자 인증 상태가 변경됐습니다.");
                    response.put("requestId",requestId).put("ok",true).put("payload",payload);
                }catch(Exception e){
                    try{response.put("requestId",requestId).put("ok",false)
                            .put("error",e.getMessage()==null?"공통 설정 게시 실패":e.getMessage());}
                    catch(Exception ignored){}
                }
                deliver("onFirstHyundaiSharedSettingsPublished",response);
            });
        }
        @JavascriptInterface public void fetch(String repository, String filename, String requestId) {
            // Public data ONLY. Never inject API tokens / family records into remote requests.
            if (repository==null || !repository.matches("[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.-]{1,100}") ||
                    !("trades.json".equals(filename) || "new_trades.json".equals(filename) || "news.json".equals(filename) || "complexes.json".equals(filename) || "public_services.json".equals(filename) || "school_districts.json".equals(filename) || "nearby_config.json".equals(filename))) {
                deliverFeed(requestId, false, "저장소 주소 또는 파일명이 올바르지 않습니다.", null);
                return;
            }
            io.execute(() -> {
                HttpURLConnection conn = null;
                try {
                    // branch fixed to main; HTTPS host fixed to raw.githubusercontent.com
                    // Raw GitHub files and cellular proxies may cache old snapshots.
                    // Always ask the origin for the current published JSON, not
                    // a local/WebView/CDN-cached version of the previous request.
                    String address = "https://raw.githubusercontent.com/"+repository+"/main/data/"+filename
                            +"?refresh="+System.currentTimeMillis()+"-"+requestId;
                    conn=(HttpURLConnection)new URL(address).openConnection();
                    conn.setUseCaches(false);
                    conn.setDefaultUseCaches(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                    conn.setRequestProperty("Pragma", "no-cache");
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
        @JavascriptInterface public void fetchNearby(String workerUrl, String complexId, String category, String requestId) {
            // Server-side Kakao API proxy only. Kakao REST key never enters Android.
            // Keep this exact allowlist in sync with data/nearby_config.json and
            // workers/kakao-nearby/wrangler.toml (name=firsthyundai-nearby).
            if(workerUrl==null || !"https://firsthyundai-nearby.jwj2477.workers.dev".equals(workerUrl) ||
                    complexId==null || !complexId.matches("[A-Za-z0-9_-]{1,64}") ||
                    category==null || !category.matches("(SC4|PS3|HP8|PM9|MT1|CS2|SW8|BK9|CE7|AC5)")) {
                deliverFeed(requestId,false,"주변시설 서비스 주소 또는 요청 형식이 잘못되었습니다.",null);
                return;
            }
            io.execute(() -> {
                HttpURLConnection conn=null;
                try {
                    String address=workerUrl+"/nearby?complex="+complexId+"&category="+category;
                    conn=(HttpURLConnection)new URL(address).openConnection();
                    conn.setUseCaches(false);
                    conn.setConnectTimeout(12000);
                    conn.setReadTimeout(16000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("Accept","application/json");
                    conn.setRequestProperty("Cache-Control","no-store");
                    int status=conn.getResponseCode();
                    if(status!=200)throw new Exception(status==429?"잠시 후 다시 조회해 주세요.":"주변시설 조회 오류 HTTP "+status);
                    ByteArrayOutputStream out=new ByteArrayOutputStream();
                    try(InputStream in=conn.getInputStream()) {
                        byte[] buffer=new byte[4096]; int n;
                        while((n=in.read(buffer))!=-1) {
                            out.write(buffer,0,n);
                            if(out.size()>50000)throw new Exception("주변시설 응답 크기 초과");
                        }
                    }
                    JSONObject payload=new JSONObject(out.toString("UTF-8"));
                    if(payload.optInt("schema_version")!=1)
                        throw new Exception("주변시설 자료 형식 오류");
                    deliverFeed(requestId,true,"",payload);
                }catch(Exception e){
                    deliverFeed(requestId,false,e.getMessage()==null?"주변시설 서버 연결 실패":e.getMessage(),null);
                }finally{if(conn!=null)conn.disconnect();}
            });
        }
        @JavascriptInterface public void copyContract(String text) {
            if(text==null || text.isEmpty() || text.length()>20000)return;
            runOnUiThread(() -> {
                ClipboardManager clipboard=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
                if(clipboard==null)return;
                clipboard.setPrimaryClip(ClipData.newPlainText("퍼스트현대 계약 안내",text));
                Toast.makeText(MainActivity.this,"계약문자를 복사했습니다.",Toast.LENGTH_SHORT).show();
            });
        }
        @JavascriptInterface public void shareContract(String text) {
            if(text==null || text.isEmpty() || text.length()>20000)return;
            runOnUiThread(() -> {
                Intent send=new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT,text);
                try {
                    startActivity(Intent.createChooser(send,"계약문자 공유할 앱 선택"));
                } catch(Exception e) {
                    Toast.makeText(MainActivity.this,"공유할 앱을 찾지 못했습니다.",Toast.LENGTH_SHORT).show();
                }
            });
        }
        @JavascriptInterface public void shareContractImages(String imageJson) {
            ContractImageShare.share(MainActivity.this, imageJson);
        }
        @JavascriptInterface public void startContractDictation() {
            runOnUiThread(() -> {
                Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ko-KR");
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"계약 조건 메모를 말해 주세요");
                try {
                    startActivityForResult(intent,DICTATE_CONTRACT);
                } catch(Exception e) {
                    Toast.makeText(MainActivity.this,"사용 가능한 음성인식 서비스가 없습니다.",Toast.LENGTH_LONG).show();
                }
            });
        }
        @JavascriptInterface public void saveBackup(String json) {
            if(!isAdminDeviceMode() || json==null || json.length()>2_000_000)return;
            pendingBackup=json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.setType("application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE,"firsthyundai-notes-backup.json");
                startActivityForResult(intent,SAVE_BACKUP);
            });
        }

        @JavascriptInterface public void saveCatalog(String json) {
            // Only an authenticated administrator can export public catalog data.
            // No GitHub write token, personal notes or passwords are included.
            if(!isAdminDeviceMode() || json==null || json.length()>1_000_000)return;
            try {
                JSONObject source=new JSONObject(json);
                if(source.optInt("schema_version",-1)!=1 || source.optJSONArray("records")==null ||
                    source.getJSONArray("records").length()>500) return;
            } catch(Exception e) {return;}
            runOnUiThread(() -> {
                pendingCatalog=json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.setType("application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE,"complexes.json");
                startActivityForResult(intent,SAVE_CATALOG);
            });
        }
        @JavascriptInterface public void openBackup() {
            if(!isAdminDeviceMode())return;
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
        if(request==CHOOSE_MEMO_IMAGES){
            ValueCallback<Uri[]> callback=pendingMemoImages;
            pendingMemoImages=null;
            if(callback!=null){
                ArrayList<Uri> selected=new ArrayList<>();
                if(result==RESULT_OK&&data!=null){
                    if(data.getClipData()!=null){
                        ClipData clips=data.getClipData();
                        for(int i=0;i<Math.min(3,clips.getItemCount());i++){
                            Uri uri=clips.getItemAt(i).getUri();
                            if(uri!=null&&"content".equals(uri.getScheme()))selected.add(uri);
                        }
                    }else if(data.getData()!=null&&"content".equals(data.getData().getScheme()))
                        selected.add(data.getData());
                }
                callback.onReceiveValue(selected.isEmpty()?null:selected.toArray(new Uri[0]));
            }
            return;
        }
        if(request==DICTATE_CONTRACT) {
            JSONObject response=new JSONObject();
            try {
                ArrayList<String> matches=data==null?null:data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                boolean ok=result==RESULT_OK && matches!=null && !matches.isEmpty();
                response.put("ok",ok);
                response.put("cancelled",result!=RESULT_OK);
                response.put("text",ok?matches.get(0):"");
            }catch(Exception ignored){}
            deliver("firstHyundaiContractSpeech",response);
            return;
        }
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
        } else if(request==SAVE_CATALOG) {
            String catalog=pendingCatalog;pendingCatalog="";
            io.execute(() -> {
                try(OutputStream os=getContentResolver().openOutputStream(uri)) {
                    if(os==null)throw new Exception("파일 저장 실패");
                    os.write(catalog.getBytes(StandardCharsets.UTF_8));
                    JSONObject o=new JSONObject();o.put("ok",true);deliver("onCatalogSaved",o);
                } catch(Exception e) {
                    try {JSONObject o=new JSONObject();o.put("ok",false);deliver("onCatalogSaved",o);}
                    catch(Exception ignored){}
                }
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
    @Override protected void onDestroy(){
        if(pendingMemoImages!=null){pendingMemoImages.onReceiveValue(null);pendingMemoImages=null;}
        memoTimer.removeCallbacks(memoCheck);io.shutdownNow();if(nativeHandoff!=null){nativeHandoff.finish(null);nativeHandoff=null;}if(web!=null)web.destroy();super.onDestroy();}
    @Override public void onBackPressed() {
        if(web==null) {super.onBackPressed();return;}
        // Close the native-feeling apartment detail screen before leaving the app.
        // evaluateJavascript is asynchronous; do not navigate the WebView until
        // its return value confirms that JavaScript did not handle Back.
        web.evaluateJavascript(
                "Boolean(window.firstHyundaiGoBack && window.firstHyundaiGoBack())",
                result -> {
                    if("true".equals(result))return;
                    if(web.canGoBack())web.goBack();
                    else MainActivity.super.onBackPressed();
                });
    }
}


