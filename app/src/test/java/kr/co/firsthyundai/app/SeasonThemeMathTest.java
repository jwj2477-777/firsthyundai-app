package kr.co.firsthyundai.app;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.OffsetDateTime;
public class SeasonThemeMathTest {
 @Test public void nativeTermDaysMatchWebAndKoreanCalendar(){
  String[] days={"2026-02-04","2026-05-05","2026-08-07","2026-11-07"};
  String[] names={"spring","summer","autumn","winter"};
  for(int i=0;i<4;i++){
   long t=OffsetDateTime.parse(days[i]+"T00:00:00+09:00").toInstant().toEpochMilli();
   assertEquals(t,SeasonThemeMath.termDay(2026,i));assertEquals(names[i],SeasonThemeMath.season(t));
   assertEquals(i==0?"winter":names[i-1],SeasonThemeMath.season(t-1));
  }
 }
 @Test public void originalBrandAndIntensityEndpointsStayStable(){
  assertArrayEquals(new int[]{0xff102D38,0xff183E49,0xff23575D},SeasonThemeMath.palette("default","vivid"));
  assertArrayEquals(new int[]{0xff51352D,0xff784E32,0xff79532B},SeasonThemeMath.palette("autumn","vivid"));
  assertNotEquals(SeasonThemeMath.palette("spring","soft")[0],SeasonThemeMath.palette("spring","vivid")[0]);
 }
}
