"""python -m unittest discover -s tests -v"""
import sys, unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from collect_trades import parse_response, normalize, recent_months, unique_ids, normalized_service_key, newly_detected
from collect_news import parse_rss, deduplicate, make_briefs, rss_link, relevant_news_title

class TradeTests(unittest.TestCase):
    def test_service_key_normalization(self):
        self.assertEqual(normalized_service_key('a%2Bb%2Fc%3D'), 'a+b/c=')
        self.assertEqual(normalized_service_key('a+b/c='), 'a+b/c=')
        self.assertEqual(normalized_service_key('  a%2Bb%2Fc%3D  '), 'a+b/c=')

    def test_month_rollover(self):
        self.assertEqual(list(recent_months(3,datetime(2026,1,15,tzinfo=timezone.utc))),['202601','202512','202511'])
    def test_molit_xml(self):
        b=b'''<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items><item><abc>aaa</abc></item></items><totalCount>1</totalCount></body></response>'''
        rows,total=parse_response(b)
        self.assertEqual(total,1);self.assertEqual(rows[0]['abc'],'aaa')
    def test_newly_observed_not_contract_day(self):
        row = {
            'contract_date':'2026-09-20', 'building':'송도테스트',
            'area_m2':84.96, 'floor':'15', 'type':'매매',
            'amount_10k':65000, 'deposit_10k':0, 'monthly_10k':0,
            'status':'신고'
        }
        # 해제 정보가 수정되어도 '새 공개 거래'로 다시 분류하지 않음.
        changed = {**row, 'status':'해제', 'cancel_date_raw':'20261019'}
        self.assertEqual(newly_detected([row], [changed]), [])
        self.assertEqual(newly_detected([row], [row,changed]), [changed])
        self.assertEqual(newly_detected([row], [row]), [])
        # 계약일이 과거이더라도 이전 관측에 없으면 신규로 판단.
        self.assertEqual(newly_detected([], [row]), [row])

    def test_molit_success_code_000(self):
        payload=b'<response><header><resultCode>000</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items/><totalCount>0</totalCount></body></response>'
        rows,total=parse_response(payload)
        self.assertEqual(total,0)
        self.assertEqual(rows,[])

    def test_error_xml(self):
        with self.assertRaises(RuntimeError):
            parse_response(b'<response><header><resultCode>30</resultCode><resultMsg>INVALID KEY</resultMsg></header></response>')
    def test_filter_other_dong(self):
        base={'법정동':'연수동','아파트':'타단지','전용면적':'84.9','년':'2026','월':'10','일':'15','거래금액':'90,000'}
        self.assertIsNone(normalize(base,'매매','202610'))
        base['법정동']='송도동'
        row=normalize(base,'매매','202610')
        self.assertEqual(row['amount_10k'],90000)
        self.assertEqual(row['contract_date'],'2026-10-15')
    def test_official_sale_broker_region_korean_and_english(self):
        core={'법정동':'송도동','아파트':'연습단지','전용면적':'84.99','년':'2026','월':'10','일':'19',
              '층':'27','거래금액':'100,000','거래유형':'중개거래','중개사소재지':'서울 강남구'}
        sale=normalize(core,'매매','202610')
        self.assertEqual(sale['dealing_type'],'중개거래')
        self.assertEqual(sale['broker_region_raw'],'서울 강남구')
        core['중개사소재지']='인천 연수구'
        self.assertEqual(normalize(core,'매매','202610')['broker_region_raw'],'인천 연수구')
        core.pop('중개사소재지')
        self.assertEqual(normalize(core,'매매','202610')['broker_region_raw'],'')
        english={'umdNm':'송도동','aptNm':'연습단지','excluUseAr':'84.99','dealYear':'2026',
                 'dealMonth':'10','dealDay':'19','floor':'27','dealAmount':'100,000',
                 'dealingGbn':'중개거래','estateAgentSggNm':'경기 성남시 분당구'}
        self.assertEqual(normalize(english,'매매','202610')['broker_region_raw'],'경기 성남시 분당구')
        before=normalize(core,'매매','202610')
        after=normalize({**core,'중개사소재지':'경기 성남시 분당구'},'매매','202610')
        self.assertEqual(newly_detected([before],[after]),[])

    def test_lease_and_cancel(self):
        b={'법정동':'송도동','아파트':'연습단지','전용면적':'84.99','년':'2026','월':'10','일':'2','층':'21','보증금액':'50,000','월세금액':'0'}
        r=normalize(b,'임대','202610');self.assertEqual(r['type'],'전세');self.assertEqual(r['deposit_10k'],50000)
        b['월세금액']='140';r=normalize(b,'임대','202610');self.assertEqual(r['type'],'월세')
        b['거래금액']='100,000';b['해제여부']='O';r=normalize(b,'매매','202610');self.assertEqual(r['status'],'해제')
    def test_renewal_fields_korean_and_english_and_missing(self):
        base = {'법정동': '송도동', '아파트': '연습단지', '전용면적': '84.99',
                '년': '2026', '월': '10', '일': '3', '층': '12',
                '보증금액': '41,000', '월세금액': '0', '계약구분': '갱신',
                '갱신요구권사용': '사용', '계약기간': '26.11~28.11',
                '종전계약보증금': '39,000', '종전계약월세': '0'}
        renewal = normalize(base, '임대', '202610')
        self.assertEqual(renewal['contract_type_raw'], '갱신')
        self.assertEqual(renewal['renewal_raw'], '사용')
        self.assertEqual(renewal['contract_term_raw'], '26.11~28.11')
        self.assertEqual(renewal['previous_deposit_raw'], '39,000')
        self.assertEqual(renewal['previous_monthly_raw'], '0')
        # 공식 API 영문 태그도 동일하게 유지
        english = {'umdNm': '송도동', 'aptNm': '연습단지',
                   'excluUseAr': '84.99', 'dealYear': '2026',
                   'dealMonth': '10', 'dealDay': '3', 'floor': '12',
                   'deposit': '2,000', 'monthlyRent': '90',
                   'contractType': '갱신', 'useRRRight': '미사용',
                   'contractTerm': '26.10~28.10', 'preDeposit': '1,000',
                   'preMonthlyRent': '75'}
        monthly = normalize(english, '임대', '202610')
        self.assertEqual(monthly['type'], '월세')
        self.assertEqual(monthly['previous_deposit_raw'], '1,000')
        self.assertEqual(monthly['previous_monthly_raw'], '75')
        self.assertEqual(monthly['renewal_raw'], '미사용')
        # 응답에 종전금액이 없으면 0이라고 기록하지 않음
        base.pop('종전계약보증금')
        base.pop('종전계약월세')
        missing = normalize(base, '임대', '202610')
        self.assertEqual(missing['previous_deposit_raw'], '')
        self.assertEqual(missing['previous_monthly_raw'], '')
        # 새로운 원본 설명이 추가돼도 신규 공개 거래로 다시 분류하지 않음
        self.assertEqual(newly_detected([missing], [renewal]), [])

    def test_separate_identical_deals(self):
        base={'법정동':'송도동','아파트':'연습단지','전용면적':'84','년':'2026','월':'10','일':'1','거래금액':'90,000'}
        rows=unique_ids([normalize(base,'매매','202610'),normalize(base,'매매','202610')]);self.assertNotEqual(rows[0]['id'],rows[1]['id'])

