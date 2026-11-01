package kr.co.firsthyundai.app;

import java.util.ArrayDeque;
import java.util.Arrays;

/** Bounded, volatile microphone jitter buffer. Retains the actual PCM16 chunks
 * in order during short WebSocket congestion, rather than discarding spoken
 * syllables and allowing Gemini to invent missing contract information.
 * No transcript, contract, or audio bytes are persisted or logged.
 */
final class LiveMicBuffer {
    // 1 second of 16-kHz mono PCM16. Longer outages must fail explicitly.
    static final int MAX_BYTES=16_000*2;
    private final ArrayDeque<byte[]> frames=new ArrayDeque<>();
    private int bytes=0;
    synchronized boolean offer(byte[] samples,int n){
        if(samples==null||n<=0||n>samples.length||n>4096||(n&1)!=0||
           bytes>MAX_BYTES-n)return false;
        frames.addLast(Arrays.copyOf(samples,n));
        bytes+=n;
        return true;
    }
    synchronized byte[] poll(){
        byte[] result=frames.pollFirst();
        if(result!=null)bytes-=result.length;
        return result;
    }
    synchronized int bytes(){return bytes;}
    synchronized boolean isEmpty(){return frames.isEmpty();}
    synchronized void clear(){frames.clear();bytes=0;}
}
