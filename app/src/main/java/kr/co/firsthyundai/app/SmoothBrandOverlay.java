package kr.co.firsthyundai.app;

import android.app.Activity;
import android.animation.ObjectAnimator;
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
import android.webkit.WebView;
import java.util.ArrayList;

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
    private final ImageView subtitle;
    private final View ring,rule,seasonPoint;
    private final TextView seasonCaption;
    private boolean finished,landingStarted,dissolveStarted;
    private int layoutAttempts;
    private final ArrayList<ObjectAnimator> arrivalFades=new ArrayList<>();
    private static final long DURATION=860L;
    // Quieter takeoff than v2.0.64's fast-start curve, with a long soft landing.
    private final PathInterpolator natural=new PathInterpolator(.30f,0f,.18f,1f);

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
        backdrop.setBackground(ThemeAppearance.background(activity,true));
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
        if(ThemeAppearance.logoAccent(activity,true)!=0)oval.setStroke(dp(2),ThemeAppearance.logoAccent(activity,true));
        ring.setBackground(oval);
        emblemFrame.addView(ring,new LayoutParams(dp(168),dp(168),Gravity.CENTER));
        emblem=new ImageView(activity);
        emblem.setImageResource(R.drawable.ic_launcher_badge);
        emblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        emblem.setContentDescription("퍼스트현대 FHD FIRST 원본 로고");
        emblemFrame.addView(emblem,new LayoutParams(dp(144),dp(144),Gravity.CENTER));
        seasonPoint=ThemeAppearance.addLogoPoint(emblemFrame,activity,190,144);
        // Pre-compose the travelling identity to keep transforms on Android's GPU.
        emblem.setLayerType(View.LAYER_TYPE_HARDWARE,null);
        identity.addView(emblemFrame,new LinearLayout.LayoutParams(dp(190),dp(190)));

        title=new TextView(activity);
        BrandIdentityStyle.title(title);
        title.setLayerType(View.LAYER_TYPE_HARDWARE,null);
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
        subtitle=new ImageView(activity);
        BrandIdentityStyle.subtitle(subtitle);
        subtitle.setLayerType(View.LAYER_TYPE_HARDWARE,null);
        LinearLayout.LayoutParams sub=BrandIdentityStyle.subtitleLayout(subtitle);
        sub.topMargin=dp(13);
        identity.addView(subtitle,sub);
        addView(identity,new LayoutParams(-1,-2,Gravity.CENTER));
        seasonCaption=ThemeAppearance.addSeasonCaption(this,activity);
    }

    /**
     * The rects are actual WebView CSS viewport positions, adjusted for the
     * real native view size. The overlay and WebView share a FrameLayout.
     * Each row: [left,top,width,height]. Input can represent narrow devices.
     */
    void moveToHeader(float[] rects,float viewportWidth,float[] metrics,WebView web,Runnable done){
        if(finished)return;
        if(rects==null||rects.length!=12||metrics==null||metrics.length!=4||viewportWidth<=0||web.getWidth()<=0){
            fadeOut(done);
            return;
        }
        float pxPerCss=web.getWidth()/viewportWidth;
        if(!Float.isFinite(pxPerCss)||pxPerCss<=0){fadeOut(done);return;}
        // Wait for the native emblem to be laid out, so its starting center
        // exactly matches the original LockActivity welcome center.
        if(emblem.getWidth()==0||title.getWidth()==0||subtitle.getWidth()==0){
            if(++layoutAttempts>8){fadeOut(done);return;}
            postDelayed(()->moveToHeader(rects,viewportWidth,metrics,web,done),16);
            return;
        }
        View[] parts={emblem,title,subtitle};
        int[] base=new int[2],source=new int[2];
        getLocationOnScreen(base);
        for(int i=0;i<3;i++){
            int k=i*4;
            for(int j=0;j<4;j++)if(!Float.isFinite(rects[k+j])){fadeOut(done);return;}
            if(i<2&&(rects[k+2]<=0||rects[k+3]<=0)){fadeOut(done);return;}
        }
        for(float value:metrics)if(!Float.isFinite(value)){fadeOut(done);return;}
        for(int i=0;i<3;i++){
            int k=i*4;
            View part=parts[i];
            if(i==2&&(rects[k+2]<=0||rects[k+3]<=0)){
                // Narrow layouts intentionally hide the English line.
                part.animate().alpha(0f).setDuration(320).start();
                continue;
            }
            part.getLocationOnScreen(source);
            float sourceX=source[0]-base[0],sourceY=source[1]-base[1];
            float scale,targetX,targetY;
            float scaleY;
            if(part instanceof TextView){
                TextView text=(TextView)part;
                int metric=i==1?0:2;
                scale=BrandLandingMath.textScale(metrics[metric],pxPerCss,text.getTextSize());
                targetX=web.getLeft()+rects[k]*pxPerCss;
                targetY=web.getTop()+BrandLandingMath.textTop(metrics[metric+1],pxPerCss,text.getBaseline(),scale);
            }else{
                scale=Math.min(rects[k+2]*pxPerCss/part.getWidth(),
                               rects[k+3]*pxPerCss/part.getHeight());
                targetX=web.getLeft()+(rects[k]+rects[k+2]/2f)*pxPerCss-part.getWidth()*scale/2f;
                targetY=web.getTop()+(rects[k+1]+rects[k+3]/2f)*pxPerCss-part.getHeight()*scale/2f;
            }
            scaleY=scale;
            if(i==2){
                // Match the two real vector rectangles exactly, compensating
                // only the sub-pixel rounding of native WRAP_CONTENT bounds.
                scale=rects[k+2]*pxPerCss/part.getWidth();
                scaleY=rects[k+3]*pxPerCss/part.getHeight();
                targetX=web.getLeft()+rects[k]*pxPerCss;
                targetY=web.getTop()+rects[k+1]*pxPerCss;
            }
            if(!Float.isFinite(scale)||scale<=0||!Float.isFinite(scaleY)||scaleY<=0){fadeOut(done);return;}
            part.setPivotX(0f);part.setPivotY(0f);
            part.animate().cancel();
            part.animate().translationX(targetX-sourceX).translationY(targetY-sourceY)
                .scaleX(scale).scaleY(scaleY).setDuration(DURATION).setInterpolator(natural);
            if(i==0)part.animate().withEndAction(()->settleAtHeader(web,done));
            part.animate().start();
        }
        // Keep the original gold halo visually attached to the emblem rather
        // than leaving a stationary ring behind in the middle of the screen.
        View badgePart=emblem;
        int[] badgeAt=new int[2],ringAt=new int[2];
        badgePart.getLocationOnScreen(badgeAt);
        ring.getLocationOnScreen(ringAt);
        float centerOffsetX=badgeAt[0]+badgePart.getWidth()/2f-ringAt[0]-ring.getWidth()/2f;
        float centerOffsetY=badgeAt[1]+badgePart.getHeight()/2f-ringAt[1]-ring.getHeight()/2f;
        float logoCX=rects[0]+rects[2]/2f;
        float logoCY=rects[1]+rects[3]/2f;
        float badgeTargetCX=web.getLeft()+logoCX*pxPerCss;
        float badgeTargetCY=web.getTop()+logoCY*pxPerCss;
        float nativeBadgeCX=badgeAt[0]-base[0]+badgePart.getWidth()/2f;
        float nativeBadgeCY=badgeAt[1]-base[1]+badgePart.getHeight()/2f;
        float badgeShiftX=badgeTargetCX-nativeBadgeCX;
        float badgeShiftY=badgeTargetCY-nativeBadgeCY;
        float ringScale=Math.min(rects[2]*pxPerCss/ring.getWidth(),
                                  rects[3]*pxPerCss/ring.getHeight());
        ring.animate().cancel();
        ring.animate().translationX(badgeShiftX+centerOffsetX)
                .translationY(badgeShiftY+centerOffsetY)
                .scaleX(ringScale).scaleY(ringScale)
                .setDuration(DURATION).setInterpolator(natural).start();
        if(seasonPoint!=null){
            int[] pointAt=new int[2];seasonPoint.getLocationOnScreen(pointAt);
            float pointCX=pointAt[0]-base[0]+seasonPoint.getWidth()/2f;
            float pointCY=pointAt[1]-base[1]+seasonPoint.getHeight()/2f;
            float scale=Math.min(rects[2]*pxPerCss/emblem.getWidth(),rects[3]*pxPerCss/emblem.getHeight());
            seasonPoint.animate().translationX(badgeTargetCX+(pointCX-nativeBadgeCX)*scale-pointCX)
                .translationY(badgeTargetCY+(pointCY-nativeBadgeCY)*scale-pointCY)
                .scaleX(scale).scaleY(scale).setDuration(DURATION).setInterpolator(natural).start();
        }
        // Isolate halo alpha from the ViewPropertyAnimator's motion.
        ObjectAnimator haloFade=ObjectAnimator.ofFloat(ring,View.ALPHA,1f,0f);
        haloFade.setStartDelay(DURATION-250L);
        haloFade.setDuration(250L);
        haloFade.start();
        arrivalFades.add(haloFade);
        // Both views have the same splash-white title, gold subtitle and
        // dark logo. Only their geometry changes during the move.
        rule.animate().alpha(0f).setStartDelay(245).setDuration(390).start();
        // The identity remains fully visible throughout the move. Its end
        // callback, rather than a second timer, starts the web/native handoff.
        backdrop.animate().alpha(0f).setStartDelay(95).setDuration(DURATION-125)
                .setInterpolator(natural).start();
        if(seasonCaption!=null)seasonCaption.animate().alpha(0f).setStartDelay(95)
                .setDuration(DURATION-125).setInterpolator(natural).start();
        // Bounded recovery if a renderer or animator callback never arrives.
        postDelayed(()->finish(done),DURATION+900);
    }
    private void settleAtHeader(WebView web,Runnable done){
        if(finished||landingStarted)return;
        landingStarted=true;
        web.evaluateJavascript("window.FirstHyundaiMotion?.beginNativeHandoffLanding?.()",ignored->{
            if(finished)return;
            // Keep the final native frame until the matching DOM header has
            // actually been committed by WebView, including the shared fonts.
            web.postVisualStateCallback(0L,new WebView.VisualStateCallback(){
                @Override public void onComplete(long requestId){dissolveAtRest(done);}
            });
        });
        postDelayed(()->finish(done),700);
    }
    private void dissolveAtRest(Runnable done){
        if(finished||dissolveStarted)return;
        dissolveStarted=true;
        // The live header is already opaque beneath the identical native
        // glyphs. Fading only the cover avoids a mid-crossfade brightness dip.
        for(View part:new View[]{emblem,title,subtitle}){
            ObjectAnimator fade=ObjectAnimator.ofFloat(part,View.ALPHA,part.getAlpha(),0f);
            fade.setDuration(190);
            fade.setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator());
            arrivalFades.add(fade);
            fade.start();
        }
        if(seasonPoint!=null){
            ObjectAnimator fade=ObjectAnimator.ofFloat(seasonPoint,View.ALPHA,seasonPoint.getAlpha(),0f);
            fade.setDuration(190);arrivalFades.add(fade);fade.start();
        }
        postDelayed(()->finish(done),210);
    }
    void fadeOut(Runnable done){
        if(finished)return;
        backdrop.animate().alpha(0f).setDuration(190).start();
        animate().alpha(0f).setDuration(210).withEndAction(()->finish(done)).start();
    }
    void finish(Runnable done){
        if(finished)return;
        finished=true;
        for(ObjectAnimator fade:arrivalFades)fade.cancel();
        arrivalFades.clear();
        emblem.animate().cancel();
        title.animate().cancel();
        subtitle.animate().cancel();
        backdrop.animate().cancel();
        rule.animate().cancel();
        ring.animate().cancel();
        if(seasonPoint!=null)seasonPoint.animate().cancel();
        if(seasonCaption!=null)seasonCaption.animate().cancel();
        animate().cancel();
        if(done!=null)done.run();
        else detach();
    }
    void detach(){
        if(getParent() instanceof ViewGroup)((ViewGroup)getParent()).removeView(this);
    }
    boolean isFinished(){return finished;}
}
