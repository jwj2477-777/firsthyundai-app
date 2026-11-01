package kr.co.firsthyundai.app;

import java.util.ArrayDeque;

/** Only ephemeral 24kHz PCM frames. No persistence, transcript or logging.
 * Queue is bounded in bytes and cleared whenever the model genuinely interrupts.
 */
final class LivePcmQueue {
    static final int MAX_BYTES=24_000*2*12; // 12 seconds, 576 KiB at 24kHz/16-bit
    static final class Frame {
        final byte[] pcm;
        final int generation;
        Frame(byte[] data,int generation){this.pcm=data;this.generation=generation;}
    }
    private final ArrayDeque<Frame> frames=new ArrayDeque<>();
    private int bytes=0;
    synchronized boolean offer(byte[] data,int generation){
        if(data==null||data.length==0||data.length>100_000||
           bytes>MAX_BYTES-data.length)return false;
        frames.addLast(new Frame(data,generation));bytes+=data.length;
        return true;
    }
    synchronized Frame poll(){
        Frame frame=frames.pollFirst();
        if(frame!=null)bytes-=frame.pcm.length;
        return frame;
    }
    synchronized void clear(){frames.clear();bytes=0;}
    synchronized int bytes(){return bytes;}
    synchronized boolean isEmpty(){return frames.isEmpty();}
}
