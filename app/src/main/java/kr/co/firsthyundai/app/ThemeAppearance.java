package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import org.json.JSONObject;
import java.time.OffsetDateTime;

/** Non-sensitive display cache only. Never changes accounts, access, logos or geometry. */
final class ThemeAppearance {
    private static final String PREF="fhd-theme-appearance-v1";
    static void cache(Context context,String json){
        if(json==null||json.length()>1600)return;
        try{
            JSONObject value=new JSONObject(json);
            String[][] fields={
                {"theme","default","spring","summer","autumn","winter"},
                {"themeMode","manual","season"},{"themeIntensity","soft","balanced","vivid"},
                {"themeDecor","off","subtle","full"},{"themeIntro","on","off"},{"themeHeader","on","off"},{"themeLogo","on","off"},
                {"weatherEffect","none","rain","snow","auto"},{"resolvedWeather","none","rain","snow"}
            };
            SharedPreferences.Editor editor=context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit();
            for(String[] field:fields){
                String text=value.optString(field[0],"");boolean valid=false;
                for(int i=1;i<field.length;i++)if(field[i].equals(text))valid=true;
                if(!valid)return;editor.putString(field[0],text);
            }
            String observed=value.optString("weatherObserved","");
            if(!observed.isEmpty())OffsetDateTime.parse(observed);
            editor.putString("weatherObserved",observed).apply();
        }catch(Exception ignored){}
    }
    static Drawable background(Context context,boolean intro){
        SharedPreferences p=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String enabled=p.getString(intro?"themeIntro":"themeHeader","on");
        String theme="season".equals(p.getString("themeMode","manual"))?
            SeasonThemeMath.season(System.currentTimeMillis()):p.getString("theme","default");
        if(!"on".equals(enabled))theme="default";
        String intensity=p.getString("themeIntensity","balanced");
        int[] colors="default".equals(theme)&&intro?new int[]{Color.rgb(3,33,42),Color.rgb(9,91,94)}:SeasonThemeMath.palette(theme,intensity);
        GradientDrawable base=new GradientDrawable(GradientDrawable.Orientation.TL_BR,colors);
        String decor=p.getString("themeDecor","full"),wet=p.getString("weatherEffect","none");
        if("auto".equals(wet)){
            wet="none";
            try{
                long elapsed=System.currentTimeMillis()-OffsetDateTime.parse(p.getString("weatherObserved","")).toInstant().toEpochMilli();
                if(elapsed>=-300000&&elapsed<=7200000)wet=p.getString("resolvedWeather","none");
            }catch(Exception ignored){}
        }
        if(!"on".equals(enabled)||"off".equals(decor)||("default".equals(theme)&&"none".equals(wet)))return base;
        String motif="none".equals(wet)?theme:wet;
        return new LayerDrawable(new Drawable[]{base,new Motif(motif,"subtle".equals(decor),"soft".equals(intensity))});
    }
    static int logoAccent(Context context,boolean intro){
        SharedPreferences p=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        if(!"on".equals(p.getString(intro?"themeIntro":"themeHeader","on"))||!"on".equals(p.getString("themeLogo","on")))return 0;
        String wet=p.getString("weatherEffect","none");
        if("auto".equals(wet)){
            wet="none";
            try{
                long age=System.currentTimeMillis()-OffsetDateTime.parse(p.getString("weatherObserved","")).toInstant().toEpochMilli();
                if(age>=-300000&&age<=7200000)wet=p.getString("resolvedWeather","none");
            }catch(Exception ignored){}
        }
        if("rain".equals(wet))return 0xff78C6DF;
        if("snow".equals(wet))return 0xffE3F1FF;
        String theme="season".equals(p.getString("themeMode","manual"))?SeasonThemeMath.season(System.currentTimeMillis()):p.getString("theme","default");
        switch(theme){
            case "spring":return 0xffF2B5CE;
            case "summer":return 0xff6ADDE0;
            case "autumn":return 0xffE9B277;
            case "winter":return 0xffB9D5FF;
            default:return 0;
        }
    }
    /** Static edge artwork during the short native welcome; no animation timer. */
    private static final class Motif extends Drawable{
        private final String kind;private final boolean subtle,soft;
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private int opacity=255;
        Motif(String value,boolean small,boolean gentle){kind=value;subtle=small;soft=gentle;}
        @Override public void draw(Canvas c){
            float w=getBounds().width(),h=getBounds().height(),u=Math.min(w,h)/70f;
            int count=subtle?9:("rain".equals(kind)?28:"snow".equals(kind)?24:18);
            int color="spring".equals(kind)?0xffF2B5CE:"autumn".equals(kind)?0xffE9B277:
                "rain".equals(kind)?0xff78C6DF:0xffDBECFF;
            paint.setColor(color);paint.setAlpha((int)((soft?50:100)*opacity/255f));
            paint.setStrokeWidth(Math.max(1,u*.13f));
            if("summer".equals(kind)){
                paint.setStyle(Paint.Style.STROKE);
                for(int i=0;i<3;i++)c.drawCircle(w*.97f,h*.1f,w*(.18f+i*.06f),paint);
                paint.setStyle(Paint.Style.FILL);return;
            }
            for(int i=0;i<count;i++){
                float x=(i%2==0?.035f+(i%3)*.035f:.89f+(i%3)*.035f)*w;
                float y=((i*17%95)+2)/100f*h;
                c.save();c.rotate("rain".equals(kind)?9:(i*31)%140,x,y);
                if("rain".equals(kind))c.drawLine(x,y,x,y+u*7,paint);
                else if("snow".equals(kind)){
                    c.drawCircle(x,y,u*.65f,paint);
                    for(int arm=0;arm<3;arm++){c.save();c.rotate(arm*60,x,y);c.drawLine(x-u*1.5f,y,x+u*1.5f,y,paint);c.restore();}
                }else if("winter".equals(kind)){
                    c.drawCircle(x,y,u*.25f,paint);
                }else if("autumn".equals(kind)){
                    Path leaf=new Path();leaf.moveTo(x-u,y+u*2);leaf.quadTo(x-u*2,y-u,x+u,y-u*2);leaf.quadTo(x+u*2,y+u,x-u,y+u*2);c.drawPath(leaf,paint);
                }else c.drawOval(new RectF(x-u,y-u*1.5f,x+u,y+u*1.5f),paint);
                c.restore();
            }
        }
        @Override public void setAlpha(int value){opacity=value;invalidateSelf();}
        @Override public void setColorFilter(ColorFilter value){paint.setColorFilter(value);}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    }
    private ThemeAppearance(){}
}
