"""The English line uses exact same glyph outlines and rectangle on both renderers."""
from pathlib import Path
from xml.etree import ElementTree as E
import unittest
ROOT=Path(__file__).resolve().parents[1]
A='{http://schemas.android.com/apk/res/android}'
S='{http://www.w3.org/2000/svg}'
class EnglishWordmarkTest(unittest.TestCase):
 def test_identical_outlines_and_color(self):
  native=E.parse(ROOT/'app/src/main/res/drawable/ic_brand_subtitle.xml').getroot()
  web=E.parse(ROOT/'app/src/main/assets/brand-subtitle.svg').getroot()
  np=native.find('path');wp=web.find(S+'path')
  self.assertEqual(np.get(A+'pathData'),wp.get('d'))
  self.assertEqual(np.get(A+'fillColor'),wp.get('fill'))
  self.assertEqual(wp.get('fill'),'#F6D791')
  vb=web.get('viewBox').split()
  self.assertEqual(float(vb[2]),float(native.get(A+'viewportWidth')))
  self.assertEqual(float(vb[3]),float(native.get(A+'viewportHeight')))
 def test_only_english_uses_graphic_and_keeps_accessibility(self):
  html=(ROOT/'app/src/main/assets/index.html').read_text()
  self.assertIn('<h1>퍼스트현대</h1>',html)
  self.assertIn('alt="FIRST HYUNDAI · REAL ESTATE"',html)
  self.assertIn('class="brandSubtitleMark" src="brand-subtitle.svg"',html)
  native=(ROOT/'app/src/main/java/kr/co/firsthyundai/app/BrandIdentityStyle.java').read_text()
  self.assertIn('R.drawable.ic_brand_subtitle',native)
  self.assertIn('view.setContentDescription(SUBTITLE)',native)
if __name__=='__main__': unittest.main()
