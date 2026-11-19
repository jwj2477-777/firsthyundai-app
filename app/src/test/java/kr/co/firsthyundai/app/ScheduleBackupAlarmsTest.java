package kr.co.firsthyundai.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.time.Instant;
import java.util.List;

/** Which snapshot notes get a handset backup reminder, and when (fictional data only). */
public class ScheduleBackupAlarmsTest {
    private static final long NOW=Instant.parse("2026-11-20T00:00:00Z").toEpochMilli();
    private static final String A="mhxq1abc-11111111-2222-4333-8444-555555555555";
    private static final String B="mhxq1abd-11111111-2222-4333-8444-555555555556";
    private static final String C="mhxq1abe-11111111-2222-4333-8444-555555555557";

    private static JSONObject note(String id,String at,boolean done,boolean allDay,String text) throws Exception {
        return new JSONObject().put("id",id).put("text",text).put("done",done)
            .put("all_day",allDay).put("scheduled_at",at);
    }

    @Test public void schedulesThirtyMinutesBeforeTimedOpenNotes() throws Exception {
        JSONArray notes=new JSONArray()
            .put(note(A,"2026-11-20T05:30:00Z",false,false,"오후 방문 예약"))
            .put(note(B,"2026-11-20T03:00:00Z",false,false,"고객 연락"));
        List<ScheduleBackupAlarms.Slot> plan=ScheduleBackupAlarms.plan(notes,NOW);
        assertEquals(2,plan.size());
        assertEquals(B,plan.get(0).id);
        assertEquals(Instant.parse("2026-11-20T02:30:00Z").toEpochMilli(),plan.get(0).trigger);
        assertEquals("2026-11-20T05:30:00Z",plan.get(1).at);
    }

    @Test public void skipsDoneAllDayBirthdayPastAndFarFuture() throws Exception {
        JSONArray notes=new JSONArray()
            .put(note(A,"2026-11-20T05:30:00Z",true,false,"완료"))
            .put(note(B,"2026-11-20T05:30:00Z",false,true,"종일"))
            .put(note(C,"2026-11-20T05:30:00Z",false,false,"🎂 가상 생일 · 매년 양력"))
            .put(note("mhxq1abf-11111111-2222-4333-8444-555555555558","2026-11-19T23:00:00Z",false,false,"지난 일정"))
            .put(note("mhxq1abg-11111111-2222-4333-8444-555555555559","2026-12-25T05:30:00Z",false,false,"먼 일정"))
            .put(note("bad id","2026-11-20T05:30:00Z",false,false,"잘못된 ID"))
            .put(new JSONObject().put("id",A).put("text","날짜 없음").put("done",false));
        assertTrue(ScheduleBackupAlarms.plan(notes,NOW).isEmpty());
    }

    @Test public void eventInsideThirtyMinutesStillGetsPromptReminder() throws Exception {
        JSONArray notes=new JSONArray().put(note(A,"2026-11-20T00:20:00Z",false,false,"곧 시작"));
        List<ScheduleBackupAlarms.Slot> plan=ScheduleBackupAlarms.plan(notes,NOW);
        assertEquals(1,plan.size());
        assertEquals(NOW+10_000L,plan.get(0).trigger);
        // Under two minutes left: no point in a "starting soon" alarm.
        assertTrue(ScheduleBackupAlarms.plan(new JSONArray().put(note(A,"2026-11-20T00:01:00Z",false,false,"x")),NOW).isEmpty());
    }

    @Test public void nullSnapshotIsSafe(){
        assertTrue(ScheduleBackupAlarms.plan(null,NOW).isEmpty());
    }
}
