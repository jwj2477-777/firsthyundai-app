package kr.co.firsthyundai.app;

import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Gravity;
import android.widget.TextView;

/**
 * Preserve the original native splash typography across the intro, native
 * movement and WebView header. Large intro text only changes size/position.
 */
final class BrandIdentityStyle {
    static final int TITLE_COLOR=Color.WHITE;                // original splash
    static final int SUBTITLE_COLOR=Color.rgb(246,215,145); // original warm gold
    static final String TITLE="퍼스트현대";
    static final String SUBTITLE="FIRST HYUNDAI · REAL ESTATE";
    static final float TITLE_SP=30f;
    static final float SUBTITLE_SP=11f;
    static final float TITLE_TRACKING=0f;
    static final float SUBTITLE_TRACKING=.1f;
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
        view.setTypeface(weight(700));
        view.setLetterSpacing(TITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
    static void subtitle(TextView view){
        view.setText(SUBTITLE);
        view.setTextColor(SUBTITLE_COLOR);
        view.setTextSize(SUBTITLE_SP);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(weight(400));
        view.setLetterSpacing(SUBTITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
}
