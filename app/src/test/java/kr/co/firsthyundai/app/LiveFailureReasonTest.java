package kr.co.firsthyundai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class LiveFailureReasonTest {
    @Test public void safeHttpCodesAreDistinctAndNeverEchoProviderText() {
        assertEquals("FHD_LIVE_daily_free_trial_limit",LiveFailureReason.fromHttp(429,"{\"error\":\"daily_free_trial_limit\"}"));
        assertEquals("FHD_LIVE_provider_quota",LiveFailureReason.fromHttp(429,"{\"error\":\"provider_quota\"}"));
        assertEquals("FHD_LIVE_rate_limited",LiveFailureReason.fromHttp(429,"{\"error\":\"rate_limited\"}"));
        assertEquals("FHD_LIVE_account_session_required",LiveFailureReason.fromHttp(401,"{\"error\":\"account_session_required\"}"));
        assertEquals("FHD_LIVE_provider_access_denied",LiveFailureReason.fromHttp(503,"{\"error\":\"provider_access_denied\"}"));
        assertEquals("FHD_LIVE_provider_model_unavailable",LiveFailureReason.fromHttp(503,"{\"error\":\"provider_model_unavailable\"}"));
        assertEquals("FHD_LIVE_live_not_configured",LiveFailureReason.fromHttp(503,"{\"error\":\"live_not_configured\"}"));
        assertEquals("FHD_LIVE_server_unavailable",LiveFailureReason.fromHttp(500,"{\"error\":\"secret-token-should-never-show\"}"));
    }
    @Test public void koreanMessagesAreActionableAndPrivate() {
        assertTrue(LiveFailureReason.display(new Exception("FHD_LIVE_daily_free_trial_limit")).contains("6회"));
        assertTrue(LiveFailureReason.display(new Exception("FHD_LIVE_provider_quota")).contains("Google"));
        assertTrue(LiveFailureReason.display(new Exception("FHD_LIVE_account_session_required")).contains("계정"));
        assertTrue(LiveFailureReason.display(new Exception("FHD_LIVE_live_not_configured")).contains("API 키"));
        assertTrue(LiveFailureReason.display(new Exception("FHD_LIVE_provider_model_unavailable")).contains("모델"));
        assertTrue(LiveFailureReason.websocket(429).contains("사용 한도"));
        assertTrue(LiveFailureReason.websocket(403).contains("이용 권한"));
        String secret="private-api-key-and-customer-account";
        assertFalse(LiveFailureReason.display(new Exception(secret)).contains(secret));
        assertFalse(LiveFailureReason.fromHttp(500,"{\"error\":\""+secret+"\"}").contains(secret));
    }
}
