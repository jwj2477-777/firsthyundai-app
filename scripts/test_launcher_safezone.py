"""Gold/emerald FHD premium icon tests: retain original geometry and Android mask safety."""
from pathlib import Path
from xml.etree import ElementTree as ET
import unittest
ROOT=Path(__file__).resolve().parents[1]
RES=ROOT/'app'/'src'/'main'/'res'
A='{http://schemas.android.com/apk/res/android}'
NS={'android':'http://schemas.android.com/apk/res/android','aapt':'http://schemas.android.com/aapt'}

class PremiumIconTest(unittest.TestCase):
    def test_true_gradient_and_original_emblem(self):
        badge=ET.parse(RES/'drawable'/'ic_launcher_badge.xml').getroot()
        self.assertEqual(badge.get(A+'viewportWidth'),'512')
        self.assertEqual(badge.get(A+'viewportHeight'),'512')
        paths=badge.findall('.//path')
        self.assertGreaterEqual(len(paths),5)
        logo=[p for p in paths if p.get(A+'fillType')=='evenOdd']
        self.assertEqual(len(logo),2,'Original rooftop+FHD+FIRST vector traced only twice: shadow and gold')
        self.assertEqual(logo[0].get(A+'pathData'),logo[1].get(A+'pathData'),'Preserve exact original FHD FIRST geometry')
        self.assertIn('M244,23',logo[0].get(A+'pathData'))
        self.assertIn('M256,2',paths[0].get(A+'pathData'))
        gradients=badge.findall('.//aapt:attr/gradient',NS)
        self.assertGreaterEqual(len(gradients),3,'Metallic gold and dark-teal are real Android gradients')
        gold=gradients[0].findall('item')
        self.assertGreaterEqual(len(gold),6)
        colors={x.get(A+'color') for x in gold}
        self.assertIn('#FFF9D5',colors)
        self.assertIn('#C6872C',colors)
        self.assertNotIn('#FF0000',ET.tostring(badge,encoding='unicode'))
    def test_adaptive_round_masks_fit_original_lettering(self):
        fore=ET.parse(RES/'drawable'/'ic_launcher_foreground.xml').getroot()
        group=fore.find('group')
        self.assertIsNotNone(group)
        sx=float(group.get(A+'scaleX'));sy=float(group.get(A+'scaleY'))
        self.assertEqual(sx,sy)
        self.assertLessEqual(sx,2/3,'No letter or roof crop on Android adaptive mask')
        self.assertGreaterEqual(sx,0.58,'Emblem remains visible, not a tiny center logo')
        self.assertEqual(group.get(A+'pivotX'),'256')
        self.assertEqual(group.get(A+'pivotY'),'256')
        self.assertGreaterEqual(len(group.findall('path')),4)
        shadow=group.findall('.//path')
        self.assertTrue(any(p.get(A+'fillColor')=='#513310' for p in shadow))
    def test_native_icon_and_gradient_background_are_referenced(self):
        bg=ET.parse(RES/'drawable'/'ic_launcher_background_art.xml').getroot()
        self.assertGreaterEqual(len(bg.findall('.//aapt:attr/gradient',NS)),1)
        for name in ['ic_launcher','ic_launcher_round']:
            icon=ET.parse(RES/'mipmap-anydpi-v26'/f'{name}.xml').getroot()
            self.assertEqual(icon.find('background').get(A+'drawable'),
                             '@drawable/ic_launcher_background_art')
            self.assertEqual(icon.find('foreground').get(A+'drawable'),
                             '@drawable/ic_launcher_foreground')
        splash=(ROOT/'app/src/main/java/kr/co/firsthyundai/app/LockActivity.java').read_text()
        self.assertIn('R.drawable.ic_launcher_badge',splash)
    def test_header_retains_canvas_contract_paths(self):
        html=(ROOT/'app/src/main/assets/index.html').read_text()
        self.assertIn('id="fhdPremiumGold"',html)
        self.assertIn('style="fill:url(#fhdPremiumGold)"',html)
        self.assertIn('fill="#116A71"',html)
        self.assertIn('fill="#FFFFFF"',html)
        # Contract-image.js reads path fill attributes, so preserve approved customer PNG colors
        contract=(ROOT/'app/src/main/assets/contract-image.js').read_text()
        self.assertIn("el.getAttribute('fill')",contract)

if __name__=='__main__': unittest.main()
