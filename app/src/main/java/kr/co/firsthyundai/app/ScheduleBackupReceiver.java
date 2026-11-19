package kr.co.firsthyundai.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires a local backup reminder; skipped if the server push already reminded. */
public final class ScheduleBackupReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(intent==null||!ScheduleBackupAlarms.ACTION.equals(intent.getAction()))return;
        final String id=intent.getStringExtra(ScheduleBackupAlarms.EXTRA_ID);
        final String at=intent.getStringExtra(ScheduleBackupAlarms.EXTRA_AT);
        final PendingResult pending=goAsync();
        final Context app=context.getApplicationContext();
        new Thread(()->{
            try{OfficeMemoNotifications.receivedBackupReminder(app,id,at);}
            finally{pending.finish();}
        },"office-schedule-backup").start();
    }
}
