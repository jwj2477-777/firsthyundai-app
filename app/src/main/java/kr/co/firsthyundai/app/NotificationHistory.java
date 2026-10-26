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
            JSONArray source=data(context);
            JSONArray next=new JSONArray();
            next.put(entry);
            for(int i=0;i<source.length();i++)next.put(source.opt(i));
            prefs(context).edit().putString(ENTRIES,keepRecent(next).toString()).apply();
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
