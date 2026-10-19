"""Verify Android adaptive icon's safe zone preserves the complete FHD FIRST logo."""
from pathlib import Path
import re
from xml.etree import ElementTree as ET
import unittest

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'app' / 'src' / 'main' / 'res'
NS = {'android': 'http://schemas.android.com/apk/res/android'}
A = '{http://schemas.android.com/apk/res/android}'

class LauncherSafeZoneTest(unittest.TestCase):
    def test_adaptive_mask_never_clips_roof_or_first_lettering(self):
        icon=ET.parse(RES/'drawable'/'ic_launcher_foreground.xml').getroot()
        group=icon.find('group')
        self.assertIsNotNone(group,'Adaptive foreground requires geometric padding')
        sx=float(group.get(A+'scaleX'))
        sy=float(group.get(A+'scaleY'))
        self.assertEqual(sx,sy,'Maintain logo proportions')
        self.assertLessEqual(sx,2/3,'Emblem must fit Android 72dp visible circle of 108dp canvas')
        self.assertGreaterEqual(sx,0.52,'Logo should remain legible on phone launcher')
        self.assertEqual(group.get(A+'pivotX'),'256')
        self.assertEqual(group.get(A+'pivotY'),'256')
        paths=group.findall('path')
        self.assertEqual(len(paths),2,'Preserve branded white lettering and red office logo')
        self.assertEqual(paths[0].get(A+'fillColor'),'#FF0000')
        self.assertEqual(paths[1].get(A+'fillColor'),'#FFFFFF')
    def test_background_and_round_adaptive_icon(self):
        background=ET.parse(RES/'values'/'ic_launcher_colors.xml').getroot()
        color=next(el.text for el in background.iter('color') if el.get('name')=='ic_launcher_background')
        self.assertRegex(color,r'^#[A-Fa-f0-9]{6}$')
        for name in ['ic_launcher','ic_launcher_round']:
            icon=ET.parse(RES/'mipmap-anydpi-v26'/f'{name}.xml').getroot()
            bg=icon.find('background')
            fg=icon.find('foreground')
            self.assertEqual(bg.get(A+'drawable'),'@color/ic_launcher_background')
            self.assertEqual(fg.get(A+'drawable'),'@drawable/ic_launcher_foreground')

if __name__=='__main__':unittest.main()
