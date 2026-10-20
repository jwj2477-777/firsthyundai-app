"""Offline regressions for free-tier Groq article fallback (no live API calls)."""
import json,os,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from groq_news import _response_json,generate_fallback,review_important,MODEL,GROQ_BLOCKED
from summarize_news import enrich

TRIPLET=[
    "송도 관련 주택 정책을 새로 발표했습니다.",
    "시행 대상은 관계 기관의 추가 협의를 거쳐 결정합니다.",
    "정확한 시행 일정은 아직 공식적으로 확정되지 않았습니다.",
]
BODY="송도 주택 공급정책에 대한 공식 발표입니다. "+("확정 여부 및 지역별 세부 내용을 설명했습니다. "*12)

class Reply:
    def __init__(self, content):self.content=content
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,limit):return json.dumps(self.content,ensure_ascii=False).encode()

class GroqFallbackTests(unittest.TestCase):
    def tearDown(self):
        os.environ.pop(GROQ_BLOCKED,None)

    def test_chat_completions_json_and_only_groq_endpoint(self):
        def fake_open(req,timeout):
            self.assertTrue(req.full_url.endswith("/chat/completions"))
            self.assertEqual(req.full_url.split("/openai/")[0],"https://api.groq.com")
            self.assertEqual(req.get_header("Authorization"),"Bearer LOCAL_TEST_ONLY")
            sent=json.loads(req.data)
            self.assertEqual(sent["model"],MODEL)
            self.assertEqual(sent["response_format"]["type"],"json_object")
            self.assertEqual(sent["reasoning_effort"],"low")
            data={"items":[{"id":"1","sentences":TRIPLET}]}
            return Reply({"choices":[{"message":{"content":json.dumps(data,ensure_ascii=False)}}]})
        result=_response_json("자료 확인","LOCAL_TEST_ONLY",opener=fake_open)
        self.assertEqual(result["items"][0]["sentences"],TRIPLET)

    def test_grounded_fallback_requires_article(self):
        items=[{"id":"1","title":"송도 분양","publisher":"뉴스","body":BODY}]
        def mock(prompt,key):
            self.assertIn("원문",prompt)
            return {"items":[{"id":"1","sentences":TRIPLET}]}
        done=generate_fallback(items,"TEST",request=mock)
        self.assertEqual(done["1"].count("\n"),2)
        self.assertEqual(generate_fallback([{"id":"1","title":"기사","body":"짧음"}],"TEST",request=mock),{})
        self.assertEqual(generate_fallback(items,"",request=mock),{})
        os.environ[GROQ_BLOCKED]="1"
        self.assertEqual(generate_fallback(items,"TEST",request=mock),{})

    def test_optional_policy_review_uses_same_article(self):
        summary="\n".join(TRIPLET)
        item={"body":BODY,"summary":summary}
        def check(prompt,key,max_tokens=0):
            self.assertIn(BODY[:20],prompt)
            self.assertIn(TRIPLET[0],prompt)
            return {"sentences":TRIPLET}
        self.assertEqual(review_important(item,"TEST",request=check),summary)
        self.assertEqual(review_important({"body":"no body","summary":summary},"TEST",request=check),"")

    def test_groq_when_gemini_fails_and_cached(self):
        example={"id":"item1","title":"지역 부동산 정책","category":"정책·규제",
                 "sources":[{"link":"https://example.org/item","title":"기사","publisher":"매체"}]}
        briefs={"schema_version":1,"briefs":[example]}
        called=[]
        def mock_fallback(items,key):
            called.append(len(items))
            return {"item1":"\n".join(TRIPLET)}
        out=enrich(briefs,{},"GEMINI_TEST",read=lambda url:BODY,
              generate=lambda items,key:{},resolve=lambda urls:{u:u for u in urls},
              groq_key="GROQ_TEST",fallback=mock_fallback,audit=lambda item,key:"")
        self.assertEqual(out["briefs"][0]["summary_method"],"groq_article")
        self.assertEqual(out["ai_summary_stats"]["groq_created"],1)
        self.assertEqual(out["ai_summary_stats"]["awaiting_body"],0)
        self.assertEqual(called,[1])
        fresh={"schema_version":1,"briefs":[{
              "id":"item1","title":"지역 부동산 정책","category":"정책·규제","sources":[]}]}
        reused=enrich(fresh,{"briefs":[out["briefs"][0]]},"",
              resolve=lambda urls:{})
        self.assertEqual(reused["ai_summary_stats"]["reused"],1)
        self.assertEqual(reused["briefs"][0]["summary_method"],"groq_article")

if __name__=="__main__":unittest.main()
