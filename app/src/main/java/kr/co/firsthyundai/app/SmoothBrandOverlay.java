package kr.co.firsthyundai.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Brand handoff on the Android compositor, not a second SVG painted by WebView.
 * Matches LockActivity's real welcome logo/text/colors and remains on-screen while
 * WebView loads. The native branded elements shrink into the actual DOM header
 * positions and are replaced there at the end of one uninterrupted transition.
 *
 * Does not store credentials, change authentication or delay HTTP work.
 */
final class SmoothBrandOverlay extends FrameLayout {
    private final View backdrop;
    private final FrameLayout emblemFrame;
    private final ImageView emblem;
    private final TextView title;
    private final TextView subtitle;
    private final View ring,rule;
    private boolean finished;
    private int layoutAttempts;
    private static final long DURATION=680L;
    private final PathInterpolator natural=new PathInterpolator(.22f,1f,.36f,1f);

    private int dp(int x){return (int)(getResources().getDisplayMetrics().density*x+.5f);}
    SmoothBrandOverlay(Activity activity){
        super(activity);
        setClickable(true);
        setContentDescription("퍼스트현대 브랜드에서 메인 화면으로 전환 중. 터치하면 건너뛰기");
        setClipChildren(false);
        setClipToPadding(false);
        backdrop=new View(activity);
        backdrop.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(3,33,42),Color.rgb(9,91,94)}));
        addView(backdrop,new LayoutParams(-1,-1));

        LinearLayout identity=new LinearLayout(activity);
        identity.setOrientation(LinearLayout.VERTICAL);
        identity.setGravity(Gravity.CENTER);
        identity.setClipChildren(false);
        emblemFrame=new FrameLayout(activity);
        emblemFrame.setClipChildren(false);
        emblemFrame.setClipToPadding(false);
        ring=new View(activity);
        GradientDrawable oval=new GradientDrawable();
        oval.setShape(GradientDrawable.OVAL);
        oval.setColor(Color.TRANSPARENT);
        oval.setStroke(dp(1),Color.argb(115,230,186,95));
        ring.setBackground(oval);
        emblemFrame.addView(ring,new LayoutParams(dp(168),dp(168),Gravity.CENTER));
        emblem=new ImageView(activity);
        emblem.setImageResource(R.drawable.ic_launcher_badge);
        emblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        emblem.setContentDescription("퍼스트현대 FHD FIRST 원본 로고");
        emblemFrame.addView(emblem,new LayoutParams(dp(144),dp(144),Gravity.CENTER));
        identity.addView(emblemFrame,new LinearLayout.LayoutParams(dp(190),dp(190)));

        title=new TextView(activity);
        title.setText("퍼스트현대");
        title.setTextSize(30);
        title.setTextColor(Color.WHITE);
        title.setTypeface(null,1);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tl=new LinearLayout.LayoutParams(-2,-2);
        tl.topMargin=dp(12);
        identity.addView(title,tl);
        rule=new View(activity);
        rule.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.argb(0,217,173,92),Color.rgb(238,201,126),Color.argb(0,217,173,92)}));
        LinearLayout.LayoutParams line=new LinearLayout.LayoutParams(dp(96),dp(2));
        line.gravity=Gravity.CENTER_HORIZONTAL;
        line.topMargin=dp(14);
        identity.addView(rule,line);
        subtitle=new TextView(activity);
        subtitle.setText("FIRST HYUNDAI  ·  REAL ESTATE");
        subtitle.setTextColor(Color.rgb(246,215,145));
        subtitle.setTextSize(11);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setLetterSpacing(.1f);
        LinearLayout.LayoutParams sub=new LinearLayout.LayoutParams(-2,-2);
        sub.topMargin=dp(13);
        identity.addView(subtitle,sub);
        addView(identity,new LayoutParams(-1,-2,Gravity.CENTER));
    }

    /**
     * The rects are actual WebView CSS viewport positions, adjusted for the
     * real native view size. The overlay and WebView share a FrameLayout.
     * Each row: [left,top,width,height]. Input can represent narrow devices.
     */
    void moveToHeader(float[] rects,float viewportWidth,View web,Runnable done){
        if(finished)return;
        if(rects==null||rects.length!=12||viewportWidth<=0||web.getWidth()<=0){
            fadeOut(done);
            return;
        }
        float pxPerCss=web.getWidth()/viewportWidth;
        if(!Float.isFinite(pxPerCss)||pxPerCss<=0){fadeOut(done);return;}
        // Wait for the native emblem to be laid out, so its starting center
        // exactly matches the original LockActivity welcome center.
        if(emblem.getWidth()==0||title.getWidth()==0){
            if(++layoutAttempts>8){fadeOut(done);return;}
            postDelayed(()->moveToHeader(rects,viewportWidth,web,done),16);
            return;
        }
        View[] parts={emblem,title,subtitle};
        int[] base=new int[2],source=new int[2];
        getLocationOnScreen(base);
        for(int i=0;i<3;i++){
            int k=i*4;
            float x=rects[k],y=rects[k+1],w=rects[k+2],h=rects[k+3];
            if(!Float.isFinite(x)||!Float.isFinite(y)||!Float.isFinite(w)||
               !Float.isFinite(h)||w<=0||h<=0){fadeOut(done);return;}
        }
        for(int i=0;i<3;i++){
            int k=i*4;
            View part=parts[i];
            part.getLocationOnScreen(source);
            float sourceCX=source[0]-base[0]+part.getWidth()/2f;
            float sourceCY=source[1]-base[1]+part.getHeight()/2f;
            float targetCX=web.getLeft()+(rects[k]+rects[k+2]/2f)*pxPerCss;
            float targetCY=web.getTop()+(rects[k+1]+rects[k+3]/2f)*pxPerCss;
            // Uniform, aspect-preserving scale. Never stretch the FHD emblem.
            float scale=Math.min(rects[k+2]*pxPerCss/part.getWidth(),
                                 rects[k+3]*pxPerCss/part.getHeight());
            // Large text native/Web font metrics may differ; landing blend
            // replaces the native glyphs without stretching them.
            part.animate().cancel();
            part.animate()
                .translationX(targetCX-sourceCX).translationY(targetCY-sourceCY)
                .scaleX(scale).scaleY(scale).setDuration(DURATION)
                .setInterpolator(natural).start();
        }
        ring.animate().alpha(0f).setDuration(350).start();
        rule.animate().alpha(0f).setDuration(320).start();
        // Brand movement starts before the underlying screen appears. It is
        // mostly revealed only as the elements reach their destination.
        backdrop.animate().alpha(0f).setStartDelay(140).setDuration(DURATION-95)
                .setInterpolator(natural).start();
        postDelayed(()->finish(done),DURATION);
    }
    void fadeOut(Runnable done){
        if(finished)return;
        backdrop.animate().alpha(0f).setDuration(190).start();
        animate().alpha(0f).setDuration(210).withEndAction(()->finish(done)).start();
    }
    void finish(Runnable done){
        if(finished)return;
        finished=true;
        emblem.animate().cancel();
        title.animate().cancel();
        subtitle.animate().cancel();
        backdrop.animate().cancel();
        rule.animate().cancel();
        ring.animate().cancel();
        animate().cancel();
        if(done!=null)done.run();
        else detach();
    }
    void detach(){
        if(getParent() instanceof ViewGroup)((ViewGroup)getParent()).removeView(this);
    }
    boolean isFinished(){return finished;}
}
