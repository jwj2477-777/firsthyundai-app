package kr.co.firsthyundai.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class BrandLandingMathTest {
    @Test public void cssLineHeightDoesNotShrinkGlyphs(){
        // 27px heading, 36px CSS line-box: use 27px font size, never 36px.
        assertEquals(.9f,BrandLandingMath.textScale(27f,3f,90f),.0001f);
    }
    @Test public void baselineAndLeftStayAlignedAcrossDisplayAndFontScales(){
        for(float density:new float[]{1f,2.75f,3f,3.5f}){
            for(float fontScale:new float[]{1f,1.3f,1.6f}){
                float nativeSize=30f*density*fontScale,nativeBaseline=nativeSize*.82f;
                float scale=BrandLandingMath.textScale(24f,density,nativeSize);
                float top=BrandLandingMath.textTop(38f,density,nativeBaseline,scale);
                assertEquals(24f*density,nativeSize*scale,.001f);
                assertEquals(38f*density,top+nativeBaseline*scale,.001f);
            }
        }
    }
    @Test public void englishUsesItsOwnMeasuredBaseline(){
        float scale=BrandLandingMath.textScale(8f,3f,33f);
        assertEquals(171f,BrandLandingMath.textTop(57f,3f,26f,scale)+26f*scale,.001f);
    }
}
