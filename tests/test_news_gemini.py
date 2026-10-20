"""Offline regression tests for safe, factual Gemini news brief rendering."""
import sys,unittest,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from summarize_news import article_text,enrich,safe_url,summarize,compact_summary,summarize_batch,BATCH_SIZE

class TestGeminiNews(unittest.TestCase):
    def test_extract_real_article_paragraphs(self):
        html="<html><article>"+''.join("<p>송도 지역 아파트의 거래 현황을 통계로 확인했습니다. 수도권과 다른 지역 수치를 구분해서 공개했습니다.</p>" for i in range(4))+"</article></html>"
        # identical paragraphs are not sufficient body evidence
        self.assertEqual(article_text(html,"https://example.org/a"),"")
        html="<html><article>"+''.join("<p>공공기관의 실거래 발표 자료 중 제"+str(i)+"분기 데이터를 검토했습니다. 실거래 신고 시점을 기준으로 지역마다 금액과 건수가 다른 것으로 확인했습니다.</p>" for i in range(6))+"</article></html>"
        self.assertIn("제0분기",article_text(html,"https://example.org/a"))
        self.assertEqual(article_text(html,"https://news.google.com/rss/articles/ab"),"")
    def test_collect_news_div_and_structured_article_text(self):
        body=("인천 송도의 주민 편의시설에 관한 조사결과가 발표됐습니다. "
              "시설별 개선 일정과 담당 기관에 대한 구체적인 내용도 공개됐습니다. ")*5
        div_html="<html><div id='newsct_article'><div>"+body+"</div></div></html>"
        self.assertIn("인천 송도",article_text(div_html,"https://example.org/news"))
        ld=json.dumps({"@context":"https://schema.org","@type":"NewsArticle",
            "articleBody":body},ensure_ascii=False)
        html="<html><script type='application/ld+json'>"+ld+"</script></html>"
        self.assertIn("개선 일정",article_text(html,"https://example.org/news"))
        self.assertEqual(article_text(html,"https://news.google.com/rss/articles/test"),"")
    def test_alternative_publisher_link_after_two_inaccessible_sources(self):
        data={"schema_version":1,"briefs":[
            {"id":str(i),"title":"송도 주제 "+str(i),"sources":[
                {"link":"https://example.org/"+str(i)+"/"+str(j),
                 "publisher":"매체","title":"송도 주제 "+str(i)} for j in range(3)]}
            for i in range(3)]}
        urls=[]
        def resolver(sources):
            urls.extend(sources)
            return {u:u for u in sources}
        def read(src):
            return ("송도 지방정부가 정책 개편을 공식적으로 발표했습니다. "*12
                    if src.endswith("/2") else "")
        sentence="송도 지역 교통정책을 새로 발표했습니다.\n노선 운영 계획은 관계 기관과 협의하고 있습니다.\n추가 시행일은 아직 결정되지 않았습니다."
        def generate(batch,key):
            return {str(x["id"]):sentence for x in batch}
        result=enrich(data,{},"SECRET",read,generate,resolve=resolver)
        self.assertEqual(result["ai_summary_stats"]["created"],3)
        self.assertEqual(result["ai_summary_stats"]["source_links_resolved"],9)
        self.assertTrue(any(u.endswith("/2") for u in urls))

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
        compact="송도 개발계획의 사업 일정을 재검토합니다.\n시공사 선정 절차를 다시 진행하기로 했습니다.\n착공 시점은 추후 발표할 예정입니다."
        before={"briefs":[{"id":"1","title":"정책 A","summary_method":"gemini_article",
                            "summary":compact,"summary_version":3,
                            "summary_model":"gemini-3.5-flash-lite"}]}
        calls=[]
        def fake_read(url):
            calls.append(("read",url))
            return "기사에 나온 확인된 정책 사실을 직접 기술합니다. "*15
        def fake_generate(batch,key):
            calls.append(("gemini",len(batch)))
            return {str(x["id"]):"정부가 주택 관련 규제 개편을 검토하고 있습니다.\n해당 규제의 대상과 범위를 관계 기관이 협의하고 있습니다.\n시행 여부는 아직 확정되지 않았습니다." for x in batch}
        done=enrich(original,before,"SECRET",fake_read,fake_generate,max_calls=1,
                    resolve=lambda urls:{u:u for u in urls})
        self.assertEqual(done["ai_summary_stats"]["created"],1)
        self.assertEqual(done["ai_summary_stats"]["reused"],1)
        self.assertEqual(done["ai_summary_stats"]["awaiting_body"],1)
        self.assertEqual(done["briefs"][0]["summary"],compact)
        self.assertEqual(done["briefs"][1]["summary_method"],"gemini_article")
        self.assertEqual(done["briefs"][1]["summary_version"],3)
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
            return {str(b["id"]):"송도 관련 주택 공급정책의 조정안을 논의하고 있습니다.\n공급 확대 대상 지역은 아직 정해지지 않았습니다.\n개편안 시행 일정도 아직 확정되지 않았습니다." for b in batch}
        result=enrich(data,{},"SECRET",lambda url:"검증된 기사 내용과 언론사 정보를 확보했습니다. "*20,
                      short_batch,resolve=lambda urls:{u:u for u in urls})
        self.assertEqual(result["ai_summary_stats"]["created"],BATCH_SIZE+2)
        self.assertEqual(calls,[BATCH_SIZE,2])
        self.assertTrue(all(len(x["summary"])<=285 for x in data["briefs"]))
    def test_summary_must_be_short_and_complete(self):
        self.assertEqual(compact_summary("기사의 내용 중 알맞게 확인할 수 있는 핵심 요지입니다."*5),"")
        self.assertEqual(compact_summary("<script>악성</script>"),"")
        self.assertEqual(compact_summary("진행 중"),"")
        example=["정부가 주택 세제 개편안을 발표했습니다.",
                 "양도세와 종부세를 각각 2%, 3% 인상하는 내용을 제시했습니다.",
                 "시행 시점은 2034년 3월로 발표됐습니다."]
        text=compact_summary(example)
        self.assertEqual(text.count("\n"),2)
        self.assertIn("2%",text)
        self.assertEqual(compact_summary(example[:2]),"")
        self.assertEqual(compact_summary(example+["연관된 논의가 계속되고 있습니다.","추가됐습니다."]),"")
        self.assertEqual(compact_summary([example[0]]*3),"")
    def test_api_accepts_object_or_bare_array(self):
        payload=[{"id":"1","sentences":["공급정책 개편안을 공식 발표했습니다.",
                 "시행 대상은 국토부 발표자료에 기재됐습니다.","시행일은 아직 결정되지 않았습니다."]}]
        class Response:
            def __init__(self,json_data):self.json_data=json_data
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,size):return json.dumps({"candidates":[{"content":{"parts":[
                {"text":json.dumps(self.json_data,ensure_ascii=False)}]}}]}).encode()
        class Opener:
            def __init__(self,data):self.data=data
            def open(self,*args,**kwargs):return Response(self.data)
        articles=[{"id":"1","title":"공급정책","publisher":"테스트뉴스","body":"내용 검증용 본문입니다. "*80}]
        for response in [payload,{"items":payload}]:
            result=summarize_batch(articles,"SYNTHETIC",opener=Opener(response))
            self.assertEqual(result["1"].count("\n"),2)
            self.assertIn("시행일",result["1"])
        self.assertEqual(summarize_batch(articles,"SYNTHETIC",opener=Opener([])),{})

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
