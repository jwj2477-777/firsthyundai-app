package kr.co.firsthyundai.app;

import okio.ByteString;

/** Converts Google's binary WebSocket JSON frames to UTF-8 with a fixed size limit.
 * Never logs raw frames, transcripts or audio data.
 */
final class GeminiLiveFrame {
    private GeminiLiveFrame() {}
    static String text(ByteString frame) {
        if (frame == null || frame.size() == 0 || frame.size() > 1_500_000) return "";
        return frame.utf8();
    }
}
