package kr.co.firsthyundai.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Properties;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Lightweight offline first-launch access check for the three-family-member app.
 * Prevents casual opening of an APK but is not a remotely revocable license.
 */
public class LockActivity extends Activity {
    private AccessPolicy.Policy currentPolicy;
    private EditText codeField;
    private TextView status;
    private Button unlockButton;
    private Button retryButton;
    private static final String PREFS = "firsthyundai_access_attempts";
    private FrameLayout welcomeOverlay;
    private final Handler welcomeHandler = new Handler(Looper.getMainLooper());
    private Runnable dismissWelcome;
    private boolean welcomeDone = false;
    private boolean openAfterWelcome = false;
    private boolean policyPending = true;
    private boolean welcomeElapsed = false;
    private boolean introSkipped = false;

    private int dp(int v) { return (int) (getResources().getDisplayMetrics().density * v + 0.5f); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(240, 248, 246));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(26), dp(32), dp(26), dp(36));
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("퍼스트현대");
        title.setTextSize(30);
        title.setTextColor(Color.rgb(24, 69, 76));
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, 1);
        root.addView(title);

        TextView detail = new TextView(this);
        detail.setText("가족 전용 부동산 정보센터\n접근 보안코드를 입력해 주세요.");
        detail.setTextSize(17);
        detail.setTextColor(Color.rgb(77, 94, 111));
        detail.setGravity(Gravity.CENTER);
        detail.setPadding(0, dp(18), 0, dp(26));
        root.addView(detail);

        codeField = new EditText(this);
        codeField.setSingleLine(true);
        codeField.setHint("가족 보안코드");
        codeField.setTextSize(18);
        codeField.setContentDescription("가족 보안코드 입력칸");
        codeField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        LinearLayout.LayoutParams inputParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60));
        root.addView(codeField, inputParams);

        Button unlock = new Button(this);
        unlockButton = unlock;
        unlock.setAllCaps(false);
        unlock.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(17, 106, 113)));
        unlock.setTextColor(Color.WHITE);
        unlock.setText("인증하고 앱 열기");
        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        buttonParams.topMargin = dp(16);
        root.addView(unlock, buttonParams);

        status = new TextView(this);
        status.setTextSize(15);
        status.setTextColor(Color.rgb(142, 53, 45));
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(14), 0, 0);
        root.addView(status);

        retryButton = new Button(this);
        retryButton.setAllCaps(false);
        retryButton.setTextSize(16);
        retryButton.setMinHeight(dp(52));
        retryButton.setText("연결 다시 확인");
        retryButton.setVisibility(android.view.View.GONE);
        root.addView(retryButton);

        TextView foot = new TextView(this);
        foot.setText("처음 한 번 인증하면 이후에는 자동으로 열립니다.\n"
                + "관리자가 보안코드를 변경하면 다시 인증해야 합니다.\n"
                + "보안 확인에 인터넷이 필요하며 최근 확인한 정책은 24시간 동안 오프라인 이용 가능합니다.");
        foot.setTextSize(14);
        foot.setGravity(Gravity.CENTER);
        foot.setTextColor(Color.rgb(77, 99, 108));
        foot.setPadding(0, dp(32), 0, 0);
        root.addView(foot);

        TextView installedVersion = new TextView(this);
        String installedName = AppVersion.name(this);
        int installedBuild = AppVersion.buildNumber(this);
        installedVersion.setText(installedName.isEmpty() ? "설치된 앱 버전 확인 불가" :
                "설치된 앱 v" + installedName + (installedBuild > 0 ? " · 빌드 " + installedBuild : ""));
        installedVersion.setTextSize(13);
        installedVersion.setGravity(Gravity.CENTER);
        installedVersion.setTextColor(Color.rgb(79, 99, 107));
        installedVersion.setPadding(0, dp(14), 0, 0);
        root.addView(installedVersion);

        codeField.setEnabled(false);
        unlock.setEnabled(false);
        status.setText("최신 가족 보안 정책을 확인하는 중...");
        unlock.setOnClickListener(v -> unlock());
        retryButton.setOnClickListener(v -> loadLatestPolicy());
        FrameLayout stage = new FrameLayout(this);
        stage.addView(scroll,new FrameLayout.LayoutParams(-1,-1));
        SystemBars.install(this,stage);
        showWelcome(stage);
        loadLatestPolicy();
    }

    /** Native cold-start welcome; never bypasses access policy or authentication. */
    private void showWelcome(FrameLayout stage) {
        welcomeOverlay = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(3,33,42),Color.rgb(9,91,94)});
        welcomeOverlay.setBackground(background);
        welcomeOverlay.setClickable(true);
        welcomeOverlay.setContentDescription("퍼스트현대 시작 화면. 누르면 건너뛰기");
        LinearLayout identity=new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        identity.setGravity(Gravity.CENTER);
        // Preserve the exact approved FHD/FIRST badge. Animate only its wrapper;
        // the brand artwork itself is never stretched, recolored or replaced.
        FrameLayout emblemFrame=new FrameLayout(this);
        emblemFrame.setClipChildren(false);
        emblemFrame.setClipToPadding(false);
        View haloRing=new View(this);
        GradientDrawable ringDrawable=new GradientDrawable();
        ringDrawable.setShape(GradientDrawable.OVAL);
        ringDrawable.setColor(Color.TRANSPARENT);
        ringDrawable.setStroke(dp(1),Color.argb(115,230,186,95));
        haloRing.setBackground(ringDrawable);
        emblemFrame.addView(haloRing,new FrameLayout.LayoutParams(
                dp(168),dp(168),Gravity.CENTER));
        ImageView emblem=new ImageView(this);
        emblem.setImageResource(R.drawable.ic_launcher_badge);
        emblem.setContentDescription("원본 FHD FIRST 로고");
        emblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        emblemFrame.addView(emblem,new FrameLayout.LayoutParams(
                dp(144),dp(144),Gravity.CENTER));
        identity.addView(emblemFrame,new LinearLayout.LayoutParams(dp(190),dp(190)));
        TextView title=new TextView(this);
        BrandIdentityStyle.title(title);
        LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(-2,-2);
        titleParams.topMargin=dp(12);
        identity.addView(title,titleParams);
        View goldRule=new View(this);
        GradientDrawable ruleBackground=new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.argb(0,217,173,92),Color.rgb(238,201,126),
                        Color.argb(0,217,173,92)});
        goldRule.setBackground(ruleBackground);
        LinearLayout.LayoutParams ruleParams=new LinearLayout.LayoutParams(dp(96),dp(2));
        ruleParams.gravity=Gravity.CENTER_HORIZONTAL;
        ruleParams.topMargin=dp(14);
        identity.addView(goldRule,ruleParams);
        ImageView subtitle=new ImageView(this);
        BrandIdentityStyle.subtitle(subtitle);
        LinearLayout.LayoutParams subtitleParams=BrandIdentityStyle.subtitleLayout(subtitle);
        subtitleParams.topMargin=dp(13);
        identity.addView(subtitle,subtitleParams);
        welcomeOverlay.addView(identity,new FrameLayout.LayoutParams(-1,-2,Gravity.CENTER));
        stage.addView(welcomeOverlay,new FrameLayout.LayoutParams(-1,-1));
        boolean reducedMotion=false;
        try{reducedMotion=Settings.Global.getFloat(getContentResolver(),
                Settings.Global.ANIMATOR_DURATION_SCALE,1f)==0f;}
        catch(Exception ignored){}
        if(!reducedMotion){
            // Short, staggered brand reveal; no spinner, artificial network wait
            // or animation of any unlock/access controls.
            emblemFrame.setAlpha(0f);
            emblemFrame.setTranslationY(dp(11));
            emblemFrame.setScaleX(.94f);emblemFrame.setScaleY(.94f);
            haloRing.setAlpha(0f);
            haloRing.setScaleX(.91f);haloRing.setScaleY(.91f);
            title.setAlpha(0f);
            title.setTranslationY(dp(7));
            goldRule.setScaleX(0f);
            subtitle.setAlpha(0f);
            subtitle.setTranslationY(dp(5));
            emblemFrame.animate().alpha(1f).translationY(0f)
                    .scaleX(1f).scaleY(1f).setDuration(410)
                    .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
            haloRing.animate().alpha(1f).scaleX(1.07f).scaleY(1.07f)
                    .setStartDelay(125).setDuration(570).start();
            title.animate().alpha(1f).translationY(0f)
                    .setStartDelay(185).setDuration(325).start();
            goldRule.animate().scaleX(1f)
                    .setStartDelay(320).setDuration(380).start();
            subtitle.animate().alpha(1f).translationY(0f)
                    .setStartDelay(360).setDuration(330).start();
        }
        dismissWelcome=()->{welcomeElapsed=true;finishWelcome();};
        welcomeHandler.postDelayed(dismissWelcome,reducedMotion?0:920);
        welcomeOverlay.setOnClickListener(v->{introSkipped=true;finishWelcome();});
    }

    private void finishWelcome() {
        if(welcomeDone)return;
        // Never briefly show the security-code page while an already
        // authorized family's policy is still being checked. Keep the actual
        // FHD brand visible and hand it directly to the next Activity.
        if(policyPending&&!introSkipped&&!openAfterWelcome)return;
        welcomeDone=true;
        if(dismissWelcome!=null)welcomeHandler.removeCallbacks(dismissWelcome);
        FrameLayout overlay=welcomeOverlay;
        welcomeOverlay=null;
        if(overlay!=null && openAfterWelcome){
            // Keep the original FHD image visible until Main's shared brand
            // overlay takes over. Never expose the underlying login screen.
            openMain();
            return;
        }
        if(overlay!=null){
            overlay.animate().cancel();
            overlay.animate().alpha(0f).setDuration(150).withEndAction(()->{
                if(overlay.getParent() instanceof ViewGroup)
                    ((ViewGroup)overlay.getParent()).removeView(overlay);
            }).start();
        }
        if(openAfterWelcome)openMain();
    }

    private void openMain() {
        if(!welcomeDone){openAfterWelcome=true;return;}
        if(isFinishing() || isDestroyed()) return;
        Intent open=new Intent(this,MainActivity.class);
        if(getIntent()!=null&&getIntent().getBooleanExtra("office_board_from_notification",false)){
            open.putExtra("office_board_from_notification",true);
            String id=getIntent().getStringExtra("office_board_note_id");
            if(id!=null&&id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
                open.putExtra("office_board_note_id",id);
        }
        startActivity(open);
        overridePendingTransition(0,0);
        finish();
    }

    private void showAccountChoices(char[] code) {
        status.setText("등록된 사무실 계정을 확인하는 중입니다.");
        unlockButton.setEnabled(false);
        new Thread(()->{
            org.json.JSONArray accounts=null;
            String error="";
            try{accounts=OfficeBoardClient.choices(getApplicationContext(),code).getJSONArray("accounts");}
            catch(Exception e){error=e.getMessage()==null?"계정 목록을 불러올 수 없습니다.":e.getMessage();}
            final org.json.JSONArray list=accounts;
            final String failure=error;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed()){Arrays.fill(code,(char)0);return;}
                unlockButton.setEnabled(true);
                if(list==null||list.length()==0){
                    Arrays.fill(code,(char)0);
                    status.setText(failure.isEmpty()?"계정이 없습니다. 관리자에게 문의해 주세요.":failure);
                    return;
                }
                java.util.ArrayList<String> labels=new java.util.ArrayList<>();
                java.util.ArrayList<String> ids=new java.util.ArrayList<>();
                for(int i=0;i<list.length();i++){
                    org.json.JSONObject x=list.optJSONObject(i);
                    if(x==null)continue;
                    String id=x.optString("id","");
                    if(!id.matches("[0-9a-f-]{36}"))continue;
                    ids.add(id);labels.add(x.optString("name","구성원"));
                }
                if(ids.isEmpty()){Arrays.fill(code,(char)0);status.setText("계정이 없습니다.");return;}
                new android.app.AlertDialog.Builder(this)
                    .setTitle("사용할 계정을 선택해 주세요")
                    .setMessage("처음 한 번 선택하면 이 휴대폰의 계정으로 유지됩니다.")
                    .setSingleChoiceItems(labels.toArray(new String[0]),-1,(dialog,which)->{
                        dialog.dismiss();
                        String chosen=ids.get(which);
                        status.setText("사무실 계정을 연결하고 있습니다.");
                        unlockButton.setEnabled(false);
                        new Thread(()->{
                            String result="";
                            try{
                                OfficeBoardClient.enroll(getApplicationContext(),code,chosen);
                                AccessPolicy.authorize(this,currentPolicy);
                                OfficeMemoNotifications.schedule(getApplicationContext());
                                OfficeMemoFirebase.register(getApplicationContext());
                            }catch(Exception e){result=e.getMessage()==null?"계정 연결에 실패했습니다.":e.getMessage();}
                            finally{Arrays.fill(code,(char)0);}
                            final String err=result;
                            runOnUiThread(()->{
                                if(isFinishing()||isDestroyed())return;
                                unlockButton.setEnabled(true);
                                if(err.isEmpty()){
                                    getSharedPreferences(PREFS,MODE_PRIVATE).edit().clear().apply();
                                    openMain();
                                }else status.setText(err);
                            });
                        },"office-member-select").start();
                    })
                    .setNegativeButton("취소",(dialog,which)->Arrays.fill(code,(char)0))
                    .setOnCancelListener(dialog->Arrays.fill(code,(char)0)).show();
            });
        },"office-member-choices").start();
    }
    private void loadLatestPolicy() {
        currentPolicy = null;
        policyPending = true;
        codeField.setEnabled(false);
        unlockButton.setEnabled(false);
        retryButton.setVisibility(android.view.View.GONE);
        status.setText("온라인 보안 정책 확인 중...");
        new Thread(() -> {
            try {
                AccessPolicy.Result result = AccessPolicy.resolve(this);
                runOnUiThread(() -> {
                    if(isFinishing() || isDestroyed())return;
                    currentPolicy = result.policy;
                    policyPending = false;
                    if(AccessPolicy.authorized(this,result.policy)&&OfficeBoardClient.enrolled(this)){
                        status.setText("사무실 계정 상태를 확인하는 중입니다.");
                        new Thread(()->{
                            String error="";
                            try{OfficeBoardClient.checkAccount(getApplicationContext());}
                            catch(Exception e){error=e.getMessage()==null?"계정 확인 실패":e.getMessage();}
                            final String problem=error;
                            runOnUiThread(()->{
                                if(isFinishing()||isDestroyed())return;
                                if(problem.isEmpty()){openMain();if(welcomeElapsed)finishWelcome();}
                                else{
                                    if(welcomeElapsed)finishWelcome();
                                    status.setText(problem.startsWith("account_revoked")?
                                        "이 계정의 사용 권한이 해제됐습니다. 관리자에게 문의해 주세요.":
                                        "사무실 계정을 확인할 수 없습니다. 인터넷 연결을 확인해 주세요.");
                                    retryButton.setVisibility(android.view.View.VISIBLE);
                                }
                            });
                        },"office-member-verify").start();
                        return;
                    }
                    if(welcomeElapsed)finishWelcome();
                    codeField.setEnabled(true);
                    unlockButton.setEnabled(true);
                    status.setText(result.changed
                        ? "보안코드가 변경되었습니다. 새 보안코드를 다시 입력해 주세요."
                        : result.online ? "처음 한 번만 가족 보안코드를 입력해 주세요."
                        : "오프라인: 최근 확인한 인증정보로 입력할 수 있습니다.");
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if(isFinishing() || isDestroyed())return;
                    policyPending=false;
                    if(welcomeElapsed)finishWelcome();
                    status.setText(error.getMessage()==null
                            ? "보안 정책 확인 실패":error.getMessage());
                    retryButton.setVisibility(android.view.View.VISIBLE);
                });
            }
        }, "family-policy-load").start();
    }

    @Override protected void onDestroy(){
        welcomeHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void unlock() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long until = prefs.getLong("lock_until", 0);
        if (now < until) {
            long seconds = (until - now + 999) / 1000;
            status.setText("여러 번 틀렸습니다. " + seconds + "초 후 다시 시도하세요.");
            return;
        }

        char[] input = codeField.getText().toString().trim().toCharArray();
        codeField.setText("");
        boolean good = currentPolicy != null && AccessPolicy.matches(currentPolicy,input);
        // On fresh sign-in, privately enroll this device for shared sticky notes.
        // Do not block app launch if network is temporarily unavailable.
        final char[] boardSecret=good ? Arrays.copyOf(input,input.length) : null;
        Arrays.fill(input, (char) 0);

        if (good) {
            // One password for the office; choose a managed identity once, never infer it.
            showAccountChoices(boardSecret);
        } else {
            int attempts = prefs.getInt("attempts", 0) + 1;
            if (attempts >= 5) {
                prefs.edit().putInt("attempts", 0)
                        .putLong("lock_until", now + 60_000L).apply();
                status.setText("보안코드가 5회 틀렸습니다. 1분 후 다시 시도하세요.");
            } else {
                prefs.edit().putInt("attempts", attempts).apply();
                status.setText("보안코드가 올바르지 않습니다. (" + attempts + "/5)");
            }
        }
    }

}
