package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

/**
 * Installed-APK version metadata. Never use hard-coded UI strings or online release tags:
 * these would report a new release even on a phone running an older APK.
 */
final class AppVersion {
    private AppVersion() {}

    private static PackageInfo installed(Context context) {
        try {
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException exception) {
            return null;
        }
    }

    static String name(Context context) {
        PackageInfo info = installed(context);
        return info != null && info.versionName != null ? info.versionName : "";
    }

    @SuppressWarnings("deprecation")
    static int buildNumber(Context context) {
        PackageInfo info = installed(context);
        return info != null ? info.versionCode : 0;
    }
}
