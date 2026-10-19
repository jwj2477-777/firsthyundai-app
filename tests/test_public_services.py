"""Public source adapter tests: parsing, scope, approval gating and data safety."""
import importlib.util,json,tempfile,unittest
from pathlib import Path

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extra',root/'scripts'/'collect_public_services.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

def neis_payload():
 return json.dumps({'schoolInfo':[
  {'head':[{'list_total_count':3},{'RESULT':{'CODE':'INFO-000','MESSAGE':'정상 처리'}}]},
  {'row':[
   {'SCHUL_NM':'인천송도초등학교','SD_SCHUL_CODE':'E123','ORG_RDNMA':'인천광역시 연수구 송도교육로 123','SCHUL_KND_SC_NM':'초등학교','ORG_TELNO':'032-1234-5678'},
   {'SCHUL_NM':'인천다른초','SD_SCHUL_CODE':'E456','ORG_RDNMA':'인천광역시 연수구 청량로 12','SCHUL_KND_SC_NM':'초등학교'},
   {'SCHUL_NM':'인천송도중학교','SD_SCHUL_CODE':'E789','ORG_RDNMA':'인천광역시 연수구 송도동 98','SCHUL_KND_SC_NM':'중학교'}
  ]}
 ]},ensure_ascii=False).encode()

def office_xml():
 return '''<response><header><resultCode>000</resultCode></header><body><totalCount>2</totalCount><items>
  <item><offiNm>송도 테스트오피스텔</offiNm><umdNm>송도동</umdNm><sggNm>연수구</sggNm>
  <deposit>25,000</deposit><monthlyRent>80</monthlyRent><dealYear>2026</dealYear><dealMonth>10</dealMonth>
  <dealDay>15</dealDay><excluUseAr>38.49</excluUseAr><jibun>11-7</jibun><floor>5</floor></item>
  <item><offiNm>다른동 오피스텔</offiNm><umdNm>동춘동</umdNm><sggNm>연수구</sggNm>
  <deposit>2,000</deposit><monthlyRent>20</monthlyRent><dealYear>2026</dealYear><dealMonth>10</dealMonth>
  <dealDay>15</dealDay><excluUseAr>22.00</excluUseAr></item>
 </items></body></response>'''.encode()

class PublicDataTests(unittest.TestCase):
 def test_neis_school_not_assigned_by_address(self):
  rows=p.parse_schools(neis_payload())
  self.assertEqual({x['name'] for x in rows},{'인천송도초등학교','인천송도중학교'})
  self.assertTrue(all('assigned' not in x for x in rows))
  school=p.collect_schools('fake',opener=lambda req:neis_payload())
  self.assertEqual(school['state'],'verified')
  self.assertEqual(len(school['records']),2)
  self.assertIn('배정학교',school['note'])
 def test_neis_invalid_answer_fails_closed(self):
  with self.assertRaises(RuntimeError):
   p.school_rows(b'{"RESULT":{"CODE":"ERROR-300"}}')
  with self.assertRaises(RuntimeError):
   p.collect_schools('',opener=lambda req:neis_payload())
 def test_officetel_keep_separate_and_monthly_classify(self):
  rows,count=p.office_items(office_xml())
  self.assertEqual(count,2)
  output=p.normalize_office(rows,'202610')
  self.assertEqual(len(output),1)
  self.assertEqual(output[0]['type'],'월세')
  self.assertEqual(output[0]['deposit_10k'],25000)
  self.assertEqual(output[0]['monthly_10k'],80)
  self.assertEqual(output[0]['lot_number'],'11-7')
  self.assertEqual(output[0]['area_m2'],38.49)
  self.assertNotIn('households',output[0])
 def test_office_request_and_pagination(self):
  def serve(req):
   self.assertIn('LAWD_CD=28185',req.full_url)
   self.assertIn('DEAL_YMD=',req.full_url)
   return office_xml()
  obj=p.collect_offices('fake',opener=serve,months=1)
  self.assertEqual(obj['state'],'verified')
  self.assertEqual(len(obj['records']),1)
  self.assertRegex(obj['updated_at'],r'^20\d{2}-')
 def test_api_failure_retains_previous_snapshot(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'public_services.json'
   original={'schema_version':1,'building_registry':{'state':'awaiting_approval'},
    'schools':{'state':'awaiting_key','records':[]},'office_rents':{'state':'awaiting_approval','records':[]}}
   path.write_text(json.dumps(original),encoding='utf8')
   with self.assertRaises(RuntimeError):
    p.collect_offices('fake',opener=lambda req:b'<response><header><resultCode>20</resultCode></header></response>',months=1)
   self.assertEqual(json.loads(path.read_text(encoding='utf8')),original)
   p.update_snapshot(path,school=p.collect_schools('fake',opener=lambda req:neis_payload()))
   after=json.loads(path.read_text(encoding='utf8'))
   self.assertEqual(after['building_registry']['state'],'awaiting_approval')
   self.assertEqual(after['office_rents']['state'],'awaiting_approval')
   self.assertEqual(len(after['schools']['records']),2)
 def test_official_zone_is_download_and_never_auto_assigned(self):
  snap=json.loads((root/'data'/'public_services.json').read_text(encoding='utf8'))
  self.assertEqual(snap['school_zones']['state'],'published_download_available')
  self.assertEqual(snap['schools']['state'],'awaiting_key')
  self.assertEqual(snap['maintenance']['state'],'awaiting_approval')
  self.assertFalse(snap['school_zones']['records'])

if __name__=='__main__':unittest.main()
