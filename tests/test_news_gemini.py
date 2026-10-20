"""Offline regression tests for safe, factual Gemini news brief rendering."""
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from summarize_news import article_text,enrich,safe_url,summarize,compact_summary,BATCH_SIZE

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
        compact="송도 개발계획 조정 — 사업 일정 재검토와 착공 시점 연기."
        before={"briefs":[{"id":"1","title":"정책 A","summary_method":"gemini_article",
                            "summary":compact,"summary_version":2,
                            "summary_model":"gemini-3.5-flash-lite"}]}
        calls=[]
        def fake_read(url):
            calls.append(("read",url))
            return "기사에 나온 확인된 정책 사실을 직접 기술합니다. "*15
        def fake_generate(batch,key):
            calls.append(("gemini",len(batch)))
            return {str(x["id"]):"주택 규제 정책 변경 검토 — 확정 전이며 후속 발표를 기다리는 상황." for x in batch}
        done=enrich(original,before,"SECRET",fake_read,fake_generate,max_calls=1,
                    resolve=lambda urls:{u:u for u in urls})
        self.assertEqual(done["ai_summary_stats"]["created"],1)
        self.assertEqual(done["ai_summary_stats"]["reused"],1)
        self.assertEqual(done["ai_summary_stats"]["awaiting_body"],1)
        self.assertEqual(done["briefs"][0]["summary"],compact)
        self.assertEqual(done["briefs"][1]["summary_method"],"gemini_article")
        self.assertEqual(done["briefs"][1]["summary_version"],2)
        self.assertEqual(done["briefs"][2]["summary_method"],"headline_only")
        self.assertEqual(len([x for x in calls if x[0]=="gemini"]),1)
    def test_many_articles_batched_and_directional(self):
        data={"schema_version":1,"briefs":[
            {"id":str(i),"title":"테스트 "+str(i),"sources":[
                {"link":"https://example.org/"+str(i),"title":"테스트","publisher":"뉴스"}]}
            for i in range(BATCH_SIZE+2)]}
        calls=[]
        def short_batch(batch,key):
            calls.append(len(batch))
            return {str(b["id"]):"송도 관련 주택 정책 조정 — 공급 확대 논의, 시행 여부는 미확정." for b in batch}
        result=enrich(data,{},"SECRET",lambda url:"검증된 기사 내용과 언론사 정보를 확보했습니다. "*20,
                      short_batch,resolve=lambda urls:{u:u for u in urls})
        self.assertEqual(result["ai_summary_stats"]["created"],BATCH_SIZE+2)
        self.assertEqual(calls,[BATCH_SIZE,2])
        self.assertTrue(all(len(x["summary"])<=105 for x in data["briefs"]))
    def test_summary_must_be_short_and_complete(self):
        self.assertEqual(compact_summary("기사의 내용 중 알맞게 확인할 수 있는 핵심 요지입니다."*5),"")
        self.assertEqual(compact_summary("<script>악성</script>"),"")
        self.assertEqual(compact_summary("진행 중"),"")
        self.assertIn("조정",compact_summary("부동산 공급 정책 조정 — 지방 공급 확대 검토, 시행일은 미정."))

    def test_url_decoder_failure_stays_safe(self):
        from summarize_news import resolve_rss_links
        self.assertEqual(resolve_rss_links([]), {})
        self.assertEqual(resolve_rss_links(["http://localhost/admin"]), {})
        self.assertEqual(resolve_rss_links(["https://127.0.0.1/"]), {})
    def test_no_key_means_no_ai_hallucination(self):
        data={"schema_version":1,"briefs":[{"id":"a","title":"보도","sources":[]}]}
        res=enrich(data,{},key="")
        self.assertEqual(res["briefs"][0]["summary_method"],"headline_only")
        self.assertEqual(res["briefs"][0]["summary"],"")
        self.assertNotIn("Gemini",res["briefs"][0]["verification"])
    def test_reject_unverified_title_only_gemini_request(self):
        self.assertEqual(summarize("제목","신문","제목만 있음","API_KEY"),"")

if __name__=="__main__":
    unittest.main()
