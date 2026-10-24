# FHD Brand fonts
Static 400/700 subsets of Noto Sans KR, only for the office's Korean/English
wordmark. The exact same TTF files are loaded by Android and WebView. Other
app text keeps its existing fonts. Copyright and redistribution: OFL.txt.

Upstream: https://github.com/google/fonts/tree/main/ofl/notosanskr
Source: NotoSansKR[wght].ttf (retrieved 2026-10-25 KST).
Rebuild with `python scripts/generate_brand_fonts.py /path/to/NotoSansKR.ttf`.
Modified subsets are named FHD Brand and retain original license records.

The English subtitle's shared Android/WebView vector outlines are generated
from this same regular font by `python scripts/generate_brand_subtitle.py`.
Their exact path and palette are identical; the SIL OFL above also applies.
