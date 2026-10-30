"""No fabricated monthly bills or school assignments under partial API coverage."""
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from collect_public_fee_items import amount,extract,reference_passes,collect,REFERENCE,REFERENCE_CODE,REFERENCE_MONTH
from collect_schoolinfo import review_unmatched_zones

class OfficialFeePartials(unittest.TestCase):
 def test_amount_and_identity(self):
  self.assertIsNone(amount('3,500.42'))
  self.assertEqual(amount('1,500'),1500)
  self.assertIsNone(amount('-500'))
  self.assertIsNone(extract([{'kaptCode':'WRONG','guardCost':'1000'}],REFERENCE_CODE,REFERENCE_MONTH,'guardCost'))
  self.assertIsNone(extract([{'kaptCode':REFERENCE_CODE,'searchDate':'202608','guardCost':'1000'}],REFERENCE_CODE,REFERENCE_MONTH,'guardCost'))
  self.assertEqual(extract([{'kaptCode':REFERENCE_CODE,'kaptName':'퍼스트파크','guardCost':'22,188,900'}],REFERENCE_CODE,REFERENCE_MONTH,'guardCost'),22188900)

 def test_fail_closed_without_benchmark(self):
  apt={'id':'m23','kapt_code':'A10027930'}
  self.assertIsNone(collect([apt],'fake',get_items=lambda *a:None,get_basic=lambda *a:{},pause=0))
  self.assertFalse(reference_passes({'guard':100,'clean':200}))

 def test_verified_partial_is_never_a_complete_bill(self):
  apt={'id':'m23','kapt_code':'A10027930'}
  calls=[]
  def items(code,month,key):
   calls.append((code,month))
   if code==REFERENCE_CODE:return dict(REFERENCE)
   if month=='202608':return {'guard':1200000,'clean':900000}
   return None
  basic={'kaptCode':'A10027930','privArea':'14000.25'}
  output=collect([apt],'fake',get_items=items,get_basic=lambda *a:basic,
   match=lambda catalog,row:[apt],target_months=['202608'],pause=0)
  self.assertEqual(output['success_count'],1)
  record=output['records'][0]
  self.assertEqual(record['guard_won'],1200000)
  self.assertEqual(record['clean_won'],900000)
  self.assertEqual(record['month'],'202608')
  self.assertEqual(record['residential_exclusive_total_m2'],14000.25)
  self.assertNotIn('won_per_exclusive_m2',record)
  self.assertNotIn('monthly_total_won',record)
  self.assertIn('일부',record['basis'])

class SchoolUnmatchedReview(unittest.TestCase):
 def test_no_coordinate_is_not_school_assigned(self):
  zones=[]
  catalog=[{'id':'no-coordinates','label':'검증 전'},{'id':'known','label':'검증됨'}]
  pending=review_unmatched_zones(zones,[],catalog,[{'complex_id':'known'}])
  self.assertEqual(pending,[{'complex_id':'no-coordinates','reason':'address_unverified','reference_date':'2026-09-20'}])
  self.assertNotIn('school',str(pending).lower())
 def test_outside_zone_stays_unassigned(self):
  pending=review_unmatched_zones([], [{'id':'unknown','lng':126.65,'lat':37.4}],
   [{'id':'unknown'}],[])
  self.assertEqual(pending[0]['reason'],'outside_official_polygon')
if __name__=='__main__':unittest.main()
