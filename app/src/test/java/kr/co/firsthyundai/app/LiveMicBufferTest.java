package kr.co.firsthyundai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class LiveMicBufferTest {
 @Test public void preserveOrderAndCopyReusedRecordBuffer(){
  LiveMicBuffer q=new LiveMicBuffer();
  byte[] reused={1,2,3,4};
  assertTrue(q.offer(reused,4));
  reused[0]=9;
  assertTrue(q.offer(reused,2));
  assertArrayEquals(new byte[]{1,2,3,4},q.poll());
  assertArrayEquals(new byte[]{9,2},q.poll());
  assertEquals(0,q.bytes());assertNull(q.poll());
 }
 @Test public void failsClosedBeforeMoreThanOneSecondCanBeDropped(){
  LiveMicBuffer q=new LiveMicBuffer();
  for(int i=0;i<25;i++)assertTrue(q.offer(new byte[1280],1280));
  assertEquals(LiveMicBuffer.MAX_BYTES,q.bytes());
  assertFalse(q.offer(new byte[2],2));
  assertEquals(LiveMicBuffer.MAX_BYTES,q.bytes());
  q.clear();
  assertTrue(q.isEmpty());assertTrue(q.offer(new byte[1280],1280));
 }
 @Test public void rejectCorruptPcmWithoutStoringData(){
  LiveMicBuffer q=new LiveMicBuffer();
  assertFalse(q.offer(null,2));
  assertFalse(q.offer(new byte[2],0));
  assertFalse(q.offer(new byte[2],3));
  assertFalse(q.offer(new byte[3],3));
  assertFalse(q.offer(new byte[4098],4098));
  assertTrue(q.isEmpty());
 }
}
