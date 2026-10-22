"""Fallback school-location source contract: official, full-pagination, no district guesses."""
import importlib.util,json,sys,unittest
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from urllib.error import HTTPError
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
spec=importlib.util.spec_from_file_location('schoolloc',root/'scripts'/'collect_school_locations.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
def example(**kw):
 row={'schoolId':'B000022222','schoolNm':'송도모의초등학교','schoolSe':'초등학교','operSttus':'운영',
      'lnmadr':'인천광역시 연수구 송도동 123','rdnmadr':'인천광역시 연수구 송도과학로 10',
      'latitude':'37.4024','longitude':'126.6624','referenceDate':'2026-10-01'}
 row.update(kw);return row
def payload(rows,total=None):
 return json.dumps({'response':{'header':{'resultCode':'00'},'body':{
  'items':{'item':rows},'totalCount':len(rows) if total is None else total
 }}},ensure_ascii=False).encode()
class SchoolLocationTests(unittest.TestCase):
 def test_only_in_songdo_running_with_coordinates_and_no_assigned(self):
  rows=p.normalize([
    example(),example(schoolId='B000022223',schoolNm='송도모의중학교',schoolSe='중학교',latitude='37.41'),
    example(schoolId='B000022224',lnmadr='인천광역시 연수구 청학동 2'),
    example(schoolId='B000022225',operSttus='폐교'),
    example(schoolId='B000022226',latitude='0'),
    example(schoolId='B000022227',schoolNm='강남송도초등학교',lnmadr='서울특별시 강남구 삼성동 10'),
    example(schoolId='B000022228',schoolSe='유치원')
  ])
  self.assertEqual({x['name'] for x in rows},{'송도모의초등학교','송도모의중학교'})
  self.assertEqual(rows[0]['lat'],37.4024)
  self.assertEqual(rows[0]['source_url'],p.SOURCE)
  self.assertTrue(all('assigned' not in x for x in rows))
 def test_full_pagination_and_real_source_provenance(self):
  calls=[]
  def fake(req):
   qs=parse_qs(urlsplit(req.full_url).query)
   calls.append((int(qs['pageNo'][0]),int(qs['numOfRows'][0]),qs['serviceKey'][0]))
   if qs['pageNo'][0]=='1':
    return payload([example(),example(schoolId='B000022223',schoolNm='송도모의중학교',schoolSe='중학교')],total=3)
   return payload([example(schoolId='B000022224',schoolNm='다른지역초',lnmadr='인천광역시 연수구 청학동 17')],total=3)
  result=p.collect('fictional-key',opener=fake,page_size=2)
  self.assertEqual(result['state'],'verified')
  self.assertEqual(len(result['records']),2)
  self.assertEqual(len(calls),2)
  self.assertNotIn('fictional-key',json.dumps(result,ensure_ascii=False))
  self.assertIn('배정학교',result['note'])
 def test_denial_or_incomplete_page_never_publishes(self):
  def denied(req):raise HTTPError(req.full_url,403,'permission denied',None,None)
  with self.assertRaisesRegex(RuntimeError,'403') as err:
   p.collect('private-value',opener=denied,page_size=2)
  self.assertNotIn('private-value',str(err.exception))
  with self.assertRaises(RuntimeError):
   p.collect('private-value',opener=lambda req:payload([example()],total=3),page_size=2)
  with self.assertRaises(RuntimeError):
   p.parse_page(b'{"response":{"header":{"resultCode":"30"}}}')
  with self.assertRaises(RuntimeError):
   p.collect('private-value',opener=lambda req:payload([example(lnmadr="서울특별시 강남구 삼성동 1")]),page_size=1000)
 def test_snapshot_update_preserves_every_other_section(self):
  spec2=importlib.util.spec_from_file_location('publicsvc',root/'scripts'/'collect_public_services.py')
  a=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(a)
  import tempfile
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'public_services.json'
   original={'schema_version':1,'schools':{'state':'awaiting_key','records':[]},
             'office_rents':{'state':'verified','records':[{'building':'kept'}]},
             'subscriptions':{'state':'awaiting_approval'}}
   path.write_text(json.dumps(original),encoding='utf8')
   x={'state':'verified','records':[{'name':'mock'}]}
   a.update_snapshot(path,school_locations=x)
   result=json.loads(path.read_text(encoding='utf8'))
   self.assertEqual(result['school_locations'],x)
   self.assertEqual(result['office_rents'],original['office_rents'])
   self.assertEqual(result['schools'],original['schools'])
if __name__=='__main__':unittest.main()
