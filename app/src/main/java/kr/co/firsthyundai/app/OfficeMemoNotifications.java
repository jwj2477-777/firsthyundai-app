package kr.co.firsthyundai.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private memo notifications: unlocked shade preview, generic locked-screen public version. */
final class OfficeMemoNotifications {
    static final String CHANNEL="firsthyundai_private_office_notes";
    static final int PERMISSION=1418;
    private static final int JOB_ID=43152;
    private static final String PREF="firsthyundai-office-note-notify-v1";
    private static final String LAST="last_id";
    private static final String ENABLED="enabled";
    private static final int MAX_BATCH=20;
    private static final String LAST_PUSH="last_push_id";

    private OfficeMemoNotifications(){}
    static void ensureChannel(Context context){
        if(Build.VERSION.SDK_INT<26)return;
        NotificationManager n=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(n==null||n.getNotificationChannel(CHANNEL)!=null)return;
        NotificationChannel c=new NotificationChannel(CHANNEL,"사무실 공유 메모",
                NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("새 공유 메모의 첫 문장을 보여줍니다. 잠금화면은 내용이 가려집니다.");
        c.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        n.createNotificationChannel(c);
    }
    static boolean enabled(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getBoolean(ENABLED,true);}
    static void setEnabled(Context c,boolean on){
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putBoolean(ENABLED,on).apply();
        if(on)schedule(c);
    }
    static String status(Context c){
        NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm==null)return "unavailable";
        if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                !=PackageManager.PERMISSION_GRANTED)return "permission_required";
        if(Build.VERSION.SDK_INT>=24&&!nm.areNotificationsEnabled())return "blocked";
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=nm.getNotificationChannel(CHANNEL);
            if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return "blocked";
        }
        return enabled(c)?"enabled":"disabled";
    }
    static void requestPermission(Activity a){
        ensureChannel(a);
        if(Build.VERSION.SDK_INT>=33&&a.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                !=PackageManager.PERMISSION_GRANTED)
            a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},PERMISSION);
    }
    static void schedule(Context c){
        if(!OfficeBoardClient.enrolled(c))return;
        JobScheduler scheduler=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if(scheduler==null)return;
        if(scheduler.getPendingJob(JOB_ID)!=null)return;
        JobInfo job=new JobInfo.Builder(JOB_ID,new ComponentName(c,OfficeMemoJobService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            // Android background jobs cannot run more often than ~15 minutes.
            .setPeriodic(15*60*1000L).setPersisted(true).build();
        try{scheduler.schedule(job);}catch(Exception ignored){}
    }
    static synchronized int check(Context c){
        if(!OfficeBoardClient.enrolled(c))return 0;
        JSONObject payload;
        try{payload=OfficeBoardClient.activity(c);}catch(Exception e){return 0;}
        JSONArray entries=payload.optJSONArray("items");
        if(entries==null)return 0;
        SharedPreferences prefs=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String previous=prefs.getString(LAST,"");
        String newest=previous;
        String own=OfficeBoardClient.deviceId(c);
        int count=0;
        String oneId="";
        long now=System.currentTimeMillis();
        for(int i=0;i<entries.length();i++){
            JSONObject item=entries.optJSONObject(i);if(item==null)continue;
            String id=item.optString("id","");
            if(!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))continue;
            if(id.compareTo(newest)>0)newest=id;
            if(previous.isEmpty()||id.compareTo(previous)<=0)continue;
            if(own.equals(item.optString("device","")))continue;
            // Avoid suddenly notifying about very old notes after an offline period.
            String prefix=id.split("-",2)[0];
            long posted;
            try{posted=Long.parseLong(prefix,36);}catch(Exception e){continue;}
            if(posted>now+60000L||now-posted>24*60*60*1000L)continue;
            count++;
            oneId=id;
        }
        if(!newest.equals(previous))prefs.edit().putString(LAST,newest).apply();
        if(previous.isEmpty()||count==0||!enabled(c))return count;
        post(c,Math.min(count,MAX_BATCH),count==1?oneId:"");
        return count;
    }
    static synchronized void receivedPush(Context c,String id){
        if(!OfficeBoardClient.enrolled(c)||id==null||
          !id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))return;
        SharedPreferences prefs=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        if(id.equals(prefs.getString(LAST_PUSH,"")))return;
        String last=prefs.getString(LAST,"");
        prefs.edit().putString(LAST_PUSH,id)
          .putString(LAST,id.compareTo(last)>0?id:last).apply();
        if(enabled(c))post(c,1,id);
    }
    private static void post(Context context,int number){post(context,number,"");}
    private static String safePreview(String value) {
        if(value==null)return "";
        // Phone numbers are deliberately masked in the unlocked notification too.
        String result=value.replaceAll("[\\r\\n\\t]+"," ").replaceAll("\\s+"," ").trim()
                .replaceAll("(?<!\\d)01[016789][- .]?\\d{3,4}[- .]?\\d{4}(?!\\d)","연락처 확인")
                .replaceAll("(?<!\\d)0\\d{1,2}[- .]?\\d{3,4}[- .]?\\d{4}(?!\\d)","연락처 확인");
        return result.length()>110?result.substring(0,110)+"…":result;
    }
    private static String[] preview(Context context,String id) {
        if(id==null||!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
            return new String[]{"",""};
        try{
            JSONObject data=OfficeBoardClient.preview(context,id);
            String name=data.optString("author","사무실").trim();
            if(name.length()>24)name=name.substring(0,24);
            String body=safePreview(data.optString("preview",""));
            int images=data.optInt("image_count",0);
            if(images>0)body=(body.isEmpty()?"":body+"  ")+"📷 사진 "+images+"장";
            return new String[]{name,body};
        }catch(Exception ignored){
            // If offline, revoked or deleted, fall back to generic notification;
            // never accept an unauthenticated or unverified FCM text payload.
            return new String[]{"",""};
        }
    }
    private static void post(Context context,int number,String noteId){
        if(!"enabled".equals(status(context)))return;
        ensureChannel(context);
        NotificationManager nm=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm==null)return;
        Intent open=new Intent(context,LockActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("office_board_from_notification",true);
        if(noteId!=null&&noteId.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))
            open.putExtra("office_board_note_id",noteId);
        PendingIntent tap=PendingIntent.getActivity(context,43153,open,
                PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        String[] detail=number==1?preview(context,noteId):new String[]{"",""};
        String displayTitle=number==1&& !detail[0].isEmpty()
            ?detail[0]+" · 새 공유 메모"
            :number==1?"새 사무실 공유 메모":"새 사무실 공유 메모 "+number+"건";
        String displayText=number==1&&!detail[1].isEmpty()
            ?detail[1]:"사무실 포스트잇을 확인해 주세요.";
        Notification.Builder notification=Build.VERSION.SDK_INT>=26
            ?new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
        notification.setSmallIcon(R.drawable.ic_stat_trade_notification)
            .setContentTitle(displayTitle)
            .setContentText(displayText)
            .setStyle(new Notification.BigTextStyle().bigText(displayText))
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(tap).setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE).setWhen(System.currentTimeMillis())
            .setShowWhen(true);
        Notification.Builder hidden=Build.VERSION.SDK_INT>=26
            ?new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
        hidden.setSmallIcon(R.drawable.ic_stat_trade_notification)
            .setContentTitle("퍼스트현대 · 새 공유 메모")
            .setContentText("잠금을 해제하면 메모를 확인할 수 있습니다.")
            .setVisibility(Notification.VISIBILITY_PUBLIC);
        notification.setPublicVersion(hidden.build());
        try{
            nm.notify(43153,notification.build());
            NotificationHistory.record(context,"memo","새 사무실 공유 메모",
                "사무실 포스트잇이 도착했습니다.");
        }catch(SecurityException ignored){}
    }
}
