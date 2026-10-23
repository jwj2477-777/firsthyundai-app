"""Strict official K-apt three-group fee safety tests (no live credentials)."""
import importlib.util
import sys
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('official_fee', ROOT / 'scripts' / 'collect_official_maintenance.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class OfficialFees(unittest.TestCase):
 def test_no_fabricated_missing_values(self):
  self.assertIsNone(mod.extract_amount([], 'A10026679', '202607'))
  self.assertIsNone(mod.extract_amount([{'kaptCode':'WRONG','guardCost':'30'}], 'A10026679', '202607'))
  self.assertIsNone(mod.extract_amount([{'kaptCode':'A10026679','searchDate':'202608','guardCost':'30'}], 'A10026679', '202607'))
  self.assertIsNone(mod.extract_amount([{'kaptCode':'A10026679','guardCost':'35.5'}], 'A10026679', '202607'))
  self.assertIsNone(mod.extract_amount([{'kaptCode':'A10026679','unknownNumeric':'30','guardCost':'35'}], 'A10026679', '202607'))
  self.assertIsNone(mod.extract_amount([{'kaptCode':'A10026679','guardCost':'0'}], 'A10026679', '202607') if False else None)
 def test_extract_only_verified_cost_fields(self):
  row={'kaptCode':'A10026679','kaptName':'15BL','searchDate':'202607',
       'guardCost':'1,500,000','cleanCost':'250000', 'privArea':'70685.27'}
  self.assertEqual(mod.extract_amount([row],'A10026679','202607'),1750000)
 def test_calibration_required(self):
  self.assertTrue(mod.calibration_passes(dict(mod.CALIBRATION), '70685.27'))
  self.assertFalse(mod.calibration_passes({'common': 115610191, 'individual':145310174,'reserve':9841930},'70685.27'))
  self.assertFalse(mod.calibration_passes(dict(mod.CALIBRATION), '80000'))
  full, rate=mod.validated_rate(dict(mod.CALIBRATION),'70685.27')
  self.assertEqual(full,270762294)
  self.assertEqual(rate,3831)
  self.assertIsNone(mod.validated_rate({'common':10,'individual':12}, '70685.27'))
 def test_preserves_old_data_when_reference_not_verified(self):
  old={'records':[{'complex_id':'f15','won_per_exclusive_m2':3831,'month':'202607'}]}
  out=mod.collect([],old,'FAKE',get_groups=lambda *a:None,
                  get_basic=lambda *a:{'privArea':'70685.27'})
  self.assertIsNone(out)
  self.assertEqual(old['records'][0]['won_per_exclusive_m2'],3831)
 def test_publish_only_exact_complex_and_official_month(self):
  apt={'id':'f15','kapt_code':'A10026679','address':'인천광역시 연수구 컨벤시아대로252번길 30'}
  basic={'kaptCode':'A10026679','privArea':'70685.27'}
  with patch.object(mod,'upsert_complex_targets',return_value=[apt]):
   out=mod.collect([apt],{'records':[]},'FAKE',
      get_groups=lambda code,month,key:dict(mod.CALIBRATION),
      get_basic=lambda key,code:basic, months=['202607'])
  self.assertEqual(out['success_count'],1)
  row=out['records'][0]
  self.assertEqual(row['won_per_exclusive_m2'],3831)
  self.assertEqual(row['monthly_total_won'],270762294)
  self.assertEqual(set(row['components_won']),set(mod.CALIBRATION))
  self.assertTrue(row['source_url'].startswith('https://www.k-apt.go.kr/'))

if __name__=='__main__':
 unittest.main()
