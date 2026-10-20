"""Offline tests for OpenAI Responses article fallback (no real API calls)."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from openai_news import _response_json, generate_fallback, review_important, MODEL
from summarize_news import enrich

TRIPLET=[
    "송도 지역 공급정책을 새로 발표했습니다.",
    "시행 대상은 관계 기관의 추가 협의를 거쳐 결정합니다.",
    "세부 일정은 아직 공식적으로 확정되지 않았습니다.",
]
BODY="송도 주택 공급정책에 대한 자료를 국토교통부가 공식 발표했습니다. "+("확정 여부와 해당 지역에 대한 세부 내용을 설명했습니다. "*9)


class DummyResponse:
    def __init__(self, value):self.value=value
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,n):return json.dumps(self.value,ensure_ascii=False).encode()


class OpenAITests(unittest.TestCase):
    def test_openai_response_parser_and_non_storage(self):
        def fake_open(request,timeout):
            self.assertTrue(request.full_url.endswith("/v1/responses"))
            self.assertEqual(request.get_header("Authorization"),"Bearer TEST_ONLY")
            submitted=json.loads(request.data)
            self.assertEqual(submitted["model"],MODEL)
            self.assertFalse(submitted["store"])
            data={"items":[{"id":"1","sentences":TRIPLET}]}
            return DummyResponse({"output":[{"type":"message","content":[{"type":"output_text","text":json.dumps(data,ensure_ascii=False)}]}]})
        result=_response_json('한국어 JSON만 반환', "TEST_ONLY", opener=fake_open)
        self.assertEqual(result["items"][0]["sentences"],TRIPLET)

    def test_openai_fallback_require_article_body(self):
        items=[{"id":"1","title":"송도 분양","publisher":"매체","body":BODY}]
        def mock_call(prompt,key):
            self.assertIn("원문",prompt)
            self.assertNotIn("TEST_ONLY",prompt)
            return {"items":[{"id":"1","sentences":TRIPLET}]}
        summary=generate_fallback(items,"TEST_ONLY",request=mock_call)
        self.assertEqual(summary["1"].count("\n"),2)
        self.assertEqual(generate_fallback([{"id":"1","title":"제목","publisher":"매체","body":"없음"}],"TEST_ONLY",request=mock_call),{})
        self.assertEqual(generate_fallback(items,"",request=mock_call),{})

    def test_policy_review_uses_source_and_draft(self):
        summary="\n".join(TRIPLET)
        item={"body":BODY,"summary":summary}
        def mock_review(prompt,key,max_tokens=0):
            self.assertIn(BODY[:25],prompt)
            self.assertIn(TRIPLET[0],prompt)
            self.assertLessEqual(max_tokens,750)
            return {"sentences":TRIPLET}
        result=review_important(item,"TEST_ONLY",request=mock_review)
        self.assertEqual(result,summary)
        self.assertEqual(review_important({"body":"원문 없음","summary":summary},"TEST_ONLY",request=mock_review),"")

    def test_enrich_uses_openai_only_on_missed_article(self):
        news={"schema_version":1,"briefs":[
            {"id":"1","title":"정책 사례","category":"정책·규제",
             "sources":[{"title":"뉴스","publisher":"매체","link":"https://example.org/1"}]}]}
        fallback_calls=[]
        def fallback(items,key):
            fallback_calls.append(len(items))
            return {"1":"\n".join(TRIPLET)}
        enriched=enrich(news,{},"GEMINI_TEST_KEY",
            read=lambda url:BODY,generate=lambda batch,key:{},max_calls=3,
            resolve=lambda urls:{u:u for u in urls},
            openai_key="OPENAI_TEST_KEY",fallback=fallback,
            audit=lambda item,key:"")
        brief=enriched["briefs"][0]
        self.assertEqual(brief["summary_method"],"openai_article")
        self.assertEqual(brief["summary_version"],3)
        self.assertEqual(enriched["ai_summary_stats"]["openai_created"],1)
        self.assertEqual(fallback_calls,[1])
        self.assertEqual(enriched["ai_summary_stats"]["awaiting_body"],0)

    def test_cached_openai_reused_without_rebilling(self):
        cached={"id":"1","title":"정책 사례","category":"정책·규제",
            "summary":"\n".join(TRIPLET),"summary_version":3,
            "summary_method":"openai_article"}
        news={"schema_version":1,"briefs":[{"id":"1","title":"정책 사례",
            "category":"정책·규제","sources":[]}]}
        result=enrich(news,{"briefs":[cached]},"",openai_key="",
            resolve=lambda urls:{})
        self.assertEqual(result["briefs"][0]["summary_method"],"openai_article")
        self.assertEqual(result["ai_summary_stats"]["reused"],1)


if __name__=="__main__":
    unittest.main()
