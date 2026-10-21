package kr.co.firsthyundai.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

/**
 * Optional local Android notifications for NEW transactions discovered by the
 * app during a foreground data refresh. No background worker, FCM or polling:
 * the app cannot promise alerts while fully closed.
 */
final class TradeNotifications {
    static final String CHANNEL_ID = "firsthyundai_favorite_trades";
    static final int REQUEST_PERMISSION = 1414;
    private static final int NOTIFICATION_ID = 1415;

    private TradeNotifications() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "관심 14개 단지 신규 실거래", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("앱을 열거나 갱신할 때 처음 확인한 관심 단지 매매·전월세 알림");
        manager.createNotificationChannel(channel);
    }

    static String status(Context context) {
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return "unavailable";
        if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) return "permission_required";
        if (Build.VERSION.SDK_INT >= 24 && !manager.areNotificationsEnabled()) return "blocked";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE)
                return "blocked";
        }
        return "enabled";
    }

    static void requestPermission(Activity activity) {
        ensureChannel(activity);
        if (Build.VERSION.SDK_INT >= 33 &&
                activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(
                    new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_PERMISSION);
        }
    }

    static boolean post(Activity activity, int count, String detail) {
        if (!"enabled".equals(status(activity)) || count < 1 || count > 100) return false;
        ensureChannel(activity);
        NotificationManager manager = (NotificationManager)
                activity.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        String safeDetail = detail == null ? "" : detail.trim();
        if (safeDetail.length() > 240) safeDetail = safeDetail.substring(0, 240);
        if (safeDetail.isEmpty()) safeDetail = "관심 단지 새 거래를 확인해 주세요.";
        // Use the authenticated launch entry point. Never open MainActivity directly
        // from the notification and accidentally bypass the family access check.
        Intent open = new Intent(activity, LockActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(activity, NOTIFICATION_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(activity, CHANNEL_ID) : new Notification.Builder(activity);
        builder.setSmallIcon(R.drawable.ic_stat_trade_notification)
                .setContentTitle("관심 14개 단지 새 실거래 " + count + "건")
                .setContentText(safeDetail)
                .setStyle(new Notification.BigTextStyle().bigText(safeDetail))
                .setContentIntent(content)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_STATUS)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        try {
            manager.notify(NOTIFICATION_ID, builder.build());
            return true;
        } catch (SecurityException ignored) {
            // Permission could be revoked between status check and notify().
            return false;
        }
    }
}
