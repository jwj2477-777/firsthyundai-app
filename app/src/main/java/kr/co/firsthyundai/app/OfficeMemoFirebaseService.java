package kr.co.firsthyundai.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Dedicated data-only push receiver. Never displays memo text or phone numbers. */
public final class OfficeMemoFirebaseService extends FirebaseMessagingService {
    @Override public void onNewToken(String token){
        super.onNewToken(token);
        OfficeMemoFirebase.registerNewToken(getApplicationContext(),token);
    }
    @Override public void onMessageReceived(RemoteMessage message){
        if(message==null)return;
        String kind=message.getData().get("kind"),id=message.getData().get("note_id");
        if(id==null||!id.matches("[a-z0-9]{8,14}-[0-9a-f-]{36}"))return;
        if(!OfficeBoardClient.enrolled(getApplicationContext()))return;
        if("office_note".equals(kind)){
            OfficeMemoNotifications.receivedPush(getApplicationContext(),id);
        }else if("office_schedule_reminder".equals(kind)){
            OfficeMemoNotifications.receivedReminder(getApplicationContext(),id,
                message.getData().get("scheduled_at"));
        }
    }
}
