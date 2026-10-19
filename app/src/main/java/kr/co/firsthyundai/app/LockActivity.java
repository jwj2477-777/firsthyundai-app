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
    private byte[] salt;
    private byte[] verifier;
    private int iterations;
    private EditText codeField;
    private TextView status;
    private static final String PREFS = "firsthyundai_access_attempts";

    private int dp(int v) { return (int) (getResources().getDisplayMetrics().density * v + 0.5f); }

    private static byte[] fromHex(String value) {
        if (value == null || value.length() % 2 != 0) throw new IllegalArgumentException();
        byte[] bytes = new byte[value.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int hi = Character.digit(value.charAt(2 * i), 16);
            int lo = Character.digit(value.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException();
            bytes[i] = (byte) ((hi << 4) | lo);
        }
        return bytes;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        try (InputStream stream = getAssets().open("access-verifier.properties")) {
            Properties info = new Properties();
            info.load(stream);
            iterations = Integer.parseInt(info.getProperty("iterations", ""));
            salt = fromHex(info.getProperty("salt", ""));
            verifier = fromHex(info.getProperty("verifier", ""));
            if (iterations < 100000 || iterations > 1000000 || salt.length < 16 || verifier.length != 32) {
                throw new IllegalArgumentException("검증 데이터 형식 오류");
            }
        } catch (Exception e) {
            showError("보안 설정이 포함되지 않은 APK입니다. 관리자에게 새 APK를 요청하세요.");
            return;
        }

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(242, 246, 250));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(26), dp(32), dp(26), dp(36));
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("퍼스트현대");
        title.setTextSize(29);
        title.setTextColor(Color.rgb(23, 59, 96));
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, 1);
        root.addView(title);

        TextView detail = new TextView(this);
        detail.setText("가족 전용 부동산 정보센터\n접근 보안코드를 입력해 주세요.");
        detail.setTextSize(15);
        detail.setTextColor(Color.rgb(70, 93, 113));
        detail.setGravity(Gravity.CENTER);
        detail.setPadding(0, dp(18), 0, dp(26));
        root.addView(detail);

        codeField = new EditText(this);
        codeField.setSingleLine(true);
        codeField.setHint("가족 보안코드");
        codeField.setTextSize(17);
        codeField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        LinearLayout.LayoutParams inputParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        root.addView(codeField, inputParams);

        Button unlock = new Button(this);
        unlock.setAllCaps(false);
        unlock.setText("인증하고 앱 열기");
        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        buttonParams.topMargin = dp(16);
        root.addView(unlock, buttonParams);

        status = new TextView(this);
        status.setTextSize(13);
        status.setTextColor(Color.rgb(165, 54, 54));
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(14), 0, 0);
        root.addView(status);

        TextView foot = new TextView(this);
        foot.setText("보안코드는 APK에 그대로 저장되지 않습니다.\n"
                + "앱 설치 자체나 공개된 GitHub 자료 접근을 막는 기능은 아닙니다.");
        foot.setTextSize(12);
        foot.setGravity(Gravity.CENTER);
        foot.setTextColor(Color.rgb(99, 115, 129));
        foot.setPadding(0, dp(32), 0, 0);
        root.addView(foot);

        unlock.setOnClickListener(v -> unlock());
        setContentView(scroll);
    }

    private boolean matches(char[] provided) {
        PBEKeySpec spec = new PBEKeySpec(provided, salt, iterations, 256);
        try {
            byte[] derived = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
            boolean valid = MessageDigest.isEqual(verifier, derived);
            Arrays.fill(derived, (byte) 0);
            return valid;
        } catch (Exception ignored) {
            return false;
        } finally {
            spec.clearPassword();
        }
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
        boolean good = input.length > 0 && matches(input);
        Arrays.fill(input, '\\0');

        if (good) {
            prefs.edit().clear().apply();
            startActivity(new Intent(this, MainActivity.class));
            finish();
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

    private void showError(String text) {
        TextView error = new TextView(this);
        error.setPadding(dp(24), dp(48), dp(24), dp(24));
        error.setTextSize(17);
        error.setText(text);
        setContentView(error);
    }
}
