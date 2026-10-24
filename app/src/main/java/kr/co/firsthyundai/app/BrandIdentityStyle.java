package kr.co.firsthyundai.app;

import android.graphics.Color;
import android.graphics.Typeface;
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

    private static Typeface regular,bold;
    private static synchronized Typeface font(TextView view,boolean heavy){
        if(heavy){
            if(bold==null)bold=Typeface.createFromAsset(view.getContext().getAssets(),"fonts/fhd-brand-bold.ttf");
            return bold;
        }
        if(regular==null)regular=Typeface.createFromAsset(view.getContext().getAssets(),"fonts/fhd-brand-regular.ttf");
        return regular;
    }
    static void title(TextView view){
        view.setText(TITLE);
        view.setTextColor(TITLE_COLOR);
        view.setTextSize(TITLE_SP);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(font(view,true));
        view.setLetterSpacing(TITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
    static void subtitle(TextView view){
        view.setText(SUBTITLE);
        view.setTextColor(SUBTITLE_COLOR);
        view.setTextSize(SUBTITLE_SP);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(font(view,false));
        view.setLetterSpacing(SUBTITLE_TRACKING);
        view.setIncludeFontPadding(false);
    }
}
