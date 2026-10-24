package kr.co.firsthyundai.app;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.widget.TextView;

/**
 * Shared native opening/transition typography. WebView's header uses the same
 * Roboto / Noto Sans Korean fallback, 820/670 weights, colors and letter spacing.
 * The intro is larger on purpose; only its geometry scales during flight.
 */
final class BrandIdentityStyle {
    static final int TITLE_COLOR=Color.rgb(249,255,255);      // #F9FFFF
    static final int SUBTITLE_COLOR=Color.rgb(216,231,228);   // #D8E7E4
    static final int LOGO_BACKING=Color.rgb(253,251,246);    // #FDFBF6
    static final String TITLE="퍼스트현대";
    static final String SUBTITLE="FIRST HYUNDAI · REAL ESTATE";
    static final float TITLE_SP=30f;
    static final float SUBTITLE_SP=11f;
    static final float TITLE_TRACKING=-.033f; // approximately -.9px at 27px
    static final float SUBTITLE_TRACKING=.072f; // .72px at 10px
    private BrandIdentityStyle(){}

    private static Typeface weight(int amount) {
        Typeface family=Typeface.create("sans-serif",Typeface.NORMAL);
        if(Build.VERSION.SDK_INT>=28)return Typeface.create(family,amount,false);
        return Typeface.create("sans-serif",amount>=700?Typeface.BOLD:Typeface.NORMAL);
    }
    static void title(TextView view){
        view.setText(TITLE);
        view.setTextColor(TITLE_COLOR);
        view.setTextSize(TITLE_SP);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(weight(820));
        view.setLetterSpacing(TITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
    static void subtitle(TextView view){
        view.setText(SUBTITLE);
        view.setTextColor(SUBTITLE_COLOR);
        view.setTextSize(SUBTITLE_SP);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(weight(670));
        view.setLetterSpacing(SUBTITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
    static GradientDrawable logoBacking(){
        GradientDrawable shape=new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        shape.setColor(LOGO_BACKING);
        return shape;
    }
}
