package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local, private history of Android notifications actually posted on this phone.
 * Neither memo contents nor contact information are retained in the journal.
 * No cloud sync, account sharing, or public WebView storage. */
final class NotificationHistory {
    private static final String PREF="firsthyundai-notification-history-v1";
    private static final String ENTRIES="entries";
    private static final int MAX=80;
    private static final long RETAIN_MS=90L*24*60*60*1000;
    private NotificationHistory(){}

    private static SharedPreferences prefs(Context context){
        return context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
    }
    private static JSONArray data(Context context){
        try{return new JSONArray(prefs(context).getString(ENTRIES,"[]"));}
        catch(Exception ignored){return new JSONArray();}
    }
    private static JSONArray keepRecent(JSONArray source){
        JSONArray out=new JSONArray();
        long now=System.currentTimeMillis();
        for(int i=0;i<source.length()&&out.length()<MAX;i++){
            JSONObject entry=source.optJSONObject(i);
            if(entry==null)continue;
            long when=entry.optLong("when",0);
            if(when<=0||when>now+60000L||now-when>RETAIN_MS)continue;
            out.put(entry);
        }
        return out;
    }
    static synchronized void record(Context context,String kind,String title,String description){
        record(context,kind,title,description,null);
    }
    static synchronized void record(Context context,String kind,String title,String description,String snapshotJson){
        if(!"trade".equals(kind)&&!"memo".equals(kind))return;
        // The memo journal intentionally stores only generic fixed strings.
        if("memo".equals(kind)){
            title="새 사무실 공유 메모";
            description="사무실 포스트잇이 도착했습니다.";
        }
        JSONObject entry=new JSONObject();
        long time=System.currentTimeMillis();
        try{
            entry.put("id",String.valueOf(time)+"-"+Long.toHexString(System.nanoTime()));
            entry.put("kind",kind);
            entry.put("title",title==null?"새 알림":title.substring(0,Math.min(80,title.length())));
            entry.put("detail",description==null?"":description.substring(0,Math.min(180,description.length())));
            entry.put("when",time);
            entry.put("read",false);
            // Only public favorite-trade fields supplied by the collector are persisted.
            // Legacy journal records have no snapshot and remain readable.
            if("trade".equals(kind)&&snapshotJson!=null&&snapshotJson.length()<=48000){
                try{
                    JSONObject snapshot=new JSONObject(snapshotJson);
                    JSONArray items=snapshot.optJSONArray("items");
                    if(snapshot.optInt("version")==1&&items!=null&&items.length()>0&&items.length()<=100)
                        entry.put("tradeSnapshot",snapshot);
                }catch(Exception ignored){}
            }
            JSONArray source=data(context);
            JSONArray next=new JSONArray();
            next.put(entry);
            for(int i=0;i<source.length();i++)next.put(source.opt(i));
            prefs(context).edit().putString(ENTRIES,keepRecent(next).toString()).apply();
        }catch(Exception ignored){}
    }
    /** Remember only a private note ID; fetch the text after opening the inbox. */
    static synchronized void recordMemo(Context context,String noteId){
        record(context,"memo","새 사무실 공유 메모","사무실 포스트잇이 도착했습니다.");
        if(noteId==null||!noteId.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))return;
        JSONArray records=data(context);
        JSONObject newest=records.optJSONObject(0);
        if(newest==null||!"memo".equals(newest.optString("kind","")))return;
        try{
            newest.put("noteId",noteId);
            prefs(context).edit().putString(ENTRIES,keepRecent(records).toString()).apply();
        }catch(Exception ignored){}
    }
    /** Keeps only a note ID and fixed reminder label, never customer memo text. */
    static synchronized void recordReminder(Context context,String noteId){
        recordMemo(context,noteId);
        JSONArray entries=data(context);
        JSONObject newest=entries.optJSONObject(0);
        if(newest==null||!"memo".equals(newest.optString("kind","")))return;
        try{
            newest.put("title","⏰ 일정 시작 30분 전");
            newest.put("detail","곧 시작하는 공유 일정이 있습니다.");
            prefs(context).edit().putString(ENTRIES,keepRecent(entries).toString()).apply();
        }catch(Exception ignored){}
    }
    static synchronized String list(Context context){
        return keepRecent(data(context)).toString();
    }
    static synchronized void markRead(Context context){
        JSONArray entries=keepRecent(data(context));
        for(int i=0;i<entries.length();i++){
            JSONObject entry=entries.optJSONObject(i);
            if(entry!=null)try{entry.put("read",true);}catch(Exception ignored){}
        }
        prefs(context).edit().putString(ENTRIES,entries.toString()).apply();
    }
    static synchronized void clear(Context context){
        prefs(context).edit().putString(ENTRIES,"[]").apply();
    }
}
