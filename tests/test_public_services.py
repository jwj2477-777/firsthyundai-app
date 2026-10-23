"""Public source adapter tests: parsing, scope, approval gating and data safety."""
import importlib.util,json,tempfile,unittest
from urllib.parse import parse_qs,urlsplit
from urllib.error import HTTPError
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


def subscription_payload(rows,total=None,page=1):
 return json.dumps({'page':page,'perPage':100,'currentCount':len(rows),
  'matchCount':len(rows) if total is None else total,
  'totalCount':10000,'data':rows},ensure_ascii=False).encode()

def subscription_example(**kw):
 row={'HOUSE_MANAGE_NO':'2026000777','PBLANC_NO':'2026102001',
  'HOUSE_NM':'송도 테스트힐스','HSSPLY_ADRES':'인천광역시 연수구 송도동 123',
  'RCRIT_PBLANC_DE':'2026-10-18','SUBSCRPT_RCEPT_BGNDE':'2026-10-22',
  'SUBSCRPT_RCEPT_ENDDE':'2026-10-24','TOT_SUPLY_HSHLDCO':'250',
  'PBLANC_URL':'https://www.applyhome.co.kr/ai/aia/test.do?x=1'}
 row.update(kw)
 return row

class PublicDataTests(unittest.TestCase):
 def test_neis_school_not_assigned_by_address(self):
  rows=p.parse_schools(neis_payload())
  self.assertEqual({x['name'] for x in rows},{'인천송도초등학교','인천송도중학교'})
  self.assertTrue(all('assigned' not in x for x in rows))
  school=p.collect_schools('fake',opener=lambda req:neis_payload())
  self.assertEqual(school['state'],'verified')
  self.assertEqual(len(school['records']),2)
  self.assertIn('배정학교',school['note'])
 def test_neis_recovers_from_500_by_using_smaller_pages(self):
  calls=[]
  def mock(req):
   args=parse_qs(urlsplit(req.full_url).query)
   calls.append(int(args['pSize'][0]))
   if int(args['pSize'][0])>=100:
    raise HTTPError(req.full_url,500,'simulated NEIS service error',None,None)
   return neis_payload()
  school=p.collect_schools('mock-neis-key',opener=mock)
  self.assertEqual(school['state'],'verified')
  self.assertEqual(len(school['records']),2)
  self.assertEqual(calls,[100,25])
  self.assertTrue(all('assigned' not in record for record in school['records']))

 def test_neis_http_500_all_pages_never_publishes_sample_rows_or_key(self):
  calls=[]
  def mock(req):
   args=parse_qs(urlsplit(req.full_url).query)
   key=args['KEY'][0]
   calls.append((key,int(args['pSize'][0])))
   if key=='sample':return neis_payload()
   raise HTTPError(req.full_url,500,'simulated upstream failure',None,None)
  with self.assertRaises(RuntimeError) as error:
   p.collect_schools('private-neis-key',opener=mock)
  self.assertIn('sample 조회는 정상',str(error.exception))
  self.assertNotIn('private-neis-key',str(error.exception))
  self.assertEqual(calls,[('private-neis-key',100),('private-neis-key',25),
                          ('private-neis-key',5),('sample',5)])

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
 def test_office_sale_api_and_cancellation_are_separate(self):
  raw='''<response><header><resultCode>000</resultCode></header><body><totalCount>3</totalCount><items>
  <item><offiNm>송도 거래 오피스텔</offiNm><sggNm>연수구</sggNm><umdNm>송도동</umdNm><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>22</dealDay><dealAmount>36,500</dealAmount><excluUseAr>45.22</excluUseAr><floor>11</floor><dealingGbn>중개거래</dealingGbn></item>
  <item><offiNm>송도 거래 오피스텔</offiNm><sggNm>연수구</sggNm><umdNm>송도동</umdNm><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>21</dealDay><dealAmount>29,900</dealAmount><excluUseAr>39.15</excluUseAr><cdealType>O</cdealType></item>
  <item><offiNm>지역 외</offiNm><umdNm>구월동</umdNm><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>22</dealDay><dealAmount>10,000</dealAmount><excluUseAr>40</excluUseAr></item>
  </items></body></response>'''.encode()
  rows,total=p.office_items(raw)
  self.assertEqual(total,3)
  sales=p.normalize_office_sales(rows,'202610')
  self.assertEqual(len(sales),2)
  self.assertEqual(sales[0]['price_10k'],36500)
  self.assertEqual(sales[1]['status'],'해제')
  self.assertNotIn('deposit_10k',sales[0])
  def fake(req):
   self.assertIn('/RTMSDataSvcOffiTrade/',req.full_url)
   self.assertIn('LAWD_CD=28185',req.full_url)
   return raw
  result=p.collect_office_sales('fake',opener=fake,months=1)
  self.assertEqual(result['state'],'verified')
  self.assertEqual(len(result['records']),2)
  self.assertNotIn('fake',json.dumps(result,ensure_ascii=False))

 def test_office_sale_failure_does_not_change_rental_snapshot(self):
  with tempfile.TemporaryDirectory() as directory:
   dest=Path(directory)/'public_services.json'
   original={'schema_version':1,'office_rents':{'state':'verified','records':[{'building':'기존 전월세'}]},
     'office_sales':{'state':'awaiting_approval','records':[]}}
   dest.write_text(json.dumps(original,ensure_ascii=False),encoding='utf8')
   with self.assertRaises(RuntimeError):
    p.collect_office_sales('fake',opener=lambda req:b'<response><header><resultCode>30</resultCode></header></response>',months=1)
   self.assertEqual(json.loads(dest.read_text(encoding='utf8')),original)
   p.update_snapshot(dest,office_sales={'state':'verified','records':[{'building':'신규 매매'}]})
   verified=json.loads(dest.read_text(encoding='utf8'))
   self.assertEqual(verified['office_rents']['records'][0]['building'],'기존 전월세')
   self.assertEqual(verified['office_sales']['records'][0]['building'],'신규 매매')

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

 def test_applyhome_incheon_official_filter_and_schedule(self):
  calls=[]
  def fetch(req):
   u=urlsplit(req.full_url)
   params=parse_qs(u.query)
   self.assertEqual(params['serviceKey'],['fake-key'])
   self.assertEqual(params['cond[SUBSCRPT_AREA_CODE_NM::EQ]'],['인천'])
   self.assertIn('cond[RCRIT_PBLANC_DE::GTE]',params)
   calls.append(u.path)
   return subscription_payload([subscription_example(),
    subscription_example(HOUSE_MANAGE_NO='2026000888',HSSPLY_ADRES='서울특별시 강남구 송도대로'),
    subscription_example(HOUSE_MANAGE_NO='2026000999',HSSPLY_ADRES='인천광역시 남동구 구월동')])
  result=p.collect_subscriptions('fake-key',opener=fetch,today=p.datetime(2026,10,20).date())
  self.assertEqual(result['state'],'verified')
  self.assertEqual(len(result['records']),6)
  self.assertTrue(any('남동구' in v['address'] for v in result['records']))
  self.assertFalse(any('서울' in v['address'] for v in result['records']))
  self.assertEqual(len(calls),3)
  self.assertEqual(result['records'][0]['apply_start'],'2026-10-22')
  self.assertEqual(result['records'][0]['households'],250)
  self.assertEqual(result['records'][0]['notice_url'], 'https://www.applyhome.co.kr/ai/aia/test.do?x=1')
  self.assertIn('ApplyhomeInfoDetailSvc',result['source_url'] if 'ApplyhomeInfoDetailSvc' in result['source_url'] else p.APPLYHOME_BASE)
  self.assertNotIn('fake-key',json.dumps(result,ensure_ascii=False))
 def test_applyhome_bad_result_and_unsafe_urls(self):
  self.assertEqual(p.subscription_date('20261020'),'2026-10-20')
  self.assertEqual(p.subscription_date('2026-02-30'),'')
  self.assertEqual(p.official_notice_link('https://evil.example/?k=1'),'')
  self.assertEqual(p.official_notice_link('http://www.applyhome.co.kr/'),'')
  self.assertEqual(p.official_notice_link('https://www.applyhome.co.kr.evil.com/'),'')
  with self.assertRaises(RuntimeError):p.subscription_rows(b'{"result":"SERVICE_ACCESS_DENIED_ERROR"}')
  with self.assertRaises(RuntimeError):p.subscription_rows(b'<xml>error</xml>')
  rows=p.normalize_subscriptions([subscription_example(PBLANC_URL='https://bad.example')],'아파트')
  self.assertEqual(rows[0]['notice_url'],'')
 def test_applyhome_pagination_and_fail_closed(self):
  times=[]
  def mock(req):
   u=urlsplit(req.full_url)
   params=parse_qs(u.query)
   page=int(params['page'][0])
   times.append((u.path,page))
   if page==1:return subscription_payload([subscription_example()],total=101,page=1)
   return subscription_payload([subscription_example(PBLANC_NO='2026102002')],total=101,page=2)
  result=p.collect_subscriptions('key',opener=mock,today=p.datetime(2026,10,20).date())
  self.assertEqual(len(result['records']),6)
  self.assertEqual(len(times),6)
  # An upstream error must not touch the existing published snapshot.
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'snapshot.json'
   original={'schema_version':1,'subscriptions':{'state':'verified','records':[{'name':'old'}]}}
   path.write_text(json.dumps(original),encoding='utf8')
   with self.assertRaises(RuntimeError):
    p.collect_subscriptions('key',opener=lambda req:b'{"data":[],"totalCount":500,"page":1}',today=p.datetime(2026,10,20).date())
   self.assertEqual(json.loads(path.read_text(encoding='utf8')),original)

 def test_registry_and_maintenance_match_exact_official_codes(self):
  import sys
  sys.path.insert(0,str(root/'scripts'))
  import collect_registry_maintenance as rf
  example={'kaptCode':'A10020270','kaptName':'송도푸르지오월드마크1단지',
    'bjdCode':'2818510600','kaptAddr':'인천광역시 연수구 송도동 20-22 송도푸르지오월드마크1단지',
    'doroJuso':'인천광역시 연수구 컨벤시아대로 50'}
  catalog=[{'id':'kapt-a10020270','kapt_code':'A10020270','address':example['doroJuso']}]
  self.assertEqual(rf.match_lot(example['kaptAddr']),('0020','0022'))
  self.assertEqual([x['id'] for x in rf.upsert_complex_targets(catalog,example)],['kapt-a10020270'])
  self.assertEqual(rf.upsert_complex_targets(catalog,dict(example,bjdCode='1111010100')),[])
  row={'sigunguCd':'28185','bjdongCd':'10600','bun':20,'ji':22,'mainPurpsCdNm':'공동주택(아파트)',
    'newPlatPlc':example['doroJuso'],'useAprDay':'20101119','grndFlrCnt':'20'}
  self.assertEqual(rf.verify_building_rows([row],example)['approval_date'],'2010-11-19')
  self.assertEqual(rf.verify_building_rows([dict(row,dongNm='101동')],example)['buildings'][0],{'name':'101동','ground_floors':20,'approval_date':'2010-11-19'})
  self.assertIsNone(rf.verify_building_rows([dict(row,bun=21)],example))
  self.assertIsNone(rf.verify_building_rows([dict(row,newPlatPlc='서울특별시 강남구 역삼로 2')],example))
  self.assertIsNone(rf.verify_building_rows([dict(row,mainPurpsCdNm='근린생활시설')],example))
  self.assertIsNone(rf.normalize_cost_response([{'kaptCode':'B00000000','kaptName':example['kaptName'],'pay':1000}],example['kaptCode'],example['kaptName'],('pay',)))
  self.assertEqual(rf.normalize_cost_response([{'kaptCode':example['kaptCode'],'kaptName':example['kaptName'],'pay':1000}],example['kaptCode'],example['kaptName'],('pay',)),1000)
  self.assertEqual(rf.won(None),None)
  self.assertEqual(rf.won('0'),0)
  self.assertEqual(rf.won('garbage'),None)
 def test_official_zone_is_download_and_never_auto_assigned(self):
  snap=json.loads((root/'data'/'public_services.json').read_text(encoding='utf8'))
  self.assertEqual(snap['school_zones']['state'],'published_download_available')
  self.assertIn(snap['schools']['state'],('awaiting_key','verified'))
  if snap['schools']['state']=='verified':
   self.assertTrue(snap['schools']['records'])
   self.assertTrue(all('assigned' not in x for x in snap['schools']['records']))
  self.assertIn(snap['maintenance']['state'],('awaiting_approval','verified'))
  self.assertFalse(snap['school_zones']['records'])

if __name__=='__main__':unittest.main()
