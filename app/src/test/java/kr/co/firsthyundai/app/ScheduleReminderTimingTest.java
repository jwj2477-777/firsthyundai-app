package kr.co.firsthyundai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class ScheduleReminderTimingTest {
 @Test public void delayedFcmStillShowsUpcomingReminders(){
  long now=1_800_000_000_000L,start=now+30*60_000L;
  for(int minute:new int[]{0,1,10,15,25,29,30})
      assertTrue("delay "+minute,ScheduleReminderTiming.shouldNotify(now+minute*60_000L,start));
  assertTrue(ScheduleReminderTiming.title(now+20*60_000L,start).contains("10분 후"));
  assertTrue(ScheduleReminderTiming.title(now,start).contains("30분 후"));
  assertTrue(ScheduleReminderTiming.title(start-30_000L,start).contains("곧 시작"));
 }
 @Test public void staleOrTooEarlyPushIsRejected(){
  long now=1_800_000_000_000L;
  assertFalse(ScheduleReminderTiming.shouldNotify(now,now-1));
  assertFalse(ScheduleReminderTiming.shouldNotify(now,now+34*60_000L));
  assertTrue(ScheduleReminderTiming.shouldNotify(now,now+33*60_000L));
  assertTrue(ScheduleReminderTiming.shouldNotify(now,now));
 }
}
