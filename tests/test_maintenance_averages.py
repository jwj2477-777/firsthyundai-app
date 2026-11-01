"""Published management fee unit extraction is guarded, not a household invoice."""
import importlib.util,unittest,sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('fee_avg',ROOT/'scripts'/'collect_maintenance_averages.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ADDRESS='인천광역시 연수구 컨벤시아대로252번길 30'
MONTH_HTML='''<!doctype html><html><head><title>공동주택 관리비</title></head><body>
<h1>2026년 07월 퍼스트파크15블럭 관리비 정보</h1>
<p>국토교통부 제공 공공데이터를 활용</p><table><tr><th>도로명 주소</th><td>인천광역시 연수구 컨벤시아대로252번길 30</td></tr></table>
<h2>2026년 07월 면적별 평균 관리비 정보</h2><p>면적별 평균 관리비</p>
<table><tr><th>분류</th><th>총액(원)</th><th>단가(원/㎡)</th></tr>
<tr><td>공용관리비</td><td>8000000</td><td>1000</td></tr>
<tr><td>개별사용료</td><td>12000000</td><td>2000</td></tr>
<tr><td>장기수선충당금</td><td>6648000</td><td>831</td></tr>
<tr><td>합계</td><td>26,648,000</td><td>3,831</td></tr></table>
</body></html>'''
class FeeImporter(unittest.TestCase):
 def test_verified_per_exclusive_m2_and_link(self):
  d=mod.parse(MONTH_HTML,'A10026679',ADDRESS,datetime(2026,10,23))
  self.assertEqual(d['won_per_exclusive_m2'],3831)
  self.assertEqual(d['month'],'202607')
  self.assertEqual(d['source_url'],'https://apt.koreacharts.com/apt/A10026679/contents.html')
  self.assertNotIn('household_invoice',d['method'])
 def test_different_address_is_rejected(self):
  self.assertIsNone(mod.parse(MONTH_HTML,'A10026679',ADDRESS.replace('30','50'),datetime(2026,10,23)))
 def test_missing_total_or_partial_component_is_rejected(self):
  self.assertIsNone(mod.parse(MONTH_HTML.replace('합계','미기재'),'A10026679',ADDRESS,datetime(2026,10,23)))
 def test_future_month_not_published(self):
  self.assertIsNone(mod.parse(MONTH_HTML.replace('2026년 07월','2027년 07월'),'A10026679',ADDRESS,datetime(2026,10,23)))
 def test_missing_fee_cannot_become_valid(self):
  self.assertIsNone(mod.parse(MONTH_HTML+'<p>등록된 관리비 정보가 없습니다</p>',
   'A10026679',ADDRESS,datetime(2026,10,23)))
 def test_previous_snapshot_survives_unavailable_network(self):
  prior={'records':[{'complex_id':'f15','month':'202607','won_per_exclusive_m2':3831}]}
  items=[{'id':'f15','address':ADDRESS,'kapt_code':'A10026679'}]
  out=mod.collect(items,prior,fetch=lambda code:None,pause=0,limit=datetime(2026,10,23))
  self.assertEqual(out['success_count'],0)
  self.assertEqual(out['records'][0]['won_per_exclusive_m2'],3831)
 def test_matching_source_is_required(self):
  items=[{'id':'f15','address':ADDRESS,'kapt_code':'A10026679'}]
  out=mod.collect(items,fetch=lambda code:MONTH_HTML,pause=0,limit=datetime(2026,10,23))
  self.assertEqual(len(out['records']),1)
  self.assertEqual(out['records'][0]['complex_id'],'f15')
 def test_refresh_preserves_verified_monthly_history(self):
  old_row=dict(complex_id='f15',kapt_code='A10026679',month='202606',
   won_per_exclusive_m2=3600,monthly_total_won=250000000,
   source_url='https://www.k-apt.go.kr/')
  prior={'records':[dict(old_row,monthly_history=[old_row])]}
  items=[{'id':'f15','address':ADDRESS,'kapt_code':'A10026679'}]
  out=mod.collect(items,prior,fetch=lambda code:MONTH_HTML,pause=0,limit=datetime(2026,10,23))
  row=out['records'][0]
  self.assertEqual(out['success_count'],1)
  self.assertEqual(row['month'],'202607')
  self.assertEqual([x['month'] for x in row['monthly_history']],['202607','202606'])
  self.assertEqual([x['won_per_exclusive_m2'] for x in row['monthly_history']],[3831,3600])
  self.assertEqual(row['monthly_total_won'],26648000)
 def test_refresh_older_source_cannot_replace_latest_verified_month(self):
  old_row=dict(complex_id='f15',kapt_code='A10026679',month='202608',
   won_per_exclusive_m2=3900,monthly_total_won=26800000,
   source_url='https://www.k-apt.go.kr/')
  items=[{'id':'f15','address':ADDRESS,'kapt_code':'A10026679'}]
  out=mod.collect(items,{'records':[old_row]},fetch=lambda code:MONTH_HTML,pause=0,limit=datetime(2026,10,23))
  row=out['records'][0]
  self.assertEqual(row['month'],'202608')
  self.assertEqual([x['month'] for x in row['monthly_history']],['202608','202607'])
if __name__=='__main__':unittest.main()
