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
 def test_extract_only_verified_cost_fields(self):
  row={'kaptCode':'A10026679','kaptName':'15BL','searchDate':'202607',
       'guardCost':'1,500,000','cleanCost':'250000', 'privArea':'70685.27'}
  self.assertEqual(mod.extract_amount([row],'A10026679','202607'),1750000)
 def test_reserve_uses_real_levy_operation(self):
  # Live-verified 2026-11-20: getHsmpMonthFeeInfoV3 returned sLevy=9841930 for F15 2026-07,
  # exactly the independent calibration value. The old operation name does not exist.
  self.assertEqual(mod.GROUPS['reserve'], ('AptRepairsCostServiceV3', ('getHsmpMonthFeeInfoV3',)))
  row={'kaptCode':'A10026679','kaptName':'송도더샵퍼스트파크15단지','sLevy':'9841930'}
  self.assertEqual(mod.extract_amount([row],'A10026679','202607'), mod.CALIBRATION['reserve'])
  # An unpublished month comes back as empty fields: missing, never zero.
  self.assertIsNone(mod.extract_amount([{'kaptCode':None,'kaptName':None,'sLevy':None}],'A10026679','202609'))
 def test_live_f15_july_rows_reproduce_calibration_exactly(self):
  # Public K-apt V3 values for 송도더샵퍼스트파크15단지 2026-07 (Actions, 2026-11-20).
  C='A10026679'
  common=[{'pay':'27072900','sundryCost':'6793720','pension':'2934580','accidentPremium':'304250','employPremium':'368320','nationalPension':'1503480','healthPremium':'1272800','welfareBenefit':'1416700'},
   {'guardCost':'22188900'},{'cleanCost':'29219060'},{'careItemCost':'367200','accountingCost':'198000','hiddenCost':'670530'},
   {'disinfCost':'430000'},{'lrefCost1':'7101290'},{'elevCost':'7766000'},{'lrefCost2':'3784950'},{},
   {'manageCost':'974320'},{'lrefCost4':'291970'},{'bookSupply':'394680','transportCost':'15000'},{'telCost':'314450'},{},{},{'clothesCost':'227090'}]
  individual=[{'heatC':'5191350','heatP':'0'},{'waterCoolC':'1592001','waterCoolP':'17361470'},{'electC':'26569693','electP':'79590240'},
   {'waterHotC':'0','waterHotP':'11543230'},{'gasC':'0','gasP':'0'},{'purifi':'0'},{'scrap':'0'},{'preMeet':'1418190'},{'buildInsu':'2044000'},{'electionMng':'0'}]
  def total(rows):
   return sum(x or 0 for x in (mod.extract_amount([{'kaptCode':C,'kaptName':'15단지',**r}],C,'202607') for r in rows))
  self.assertEqual(total(common), mod.CALIBRATION['common'])
  self.assertEqual(total(individual), mod.CALIBRATION['individual'])
  self.assertEqual(total([{'sLevy':'9841930'}]), mod.CALIBRATION['reserve'])
  totals={'common':total(common),'individual':total(individual),'reserve':9841930}
  self.assertTrue(mod.calibration_passes(totals,'70685.27'))
  # Still refuses a genuinely unknown non-zero numeric field.
  self.assertIsNone(mod.extract_amount([{'kaptCode':C,'mysteryX':'5'}],C,'202607'))
 def test_calibration_required(self):
  self.assertTrue(mod.calibration_passes(dict(mod.CALIBRATION), '70685.27'))
  self.assertTrue(mod.calibration_passes({'common': 115610191, 'individual':145310174,'reserve':9841930},'70685.27'))
  self.assertFalse(mod.calibration_passes({'common': 95510190, 'individual':145310174,'reserve':9841930},'70685.27'))
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
