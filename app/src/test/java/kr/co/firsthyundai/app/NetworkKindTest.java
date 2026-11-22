package kr.co.firsthyundai.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** v2.2.10: memo failures are classified by exception type, with Korean wording. */
public class NetworkKindTest {
    @Test public void nothingSentWhenTheNetworkIsMissing(){
        assertEquals("offline",OfficeBoardClient.networkKind(new java.net.UnknownHostException("Unable to resolve host \"x\"")));
        assertEquals("offline",OfficeBoardClient.networkKind(new java.net.ConnectException("Failed to connect to x/1.2.3.4:443")));
        assertEquals("offline",OfficeBoardClient.networkKind(new java.net.NoRouteToHostException("No route")));
        assertEquals("인터넷에 연결되어 있지 않습니다.",OfficeBoardClient.networkMessage("offline"));
    }
    @Test public void slowOrBrokenConnectionsMayHaveArrived(){
        assertEquals("timeout",OfficeBoardClient.networkKind(new java.net.SocketTimeoutException("timeout")));
        assertEquals("interrupted",OfficeBoardClient.networkKind(new javax.net.ssl.SSLHandshakeException("Connection closed by peer")));
        assertEquals("interrupted",OfficeBoardClient.networkKind(new java.io.EOFException("unexpected end of stream")));
        assertEquals("interrupted",OfficeBoardClient.networkKind(new Exception("wrapped",new java.net.SocketException("Connection reset"))));
        assertTrue(OfficeBoardClient.networkMessage("timeout").contains("시간 초과"));
    }
    @Test public void serverAndWifiSignInPages(){
        assertEquals("server",OfficeBoardClient.networkKind(new Exception("게시판 서버에 연결할 수 없습니다. HTTP 302")));
        assertEquals("server",OfficeBoardClient.networkKind(new Exception("게시판 서버에 연결할 수 없습니다. HTTP 503")));
        assertEquals("server",OfficeBoardClient.networkKind(new Exception(OfficeBoardClient.BAD_RESPONSE)));
        assertNull(OfficeBoardClient.networkMessage("server"));
    }
    @Test public void boardAnswersAreNotNetworkFailures(){
        assertEquals("",OfficeBoardClient.networkKind(new Exception("account_revoked · 관리자에게 계정 상태를 확인해 주세요.")));
        assertEquals("",OfficeBoardClient.networkKind(new Exception("요청 권한이 없습니다. 관리자에게 계정 상태를 확인해 주세요.")));
        assertEquals("",OfficeBoardClient.networkKind(new Exception("게시판 서버에 연결할 수 없습니다. HTTP 404")));
        assertEquals("",OfficeBoardClient.networkKind(new Exception("HTTP 409 edit_conflict")));
        assertEquals("",OfficeBoardClient.networkKind(null));
        assertNull(OfficeBoardClient.networkMessage(""));
    }
}
