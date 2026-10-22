"""Generate safe-zone compliant FHD/FIRST Android launcher icon assets.
Vector paths represent the existing office emblem. Android masks only show
the center of adaptive icons: inset the mark so the rooftop, FHD and FIRST
lettering remain within the device's safe circle.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "app/src/main/res"
RED_OUTLINE = "M256,2 C396,2 510,116 510,256 C510,396 396,510 256,510 C116,510 2,396 2,256 C2,116 116,2 256,2 Z"
WHITE_LOGO = "M244,23 L243,24 L232,24 L218,26 L192,32 L157,45 L143,52 L122,65 L104,79 L86,96 L72,112 L59,130 L46,152 L35,177 L28,199 L24,218 L23,232 L22,233 L22,247 L21,248 L21,265 L22,266 L22,281 L26,306 L32,328 L39,346 L49,366 L67,393 L88,417 L103,431 L130,451 L140,457 L168,470 L187,476 L212,481 L232,482 L233,483 L257,483 L258,482 L279,481 L301,477 L316,473 L346,462 L371,449 L391,436 L416,416 L434,398 L447,382 L459,364 L475,331 L481,313 L487,284 L488,239 L487,238 L485,216 L480,195 L470,167 L459,145 L437,112 L427,100 L407,80 L378,58 L368,52 L336,37 L321,32 L288,25 L269,24 L268,23Z M196,393 L211,393 L212,394 L212,450 L211,451 L196,451 L195,450 L195,394Z M188,393 L189,394 L189,404 L187,406 L186,405 L184,406 L180,405 L176,406 L165,405 L164,406 L163,405 L163,416 L184,416 L185,417 L185,428 L184,429 L163,429 L163,450 L162,451 L147,451 L146,450 L146,394 L147,393Z M319,392 L364,392 L365,393 L365,404 L363,406 L348,406 L348,450 L347,451 L332,451 L331,450 L331,406 L319,406 L317,404 L317,394Z M221,392 L249,392 L257,394 L264,400 L266,404 L265,417 L258,424 L255,425 L263,433 L270,450 L269,451 L252,451 L246,436 L242,430 L236,430 L236,450 L235,451 L220,451 L219,450 L219,394Z M236,404 L236,418 L244,418 L248,416 L249,414 L248,406 L243,404Z M310,393 L312,395 L312,399 L309,407 L304,405 L291,405 L289,407 L289,410 L292,413 L303,418 L312,425 L315,431 L315,436 L312,443 L305,449 L296,452 L282,452 L274,450 L272,448 L272,442 L274,436 L283,439 L293,439 L297,436 L297,434 L294,431 L280,424 L274,418 L272,413 L273,402 L278,396 L286,392 L299,391Z M68,132 L86,109 L107,88 L126,73 L147,60 L166,51 L182,45 L208,38 L242,33 L271,33 L272,34 L289,35 L305,38 L330,45 L354,55 L367,62 L388,76 L399,85 L424,110 L433,121 L452,150 L463,172 L472,197 L477,218 L479,231 L479,241 L480,242 L479,282 L476,299 L469,323 L462,340 L452,359 L435,383 L71,383 L59,366 L44,336 L34,304 L30,278 L30,236 L33,215 L37,198 L44,177 L51,161Z M311,168 L311,372 L372,372 L385,367 L394,359 L399,351 L401,344 L401,258 L400,253 L395,241 L389,234Z M343,237 L355,244 L365,254 L369,263 L369,338 L363,345 L355,348 L343,348 L342,347 L342,238Z M195,168 L149,205 L119,227 L119,372 L150,372 L150,316 L192,293 L192,259 L152,281 L150,279 L150,269 L151,268 L151,242 L195,210Z M264,128 L265,238 L263,240 L244,240 L243,239 L243,129 L239,131 L210,155 L210,372 L243,372 L243,274 L244,273 L264,273 L265,274 L265,372 L296,372 L296,155Z M444,237 L368,169 L368,77 L347,77 L343,83 L336,89 L329,93 L319,96 L319,108 L320,109 L319,110 L320,111 L342,111 L343,112 L343,145 L341,146 L254,71 L127,177 L57,233 L93,233 L254,102 L409,237Z"

def vector_xml(adaptive=False):
    # 512-unit emblem at 0.60 fills 64.8dp of a 108dp viewport.
    # This stays inside Android's ~72dp central safe circle (unlike 0.78=84.2dp).
    open_group = '<group android:scaleX="0.60" android:scaleY="0.60" android:pivotX="256" android:pivotY="256">' if adaptive else ''
    close_group = '</group>' if adaptive else ''
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        ' android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512">\n'
        + open_group + '\n'
        + '<path android:fillColor="#116A71" android:pathData="' + RED_OUTLINE + '"/>\n'
        + '<path android:fillColor="#FFFFFF" android:fillType="evenOdd" android:pathData="' + WHITE_LOGO + '"/>\n'
        + close_group + '\n</vector>\n'
    )

def write_asset(path, source):
    dest = RES / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(source, encoding="utf-8")

# Soft light-blue background helps the red/white emblem stay legible.
write_asset("values/ic_launcher_colors.xml",
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<resources><color name="ic_launcher_background">#EAF5F3</color></resources>\n')
write_asset("drawable/ic_launcher_badge.xml", vector_xml())
write_asset("drawable/ic_launcher_foreground.xml", vector_xml(adaptive=True))
adaptive_xml = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '  <background android:drawable="@color/ic_launcher_background"/>\n'
    '  <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n'
    '</adaptive-icon>\n'
)
write_asset("mipmap-anydpi-v26/ic_launcher.xml", adaptive_xml)
write_asset("mipmap-anydpi-v26/ic_launcher_round.xml", adaptive_xml)
print("FHD FIRST launcher assets generated: 0.60 safe-zone emblem and clean opaque adaptive background.")
