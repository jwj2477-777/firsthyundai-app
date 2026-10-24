"""Generate the identical gold English wordmark for Android and WebView.
Uses the bundled OFL FHD Brand regular subset; fonttools required to regenerate.
Only the subtitle is outlined; the main title remains accessible live text.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
font=TTFont(assets/'fonts/fhd-brand-regular.ttf')
glyphs=font.getGlyphSet();cmap=font.getBestCmap();units=font['head'].unitsPerEm
height=1.3*units
baseline=font['hhea'].ascent+(height-(font['hhea'].ascent-font['hhea'].descent))/2
text='FIRST HYUNDAI · REAL ESTATE'
pen=SVGPathPen(glyphs);x=0
for char in text:
 name=cmap[ord(char)]
 glyphs[name].draw(TransformPen(pen,(1,0,0,-1,x,baseline)))
 x+=font['hmtx'][name][0]+.1*units
width=x-.1*units
commands=pen.getCommands()
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}"><path fill="#F6D791" d="{commands}"/></svg>\n'
(assets/'brand-subtitle.svg').write_text(svg)
res=root/'app/src/main/res/drawable/ic_brand_subtitle.xml'
res.write_text(f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
 android:width="{width/units*11:.5f}dp" android:height="14.3dp"
 android:viewportWidth="{width:g}" android:viewportHeight="{height:g}">
 <path android:fillColor="#F6D791" android:pathData="{commands}"/>
</vector>
''')
print('Shared subtitle outline:',width/units,'em × 1.3em; native and web paths identical')
