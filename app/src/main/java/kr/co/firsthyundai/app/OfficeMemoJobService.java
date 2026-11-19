package kr.co.firsthyundai.app;
import android.app.job.JobParameters;
import android.app.job.JobService;

/** Best-effort Android background refresh; not a Firebase real-time push receiver. */
public final class OfficeMemoJobService extends JobService {
    @Override public boolean onStartJob(JobParameters params){
        new Thread(()->{
            try{
                OfficeMemoNotifications.check(getApplicationContext());
                // Persisted periodic job: also restores backup alarms after a reboot.
                ScheduleBackupAlarms.reschedule(getApplicationContext());
            }
            finally{jobFinished(params,false);}
        },"office-memo-background-check").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params){return true;}
}
