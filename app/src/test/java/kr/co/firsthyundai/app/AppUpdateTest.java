package kr.co.firsthyundai.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class AppUpdateTest {
    private JSONObject release(String version) throws Exception {
        String file="FirstHyundai-v"+version+".apk";
        return new JSONObject().put("tag_name","v"+version).put("assets",new JSONArray().put(
            new JSONObject().put("name",file).put("size",1678241)
                .put("browser_download_url","https://github.com/jwj2477-777/firsthyundai-app/releases/download/v"+version+"/"+file)));
    }
    private JSONObject parsed(String version,String installed) throws Exception {
        return AppUpdate.readRelease(release(version).toString(),installed);
    }
    @Test public void stalePrimaryCannotHideNewerIndex() throws Exception {
        JSONObject chosen=AppUpdate.selectRelease(parsed("2.0.37","2.0.37"),parsed("2.0.38","2.0.37"));
        assertEquals("available",chosen.getString("state"));
        assertEquals("2.0.38",chosen.getString("newVersion"));
        assertTrue(chosen.getBoolean("available"));
    }
    @Test public void chooseHighestFromEitherOrder() throws Exception {
        JSONObject older=parsed("2.0.38","2.0.37"),newer=parsed("2.0.39","2.0.37");
        assertEquals("2.0.39",AppUpdate.selectRelease(older,newer).getString("newVersion"));
        assertEquals("2.0.39",AppUpdate.selectRelease(newer,older).getString("newVersion"));
    }
    @Test public void olderFeedNeverClaimsLatest() throws Exception {
        JSONObject stale=parsed("2.0.36","2.0.37");
        assertEquals("stale",stale.getString("state"));
        JSONObject chosen=AppUpdate.selectRelease(stale,null);
        assertEquals("stale",chosen.getString("state"));
        assertFalse(chosen.getBoolean("available"));
        assertFalse(chosen.has("downloadUrl"));
    }
    @Test public void sameVersionNeedsVerifiedAsset() throws Exception {
        assertEquals("latest",parsed("2.0.37","2.0.37").getString("state"));
        JSONObject missing=release("2.0.37").put("assets",new JSONArray());
        assertEquals("error",AppUpdate.readRelease(missing.toString(),"2.0.37").getString("state"));
    }
    @Test public void oneFailedOriginStillAllowsUpdate() throws Exception {
        JSONObject error=AppUpdate.readRelease("not json","2.0.37"),valid=parsed("2.0.38","2.0.37");
        assertEquals("available",AppUpdate.selectRelease(error,valid).getString("state"));
        assertEquals("available",AppUpdate.selectRelease(valid,null).getString("state"));
        assertEquals("unavailable",AppUpdate.selectRelease(error,null).getString("state"));
    }
    @Test public void rejectUnsafeAssetsAndNonFinalReleases() throws Exception {
        for(String flag:new String[]{"draft","prerelease"})
            assertEquals("error",AppUpdate.readRelease(release("2.0.38").put(flag,true).toString(),"2.0.37").getString("state"));
        JSONObject wrong=release("2.0.38");
        wrong.getJSONArray("assets").getJSONObject(0).put("browser_download_url","https://example.com/update.apk");
        assertEquals("error",AppUpdate.readRelease(wrong.toString(),"2.0.37").getString("state"));
        JSONObject huge=release("2.0.38");huge.getJSONArray("assets").getJSONObject(0).put("size",81L*1024*1024);
        assertEquals("error",AppUpdate.readRelease(huge.toString(),"2.0.37").getString("state"));
        assertEquals("error",AppUpdate.readRelease(release("2.0.38").toString(),"unknown").getString("state"));
        assertFalse(AppUpdate.allowedDownload("https://github.com/jwj2477-777/firsthyundai-app/releases/download/v2.0.38/FirstHyundai-v2.0.39.apk"));
    }
    @Test public void numericOrderingAndFreshRequests(){
        assertTrue(AppUpdate.compareVersion("2.0.100","2.0.99")>0);
        String origin="https://raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/app_latest.json";
        String a=AppUpdate.freshUrl(origin),b=AppUpdate.freshUrl(origin);
        assertTrue(a.startsWith(origin+"?check="));assertNotEquals(a,b);
    }
}
