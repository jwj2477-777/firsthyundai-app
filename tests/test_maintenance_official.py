"""Only complete official common+individual fee components may be a reference subtotal."""
import importlib.util,sys,json,unittest
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse,parse_qs
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
s=importlib.util.spec_from_file_location('official_monthly',R/'scripts'/'collect_maintenance_official.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
BASIC={'kaptCode':'A10026679','kaptName':'송도더샵퍼스트파크15단지','bjdCode':'2818510600',
       'doroJuso':'인천광역시 연수구 컨벤시아대로252번길 30','privArea':'70685.27'}
def mock_request(req):
 url=urlparse(req.full_url);op=url.path.split('/')[-1]
 q=parse_qs(url.query)
 assert q.get('serviceKey')==['secret-test']
 assert q.get('kaptCode')==['A10026679']
 assert q.get('searchDate')==['202607']
 allops=dict(m.COMMON+m.INDIVIDUAL)
 if op=='getHsmpMonthRetalFeeInfoV3':
  values={'sUse':'987654321'}
 elif op in allops:
  fields=allops[op]
  values={k:'0' for k in fields}
  if op==m.COMMON[0][0]:values[fields[0]]='115610190'
  if op==m.INDIVIDUAL[0][0]:values[fields[0]]='145310174'
 else:raise AssertionError('unexpected endpoint: '+op)
 row={'kaptCode':'A10026679','kaptName':BASIC['kaptName'],**values}
 return json.dumps({'response':{'header':{'resultCode':'00'},'body':{'items':{'item':row}}}}).encode()
class SourceChecks(unittest.TestCase):
 def test_observed_complete_common_individual_mapping_and_repair_exclusion(self):
  result=m.get_costs('secret-test','A10026679','202607',basic=BASIC,session=mock_request)
  self.assertEqual(result['common_won'],115610190)
  self.assertEqual(result['individual_won'],145310174)
  self.assertEqual(result['monthly_total_won'],260920364)
  self.assertEqual(result['won_per_exclusive_m2'],3691)
  self.assertFalse(result['is_full_monthly_fee'])
  self.assertIn('장기수선충당금',result['excluded_categories'])
  self.assertNotEqual(result['monthly_total_won'],260920364+987654321)
  self.assertTrue(result['reserve_usage_verified_not_billed'])
  self.assertEqual(result['exclusive_area_total_m2'],70685.27)
 def test_one_missing_cost_item_invalidates_month(self):
  def bad(req):
   response=json.loads(mock_request(req))
   if urlparse(req.full_url).path.endswith('getHsmpElectricityCostInfoV3'):
    del response['response']['body']['items']['item']['electC']
   return json.dumps(response).encode()
  with self.assertRaisesRegex(ValueError,'필수 필드'):
   m.get_costs('secret-test','A10026679','202607',basic=BASIC,session=bad)
 def test_identity_is_exact(self):
  d=dict(BASIC,kaptCode='A10026678')
  with self.assertRaisesRegex(ValueError,'식별 실패'):
   m.get_costs('secret-test','A10026679','202607',basic=d,session=mock_request)
 def test_amounts_reject_negative_fractional_and_excessive(self):
  for bad in ('-100','12.5','nan','9999999999999','a3'):
   with self.subTest(bad=bad):
    with self.assertRaises(ValueError):m.money(bad)
  self.assertEqual(m.money(None),0)
  self.assertEqual(m.money('1,234'),1234)
 def test_exclusive_area_is_official_residential_area(self):
  self.assertEqual(m.area_value('70685.27'),Decimal('70685.27'))
  for invalid in ('0','',None,'5e2000'):
   with self.assertRaises(ValueError):m.area_value(invalid)
 def test_complete_manual_invoice_is_not_overwritten_with_partial(self):
  old={'records':[{'complex_id':'f15','kapt_code':'A10026679','month':'202607',
                   'won_per_exclusive_m2':3831,'method':'kapt_published_total_per_residential_exclusive_m2'}]}
  cat=[{'id':'f15','kapt_code':'A10026679','address':BASIC['doroJuso']}]
  real=m._collect_code
  try:
   m._collect_code=lambda code,items,key,month,delay:[
    {'complex_id':'f15','month':'202608','method':'official_common_individual_subtotal_excludes_repair_reserve',
     'is_full_monthly_fee':False,'won_per_exclusive_m2':3691}]
   d=m.collect(cat,'secret-test',old,month='202608',pilot=False,delay=0,workers=1)
   self.assertEqual(d['records'][0]['won_per_exclusive_m2'],3831)
  finally:m._collect_code=real
if __name__=='__main__':unittest.main()
