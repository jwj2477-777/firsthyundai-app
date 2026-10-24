"""Build small, static, identical Android/WebView brand fonts (fonttools required).
Source: google/fonts/ofl/notosanskr/NotoSansKR[wght].ttf, SIL OFL 1.1.
Usage: python scripts/generate_brand_fonts.py /path/to/NotoSansKR.ttf
Only the office wordmark's glyphs are included; never use for general app text.
"""
from pathlib import Path
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
out=Path(__file__).resolve().parents[1]/'app/src/main/assets/fonts'
text='퍼스트현대FIRST HYUNDAI · REAL ESTATE'
for weight,name in [(400,'regular'),(700,'bold')]:
 font=instantiateVariableFont(TTFont(sys.argv[1]),{'wght':weight},inplace=False)
 options=subset.Options();options.recalc_timestamp=False
 sub=subset.Subsetter(options=options);sub.populate(text=text);sub.subset(font)
 # Modified subsets use their own family name; preserve copyright/license.
 for record in font['name'].names:
  values={1:'FHD Brand',2:name.title(),3:'FHDBrand-'+name,4:'FHD Brand '+name.title(),6:'FHDBrand-'+name.title(),16:'FHD Brand',17:name.title()}
  if record.nameID in values:record.string=values[record.nameID].encode(record.getEncoding())
 font.recalcTimestamp=False
 font.save(out/('fhd-brand-'+name+'.ttf'))
 print(name,(out/('fhd-brand-'+name+'.ttf')).stat().st_size)
