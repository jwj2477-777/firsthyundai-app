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
    static String caption(String theme,long now) {
        String label;
        switch(theme){
            case "spring":label="봄";break;
            case "summer":label="여름";break;
            case "autumn":label="가을";break;
            case "winter":label="겨울";break;
            default:return "";
        }
        return Instant.ofEpochMilli(now).atOffset(KST).getYear()+"년 "+label;
    }
    static int[] palette(String theme,String intensity) {
        int[] base={0xff102D38,0xff183E49,0xff23575D},target;
        switch(theme){
            case "spring":target=new int[]{0xff4D354E,0xff704B65,0xff765864};break;
            case "summer":target=new int[]{0xff073E55,0xff086B7B,0xff0F6A66};break;
            case "autumn":target=new int[]{0xff51352D,0xff784E32,0xff79532B};break;
            case "winter":target=new int[]{0xff232F50,0xff35476D,0xff4B557E};break;
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
    /** Matches the web header's faint Korean-local time-of-day tint. */
    static int[] ambientPalette(int[] colors,long now){
        int hour=Instant.ofEpochMilli(now).atOffset(KST).getHour();
        int tint;double amount;
        if(hour>=5&&hour<10){tint=0xffE7AD83;amount=.095;}
        else if(hour>=10&&hour<17){tint=0xffA8D7DC;amount=.025;}
        else if(hour>=17&&hour<20){tint=0xffDC947A;amount=.105;}
        else{tint=0xff7885B2;amount=.075;}
        int[] result=colors.clone();
        for(int i=0;i<result.length;i++){
            int mixed=0xff000000;
            for(int shift:new int[]{16,8,0}){
                int a=(result[i]>>shift)&255,b=(tint>>shift)&255;
                mixed|=((int)Math.round(a*(1-amount)+b*amount))<<shift;
            }
            result[i]=mixed;
        }
        return result;
    }
    private SeasonThemeMath(){}
}