class NewsTests(unittest.TestCase):
    def test_local_news_relevance(self):
        self.assertTrue(relevant_news_title('송도 GTX-B 역사 착공 추진', '개발·교통'))
        self.assertTrue(relevant_news_title('연수구 송도 아파트 분양', '분양·입주'))
        self.assertFalse(relevant_news_title('강원 망상지구 개발계획 변경', '개발·교통'))
        self.assertFalse(relevant_news_title('카지노 주택 게임 이벤트', '정책·규제'))
        self.assertFalse(relevant_news_title('토토 대출 빠른가입 안내', '세금·대출'))
        self.assertTrue(relevant_news_title('주담대 변동금리 6% 돌파', '세금·대출'))
        self.assertTrue(relevant_news_title('국토부 주택 공급정책 발표', '정책·규제'))

    def test_feed_query(self):self.assertIn('news.google.com/rss/search',rss_link('송도 GTX-B'))
    def test_parse_and_group(self):
        payload='''<rss><channel><item><title>송도 개발 진행 - 테스트뉴스</title><link>https://news.google.com/rss/articles/test</link><pubDate>Mon, 19 Oct 2026 00:00:00 GMT</pubDate><source>테스트뉴스</source></item></channel></rss>'''.encode()
        articles=parse_rss(payload,'개발·교통','송도 개발')
        self.assertEqual(len(articles),1)
        briefs=make_briefs(articles)
        self.assertEqual(len(briefs),1)
        self.assertEqual(briefs[0]['verification'],'언론 제목 기반 자동 분류 · 사실 미검증')
        self.assertEqual(len(deduplicate(articles+articles)),1)

if __name__=='__main__':unittest.main()
