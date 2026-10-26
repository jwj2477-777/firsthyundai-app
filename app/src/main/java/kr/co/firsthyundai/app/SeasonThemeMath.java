package kr.co.firsthyundai.app;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/** Matches season-themes.js: Korean term DAY, not a minute-accurate ephemeris. */
final class SeasonThemeMath {
    private static final ZoneOffset KST=ZoneOffset.ofHours(9);
    private static double longitude(double ms) {
        double d=ms/86400000d+2440587.5-2451545d;
        double g=Math.toRadians(357.529+.98560028*d);
        double value=280.459+.98564736*d+1.915*Math.sin(g)+.020*Math.sin(2*g);
        return ((value%360)+360)%360;
    }
    static long termDay(int year,int i) {
        int[] month={2,5,8,11};double[] target={315,45,135,225};
        double lo=LocalDate.of(year,month[i],1).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli();
        double hi=LocalDate.of(year,month[i],12).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli();
        for(int n=0;n<36;n++){
            double mid=(lo+hi)/2,diff=((longitude(mid)-target[i]+540)%360)-180;
            if(diff<0)lo=mid;else hi=mid;
        }
        return Instant.ofEpochMilli((long)hi).atOffset(KST).toLocalDate().atStartOfDay().toInstant(KST).toEpochMilli();
    }
    static String season(long now) {
        String[] names={"spring","summer","autumn","winter"};String name="winter";
        int year=Instant.ofEpochMilli(now).atOffset(KST).getYear();
        for(int i=0;i<4;i++)if(now>=termDay(year,i))name=names[i];return name;
    }
    static int[] palette(String theme,String intensity) {
        int[] base={0xff102D38,0xff183E49,0xff23575D},target;
        switch(theme){
            case "spring":target=new int[]{0xff34503C,0xff4B684A,0xff4F6840};break;
            case "summer":target=new int[]{0xff083D57,0xff075D79,0xff126570};break;
            case "autumn":target=new int[]{0xff49362F,0xff6D5039,0xff735031};break;
            case "winter":target=new int[]{0xff263849,0xff3E526D,0xff4F5F78};break;
            default:return base;
        }
        double k="soft".equals(intensity)?.4:"vivid".equals(intensity)?1:.8;
        int[] result=new int[3];
        for(int i=0;i<3;i++){
            int c=0xff000000;
            for(int shift:new int[]{16,8,0}){
                int a=(base[i]>>shift)&255,b=(target[i]>>shift)&255;
                c|=((int)Math.round(a*(1-k)+b*k))<<shift;
            }
            result[i]=c;
        }
        return result;
    }
    private SeasonThemeMath(){}
}
