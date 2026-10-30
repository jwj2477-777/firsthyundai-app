package kr.co.firsthyundai.app;

import org.junit.Test;
import org.json.JSONObject;
import okio.ByteString;
import static org.junit.Assert.*;

public class GeminiLiveFrameTest {
    @Test public void binarySetupFrameIsDecodedAsJson() throws Exception {
        // The actual Google WebSocket was verified to return a BINARY setupComplete JSON frame.
        ByteString binary=ByteString.encodeUtf8("{\"setupComplete\":{}}");
        assertTrue(new JSONObject(GeminiLiveFrame.text(binary)).has("setupComplete"));
        ByteString output=ByteString.encodeUtf8("{\"serverContent\":{\"inputTranscription\":{\"text\":\"테스트\"}}}");
        assertEquals("테스트",new JSONObject(GeminiLiveFrame.text(output))
            .getJSONObject("serverContent").getJSONObject("inputTranscription").getString("text"));
    }
    @Test public void emptyAndOversizedFramesAreIgnored() {
        assertEquals("",GeminiLiveFrame.text(null));
        assertEquals("",GeminiLiveFrame.text(ByteString.EMPTY));
        assertEquals("",GeminiLiveFrame.text(ByteString.of(new byte[1_500_001])));
    }
}
