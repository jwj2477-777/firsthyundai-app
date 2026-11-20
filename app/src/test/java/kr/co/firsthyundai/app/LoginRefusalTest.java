package kr.co.firsthyundai.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** v2.2.8: a refused login says why, and never blames a correct 보안코드. */
public class LoginRefusalTest {
    @Test public void revokedPhoneExplainsHowToRequestAgain(){
        String m=OfficeBoardClient.loginRefusal(403,"device_revoked");
        assertEquals(OfficeBoardClient.DEVICE_REVOKED,m);
        assertTrue(m.contains("보안코드는 맞습니다"));
        assertTrue(m.contains("데이터 삭제"));
        assertTrue(m.contains("새 휴대폰 승인"));
        assertTrue(OfficeBoardClient.completeLoginMessage(m));
    }
    @Test public void removedAccountAndAssignedPhone(){
        assertEquals(OfficeBoardClient.ACCOUNT_REMOVED,OfficeBoardClient.loginRefusal(403,"account_removed"));
        assertEquals(OfficeBoardClient.DEVICE_ASSIGNED,OfficeBoardClient.loginRefusal(409,"device_already_assigned"));
        assertTrue(OfficeBoardClient.completeLoginMessage(OfficeBoardClient.ACCOUNT_REMOVED));
        assertTrue(OfficeBoardClient.completeLoginMessage(OfficeBoardClient.PENDING_APPROVAL));
    }
    @Test public void unknownReasonsKeepTheGenericPath(){
        assertNull(OfficeBoardClient.loginRefusal(403,"native_only"));
        assertNull(OfficeBoardClient.loginRefusal(403,""));
        assertNull(OfficeBoardClient.loginRefusal(401,"unauthorized"));
        assertFalse(OfficeBoardClient.completeLoginMessage("게시판 보안 인증 만료 · 다시 인증해 주세요."));
    }
}
