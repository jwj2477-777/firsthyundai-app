package kr.co.firsthyundai.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.FrameLayout;

/** Make Android 15+ enforced edge-to-edge safe for both the WebView and login.
 *  Top: dark FHD branding under white status icons; bottom: light navigation surface.
 *  Pre-Android 15 relies on the system's traditional window insets, unmodified. */
final class SystemBars {
    private SystemBars(){}

    static void install(Activity activity, View content) {
        FrameLayout windowRoot = new FrameLayout(activity);
        windowRoot.setBackgroundColor(Color.rgb(16,45,56));
        windowRoot.addView(content,new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        View navigationSurface = new View(activity);
        navigationSurface.setBackgroundColor(Color.rgb(247,248,245));
        windowRoot.addView(navigationSurface,new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,0,Gravity.BOTTOM));

        if(Build.VERSION.SDK_INT >= 35) {
            windowRoot.setOnApplyWindowInsetsListener((view,insets) -> {
                Insets topInsets = insets.getInsets(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout());
                Insets navInsets = insets.getInsets(WindowInsets.Type.navigationBars());
                Insets imeInsets = insets.getInsets(WindowInsets.Type.ime());
                int top = topInsets.top;
                int bottom = Math.max(navInsets.bottom,imeInsets.bottom);

                FrameLayout.LayoutParams contentLayout =
                    (FrameLayout.LayoutParams)content.getLayoutParams();
                if(contentLayout.topMargin!=top || contentLayout.bottomMargin!=bottom) {
                    contentLayout.topMargin=top;
                    contentLayout.bottomMargin=bottom;
                    content.setLayoutParams(contentLayout);
                }
                FrameLayout.LayoutParams navLayout =
                    (FrameLayout.LayoutParams)navigationSurface.getLayoutParams();
                if(navLayout.height!=navInsets.bottom) {
                    navLayout.height=navInsets.bottom;
                    navigationSurface.setLayoutParams(navLayout);
                }
                return insets;
            });
        }
        activity.setContentView(windowRoot);
    }
}
