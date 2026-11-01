package kr.co.firsthyundai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class LivePcmQueueTest {
 @Test public void neverSilentlyEvictsSpeechAndPreservesOrder(){
  LivePcmQueue q=new LivePcmQueue();
  byte[] first={1,2},second={3,4};
  assertTrue(q.offer(first,0));assertTrue(q.offer(second,0));
  assertEquals(4,q.bytes());
  assertSame(first,q.poll().pcm);assertSame(second,q.poll().pcm);
  assertNull(q.poll());assertEquals(0,q.bytes());
 }
 @Test public void overflowFailsClosedRatherThanDroppingMiddleChunks(){
  LivePcmQueue q=new LivePcmQueue();
  byte[] packet=new byte[48_000];
  for(int i=0;i<12;i++)assertTrue(q.offer(packet,0));
  assertEquals(LivePcmQueue.MAX_BYTES,q.bytes());
  assertFalse(q.offer(new byte[]{8,9},0));
  assertEquals(LivePcmQueue.MAX_BYTES,q.bytes());
  assertEquals(0,q.poll().generation);
  assertTrue(q.offer(new byte[]{8,9},1));
  q.clear();assertTrue(q.isEmpty());assertEquals(0,q.bytes());
 }
 @Test public void rejectInvalidFrames(){
  LivePcmQueue q=new LivePcmQueue();
  assertFalse(q.offer(null,0));
  assertFalse(q.offer(new byte[0],0));
  assertFalse(q.offer(new byte[100001],0));
  assertEquals(0,q.bytes());
 }
}
