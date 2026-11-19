package kr.co.firsthyundai.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Handset-side backup for the T-30 shared schedule reminder.
 *
 * The primary reminder is a server cron + FCM push. If the Worker, KV or FCM is
 * unavailable, this schedules local alarms from the encrypted offline snapshot
 * (the last complete sync). Both paths share the same "already reminded" key in
 * {@link OfficeMemoNotifications}, so the family sees one reminder per event.
 * Alarms are inexact (setAndAllowWhileIdle): no exact-alarm permission is needed,
 * and Android may delay them by a few minutes in Doze.
 */
final class ScheduleBackupAlarms {
    static final String ACTION="kr.co.firsthyundai.app.SCHEDULE_BACKUP_REMINDER";
    static final String EXTRA_ID="note_id";
    static final String EXTRA_AT="scheduled_at";
    private static final String PREF="office_schedule_backup_v1";
    private static final String CODES="codes";
    private static final long MINUTE=60_000L;
    private static final long LEAD=30L*MINUTE;
    private static final long HORIZON=8L*24L*60L*MINUTE;
    private static final int MAX_ALARMS=40;
    private static final Pattern ID=Pattern.compile("[a-z0-9]{8,14}-[0-9a-f-]{36}");
    private static final Pattern BIRTHDAY=Pattern.compile("^🎂\\s*.{1,24}?\\s+생일\\s*·\\s*매년\\s*(양력|음력)");

    static final class Slot {
        final String id, at; final long trigger;
        Slot(String id,String at,long trigger){this.id=id;this.at=at;this.trigger=trigger;}
    }

    /** Pure selection logic (unit-tested): which snapshot notes need a backup alarm and when. */
    static List<Slot> plan(JSONArray notes,long now){
        List<Slot> out=new ArrayList<>();
        if(notes==null)return out;
        for(int i=0;i<notes.length();i++){
            JSONObject n=notes.optJSONObject(i);
            if(n==null)continue;
            String id=n.optString("id","");
            if(!ID.matcher(id).matches()||n.optBoolean("done",true)||n.optBoolean("all_day",false))continue;
            if(BIRTHDAY.matcher(n.optString("text","")).find())continue;
            Object raw=n.opt("scheduled_at");
            if(!(raw instanceof String)||((String)raw).length()>30)continue;
            long at;
            try{at=java.time.Instant.parse((String)raw).toEpochMilli();}catch(Exception e){continue;}
            long remaining=at-now;
            // Too late for a useful "about to start" reminder, or too far ahead to keep.
            if(remaining<2L*MINUTE||remaining>HORIZON)continue;
            out.add(new Slot(id,(String)raw,Math.max(at-LEAD,now+10_000L)));
        }
        Collections.sort(out,(a,b)->Long.compare(a.trigger,b.trigger));
        return out.size()>MAX_ALARMS?new ArrayList<>(out.subList(0,MAX_ALARMS)):out;
    }

    static synchronized void reschedule(Context context){
        Context c=context.getApplicationContext();
        cancelAll(c);
        if(!OfficeBoardClient.enrolled(c))return;
        JSONArray notes;
        try{
            JSONObject snapshot=new JSONObject(OfficeOfflineStore.read(c,OfficeBoardClient.memberId(c)));
            notes=snapshot.optJSONArray("notes");
        }catch(Exception e){return;}
        AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(alarms==null)return;
        StringBuilder codes=new StringBuilder();
        for(Slot slot:plan(notes,System.currentTimeMillis())){
            int code=requestCode(slot.id);
            Intent intent=new Intent(c,ScheduleBackupReceiver.class).setAction(ACTION)
                .putExtra(EXTRA_ID,slot.id).putExtra(EXTRA_AT,slot.at);
            PendingIntent pending=PendingIntent.getBroadcast(c,code,intent,
                PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
            try{
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,slot.trigger,pending);
                if(codes.length()>0)codes.append(',');
                codes.append(code);
            }catch(Exception ignored){/* Best effort: the server reminder remains primary. */}
        }
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putString(CODES,codes.toString()).apply();
    }

    static synchronized void cancelAll(Context c){
        SharedPreferences prefs=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String stored=prefs.getString(CODES,"");
        AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(alarms!=null&&!stored.isEmpty()){
            for(String part:stored.split(",")){
                try{
                    int code=Integer.parseInt(part);
                    Intent intent=new Intent(c,ScheduleBackupReceiver.class).setAction(ACTION);
                    PendingIntent pending=PendingIntent.getBroadcast(c,code,intent,
                        PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_NO_CREATE);
                    if(pending!=null){alarms.cancel(pending);pending.cancel();}
                }catch(Exception ignored){}
            }
        }
        prefs.edit().remove(CODES).apply();
    }

    static int requestCode(String id){return 0x50000000|(id.hashCode()&0x0fffffff);}

    private ScheduleBackupAlarms(){}
}
