package kr.co.firsthyundai.app;

import org.json.JSONObject;

/** Update status event only.
 * User-initiated APK downloads are opened in the system browser.
 * This app does not download APKs or request package-install privileges.
 */
final class AppUpdateInstaller {
    private AppUpdateInstaller() {}
    static JSONObject event(String phase,int percent,String message){
        JSONObject o=new JSONObject();
        try {
            o.put("phase",phase);
            o.put("percent",percent);
            o.put("message",message);
        }catch(Exception ignored){}
        return o;
    }
}
