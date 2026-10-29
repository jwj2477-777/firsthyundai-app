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
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.core.graphics.PathParser;
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
                {"themeDecor","off","subtle","full"},{"themeIntro","on","off"},{"themeHeader","on","off"},{"themeLogo","on","off"},{"themeCaption","on","off"},
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
        if(!"default".equals(theme))colors=SeasonThemeMath.ambientPalette(colors,System.currentTimeMillis());
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
    private static int dp(Context c,float n){return Math.round(c.getResources().getDisplayMetrics().density*n);}
    /** Independent overlay: adding the caption never moves the original identity. */
    static TextView addSeasonCaption(FrameLayout host,Context c){
        SharedPreferences p=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        if(!"on".equals(p.getString("themeIntro","on"))||!"on".equals(p.getString("themeCaption","on")))return null;
        long now=System.currentTimeMillis();
        String theme="season".equals(p.getString("themeMode","manual"))?SeasonThemeMath.season(now):p.getString("theme","default");
        String text=SeasonThemeMath.caption(theme,now);if(text.isEmpty())return null;
        TextView caption=new TextView(c);caption.setText(text);caption.setTextSize(13);
        caption.setTextColor(0xffE5EBEF);caption.setAlpha(.78f);caption.setLetterSpacing(.13f);
        caption.setGravity(Gravity.CENTER);caption.setIncludeFontPadding(false);
        caption.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
        lp.bottomMargin=Math.max(dp(c,48),Math.round(c.getResources().getDisplayMetrics().heightPixels*.12f));
        // Small landscape screens keep the caption clear of the center identity.
        if(c.getResources().getConfiguration().screenHeightDp<480){lp.gravity=Gravity.TOP|Gravity.RIGHT;lp.topMargin=dp(c,20);lp.rightMargin=dp(c,20);}
        host.addView(caption,lp);return caption;
    }
    static View addLogoPoint(FrameLayout frame,Context c,float frameDp,float badgeDp){
        SharedPreferences p=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        if(logoAccent(c,true)==0||"off".equals(p.getString("themeDecor","full")))return null;
        String kind="season".equals(p.getString("themeMode","manual"))?SeasonThemeMath.season(System.currentTimeMillis()):p.getString("theme","default");
        String wet=p.getString("weatherEffect","none");
        if("auto".equals(wet)){
            wet="none";
            try{long age=System.currentTimeMillis()-OffsetDateTime.parse(p.getString("weatherObserved","")).toInstant().toEpochMilli();
                if(age>=-300000&&age<=7200000)wet=p.getString("resolvedWeather","none");
            }catch(Exception ignored){}
        }
        if("rain".equals(wet)||"snow".equals(wet))kind=wet;
        View point=new View(c);point.setBackground(new SeasonPoint(kind));
        point.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(c,badgeDp*18/52),dp(c,badgeDp*18/52),Gravity.TOP|Gravity.RIGHT);
        lp.topMargin=lp.rightMargin=dp(c,(frameDp-badgeDp)/2-badgeDp*5/52);
        frame.addView(point,lp);return point;
    }
    /** Same six small nature symbols as season-point-*.svg; the FHD mark is untouched. */
    private static final class SeasonPoint extends Drawable{
        private final String kind;private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        SeasonPoint(String value){kind=value;}
        private void fill(Canvas c,String data,int color){p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawPath(PathParser.createPathFromPathData(data),p);}
        private void stroke(Canvas c,String data,int color,float width){p.setStyle(Paint.Style.STROKE);p.setColor(color);p.setStrokeWidth(width);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);c.drawPath(PathParser.createPathFromPathData(data),p);p.setStyle(Paint.Style.FILL);}
        @Override public void draw(Canvas c){
            c.save();c.translate(getBounds().left,getBounds().top);c.scale(getBounds().width()/24f,getBounds().height()/24f);
            if("spring".equals(kind)){
                p.setColor(0xffF4B8D1);for(int i=0;i<5;i++){c.save();c.rotate(i*72,12,12);c.drawOval(new RectF(8.3f,1.7f,15.7f,11.9f),p);c.restore();}
                p.setColor(0xffEFC36D);c.drawCircle(12,12,2.5f,p);
            }else if("summer".equals(kind)){
                stroke(c,"M12 1v2M4.2 4.2l1.5 1.5M1 12h2M19.8 4.2l-1.5 1.5M21 12h2",0xffF6D47E,1.5f);
                p.setColor(0xffF6D47E);c.drawCircle(12,10,5,p);
                stroke(c,"M2 17q2.5-3 5 0t5 0t5 0t5 0M2 21q2.5-3 5 0t5 0t5 0t5 0",0xff6ADDE0,1.7f);
            }else if("autumn".equals(kind)){
                fill(c,"M12 1l2.5 6 3-2-.5 5 5-1-2 5 3 2-9 3 .5 4h-3l.5-4-9-3 3-2-2-5 5 1-.5-5 3 2z",0xffE9A454);
                stroke(c,"M12 7v12M7 13l5 3 5-3",0xffA76539,.8f);
            }else if("winter".equals(kind)){
                fill(c,"M12 1l-6 7h3l-5 6h4l-5 6h18l-5-6h4l-5-6h3z",0xff9EBBD5);
                fill(c,"M12 1L6 8h3l3-2 3 2h3zM7 12l-3 2h4l4-2 4 2h4l-3-2-5-3zM6 17l-3 3h18l-3-3-6-2z",0xffEEF7FF);
                stroke(c,"M12 20v3",0xffC8A77D,2);
            }else if("rain".equals(kind)){
                fill(c,"M12 1C10 5 4 10 4 15a8 8 0 0 0 16 0C20 10 14 5 12 1z",0xff78C6DF);
                stroke(c,"M8 14q-2 4 2 5",0xffD6F5FF,1.6f);
            }else if("snow".equals(kind))stroke(c,"M12 1v22M2.5 6.5l19 11M2.5 17.5l19-11M8.5 3.5L12 7l3.5-3.5M8.5 20.5L12 17l3.5 3.5M3 10l4.7-1.3L6.5 4M17.5 20l-1.2-4.7L21 14M6.5 20l1.2-4.7L3 14M21 10l-4.7-1.3L17.5 4",0xffECF8FF,1.6f);
            c.restore();
        }
        @Override public void setAlpha(int a){p.setAlpha(a);invalidateSelf();}
        @Override public void setColorFilter(ColorFilter f){p.setColorFilter(f);}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
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
                if(i%5==0&&("spring".equals(kind)||"autumn".equals(kind)||"winter".equals(kind))){
                    // A few recognizable seasonal points among the quieter edge texture.
                    c.restore();c.save();
                    c.saveLayerAlpha(x-u*3,y-u*3,x+u*3,y+u*3,(int)((soft?65:110)*opacity/255f));
                    SeasonPoint point=new SeasonPoint(kind);
                    point.setBounds((int)(x-u*3),(int)(y-u*3),(int)(x+u*3),(int)(y+u*3));
                    point.draw(c);c.restore();
                }else if("rain".equals(kind))c.drawLine(x,y,x,y+u*7,paint);
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
