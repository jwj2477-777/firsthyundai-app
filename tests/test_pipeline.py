"""python -m unittest discover -s tests -v"""
import sys, unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from collect_trades import parse_response, normalize, recent_months, unique_ids, normalized_service_key
from collect_news import parse_rss, deduplicate, make_briefs, rss_link

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
    def test_lease_and_cancel(self):
        b={'법정동':'송도동','아파트':'연습단지','전용면적':'84.99','년':'2026','월':'10','일':'2','층':'21','보증금액':'50,000','월세금액':'0'}
        r=normalize(b,'임대','202610');self.assertEqual(r['type'],'전세');self.assertEqual(r['deposit_10k'],50000)
        b['월세금액']='140';r=normalize(b,'임대','202610');self.assertEqual(r['type'],'월세')
        b['거래금액']='100,000';b['해제여부']='O';r=normalize(b,'매매','202610');self.assertEqual(r['status'],'해제')
    def test_separate_identical_deals(self):
        base={'법정동':'송도동','아파트':'연습단지','전용면적':'84','년':'2026','월':'10','일':'1','거래금액':'90,000'}
        rows=unique_ids([normalize(base,'매매','202610'),normalize(base,'매매','202610')]);self.assertNotEqual(rows[0]['id'],rows[1]['id'])

class NewsTests(unittest.TestCase):
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
