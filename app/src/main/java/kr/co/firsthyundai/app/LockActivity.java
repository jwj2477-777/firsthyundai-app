package kr.co.firsthyundai.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
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

    private int dp(int v) { return (int) (getResources().getDisplayMetrics().density * v + 0.5f); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(244, 246, 250));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(26), dp(32), dp(26), dp(36));
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("퍼스트현대");
        title.setTextSize(30);
        title.setTextColor(Color.rgb(32, 52, 78));
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
        unlock.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(36, 86, 170)));
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
        setContentView(scroll);
        loadLatestPolicy();
    }

    private void openMain() {
        if(isFinishing() || isDestroyed()) return;
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    private void loadLatestPolicy() {
        currentPolicy = null;
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
                    if(AccessPolicy.authorized(this,result.policy)){
                        openMain();
                        return;
                    }
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
                    status.setText(error.getMessage()==null
                            ? "보안 정책 확인 실패":error.getMessage());
                    retryButton.setVisibility(android.view.View.VISIBLE);
                });
            }
        }, "family-policy-load").start();
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
        Arrays.fill(input, (char) 0);

        if (good) {
            AccessPolicy.authorize(this,currentPolicy);
            prefs.edit().clear().apply();
            openMain();
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
