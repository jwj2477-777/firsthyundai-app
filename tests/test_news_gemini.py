"""Offline regression tests for safe, factual Gemini news brief rendering."""
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from summarize_news import article_text,enrich,safe_url,summarize

class TestGeminiNews(unittest.TestCase):
    def test_extract_real_article_paragraphs(self):
        html="<html><article>"+''.join("<p>송도 지역 아파트의 거래 현황을 통계로 확인했습니다. 수도권과 다른 지역 수치를 구분해서 공개했습니다.</p>" for i in range(4))+"</article></html>"
        # identical paragraphs are not sufficient body evidence
        self.assertEqual(article_text(html,"https://example.org/a"),"")
        html="<html><article>"+''.join("<p>공공기관의 실거래 발표 자료 중 제"+str(i)+"분기 데이터를 검토했습니다. 실거래 신고 시점을 기준으로 지역마다 금액과 건수가 다른 것으로 확인했습니다.</p>" for i in range(6))+"</article></html>"
        self.assertIn("제0분기",article_text(html,"https://example.org/a"))
        self.assertEqual(article_text(html,"https://news.google.com/rss/articles/ab"),"")
    def test_refuse_private_and_unsafe_urls_without_dns(self):
        for link in ["http://example.com/a","https://127.0.0.1/a","https://[::1]/",
                     "https://localhost/x","https://x.local/","file:///etc/passwd",
                     "https://username:secret@example.com/","https://example.com:8080/"]:
            self.assertFalse(safe_url(link),link)
    def test_grounded_summary_caching_and_bounded_calls(self):
        original={"schema_version":1,"briefs":[
            {"id":"1","title":"정책 A","sources":[{"link":"https://news.google.com/a","title":"정책 A","publisher":"A"}]},
            {"id":"2","title":"정책 B","sources":[{"link":"https://news.google.com/b","title":"정책 B","publisher":"B"}]},
            {"id":"3","title":"정책 C","sources":[{"link":"https://news.google.com/c","title":"정책 C","publisher":"C"}]}
        ]}
        before={"briefs":[{"id":"1","title":"정책 A","summary_method":"gemini_article",
                            "summary":"원문에 기초해 정리된 이 정책의 주요 내용과 수치입니다."}]}
        calls=[]
        def fake_read(url):
            calls.append(("read",url))
            return "기사에 나온 확인된 정책 사실을 직접 기술합니다. "*15
        def fake_generate(title,publisher,body,key):
            calls.append(("gemini",title))
            return "이 정책이 논의되고 있다는 점과 실제 시행되지 않았다는 점을 구분했습니다."
        done=enrich(original,before,"SECRET",fake_read,fake_generate,max_calls=1)
        self.assertEqual(done["ai_summary_stats"],{"created":1,"reused":1,"article_fetches":1,"awaiting_body":1})
        self.assertEqual(done["briefs"][0]["summary"],before["briefs"][0]["summary"])
        self.assertEqual(done["briefs"][1]["summary_method"],"gemini_article")
        self.assertEqual(done["briefs"][2]["summary_method"],"headline_only")
        self.assertEqual(len([x for x in calls if x[0]=="gemini"]),1)
    def test_no_key_means_no_ai_hallucination(self):
        data={"schema_version":1,"briefs":[{"id":"a","title":"보도","sources":[]}]}
        res=enrich(data,{},key="")
        self.assertEqual(res["briefs"][0]["summary_method"],"headline_only")
        self.assertIn("본문",res["briefs"][0]["summary"])
        self.assertNotIn("Gemini",res["briefs"][0]["verification"])
    def test_reject_unverified_title_only_gemini_request(self):
        self.assertEqual(summarize("제목","신문","제목만 있음","API_KEY"),"")

if __name__=="__main__":
    unittest.main()
