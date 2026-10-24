package kr.co.firsthyundai.app;

/** Native glyphs align to measured CSS font size/baseline, not line-box height. */
final class BrandLandingMath {
    private BrandLandingMath(){}
    static float textScale(float cssFontSize,float pixelsPerCss,float nativeFontSize){
        return cssFontSize*pixelsPerCss/nativeFontSize;
    }
    static float textTop(float cssBaseline,float pixelsPerCss,float nativeBaseline,float scale){
        return cssBaseline*pixelsPerCss-nativeBaseline*scale;
    }
}
