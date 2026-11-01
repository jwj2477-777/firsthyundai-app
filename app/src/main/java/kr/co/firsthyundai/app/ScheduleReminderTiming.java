package kr.co.firsthyundai.app;

/** Convert a verified, received reminder into a truthful title even if FCM
 * delivers it late. Never creates new reminders or reads customer details.
 */
final class ScheduleReminderTiming {
    private static final long MINUTE_MS=60_000L;
    private static final long MAX_EARLY_MS=33L*MINUTE_MS;
    static boolean shouldNotify(long now,long scheduledAt){
        long remaining=scheduledAt-now;
        return remaining>=0&&remaining<=MAX_EARLY_MS;
    }
    static String title(long now,long scheduledAt){
        long remaining=scheduledAt-now;
        if(remaining<=MINUTE_MS)return "⏰ 곧 시작하는 공유 일정";
        long minutes=(remaining+MINUTE_MS-1)/MINUTE_MS;
        // The background cron intentionally targets 30 minutes.
        if(minutes>=29&&minutes<=33)return "⏰ 약 30분 후 공유 일정";
        return "⏰ 약 "+minutes+"분 후 공유 일정";
    }
}
