"""No guessed school assignments; fail-closed official Schoolinfo importer."""
import importlib.util,json,sys,unittest
from pathlib import Path
from urllib.parse import parse_qs,urlparse
R=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('school_district_import',R/'scripts'/'collect_schoolinfo.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SchoolZoneSafeguards(unittest.TestCase):
 def test_official_20260920_file_geometries_are_closed(self):
  d=json.loads((R/'data'/'school_zones_yeonsu.json').read_text(encoding='utf8'))
  self.assertEqual(d['reference_date'],'2026-09-20')
  self.assertEqual(d['crs'],'EPSG:4326')
  self.assertEqual(len(d['zones']),34)
  self.assertEqual(len({x['id'] for x in d['zones']}),34)
  for z in d['zones']:
   self.assertRegex(z['id'],r'^Z[0-9]{9}$')
   for polygon in z['rings']:
    self.assertTrue(polygon)
    for encoded in polygon:
     ring=m.decode_ring(encoded)
     self.assertGreaterEqual(len(ring),4)
     self.assertEqual(ring[0],ring[-1])
     self.assertTrue(all(126.5<x<126.8 and 37.3<y<37.5 for x,y in ring))
 def test_polygon_boundary_is_not_called_safe_assignment(self):
  rectangle=[(126.62,37.38),(126.64,37.38),(126.64,37.40),(126.62,37.40),(126.62,37.38)]
  self.assertTrue(m.contains(rectangle,126.63,37.39))
  self.assertFalse(m.contains(rectangle,126.65,37.39))
  self.assertLess(m.edge_distance(rectangle,126.62001,37.39),100)
 def test_multiple_and 공동통학구역_not_assigned(self):
  self.assertEqual(m.build_assignments([],[]),[])
  self.assertEqual(m.build_assignments([], [{'id':'f13','lat':37.38,'lng':126.64}]),[])
 def test_schoolinfo_api_requires_yeonsu_sgg_and_three_school_levels(self):
  seen=[]
  def fetch(req):
   q=parse_qs(urlparse(req.full_url).query)
   seen.append(q)
   self.assertEqual(q['sidoCode'],['28'])
   self.assertEqual(q['sggCode'],['28185'])
   self.assertEqual(q['apiType'],['0'])
   self.assertEqual(q['apiKey'],['private-test-only'])
   code={'02':'S000000001','03':'S000000002','04':'S000000003'}[q['schulKndCode'][0]]
   name={'02':'인천테스트초등학교','03':'인천테스트중학교','04':'인천테스트고등학교'}[q['schulKndCode'][0]]
   return json.dumps({'resultCode':'success','list':[{'SCHUL_CODE':code,'SCHUL_NM':name,'CLOSE_YN':'N'}]}).encode()
  rows=m.collect_schoolinfo('private-test-only',opener=fetch)
  self.assertEqual(len(rows),3)
  self.assertEqual(len(seen),3)
  self.assertEqual({x['level'] for x in rows},{'초등학교','중학교','고등학교'})
  self.assertNotIn('private-test-only',json.dumps(rows))
 def test_schoolinfo_failure_is_not_an_empty_verified_snapshot(self):
  def fetch(req):
   return b'{"resultCode":"fail","resultMsg":"invalid key","list":[]}'
  with self.assertRaisesRegex(RuntimeError,'confirmed success'):
   m.collect_schoolinfo('private-test-only',opener=fetch)
 def test_kakao_exact_road_address_only(self):
  record={'id':'f13','label':'퍼스트파크13','address':'인천광역시 연수구 컨벤시아대로252번길 70'}
  def mismatch(req):
   return json.dumps({'documents':[{'road_address':{'address_name':'인천광역시 연수구 컨벤시아대로252번길 50',
             'x':'126.64','y':'37.38'}}]}).encode()
  self.assertEqual(m.collect_kakao_coordinates([record],'private',opener=mismatch),[])
  def verified(req):
   self.assertTrue(req.headers.get('Authorization','').startswith('KakaoAK '))
   return json.dumps({'documents':[{'road_address':{'address_name':record['address'],
             'x':'126.64','y':'37.38'}}]}).encode()
  rows=m.collect_kakao_coordinates([record],'private',opener=verified)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['id'],'f13')
  self.assertNotIn('private',json.dumps(rows))
if __name__=='__main__':unittest.main()
