"""Optional public-news Gemini/Groq office digest stays grounded and quota-safe."""
import os
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from news_intelligence import candidates,enrich_digest,signature,valid_items

def sample():
    return {"briefs":[{
        "id":"b"+str(i),"title":"인천 송도 주택정책 기사 "+str(i),
        "category":"정책·규제" if i%2==0 else "분양·입주",
        "summary_method":"gemini_article","summary_version":3,
        "summary_source_url":"https://example.org/article"+str(i),
        "summary":"인천에서 공식 논의가 이어지고 있습니다. 관련 사업 시행일은 정해지지 않았습니다. 추가 안내는 추후 발표합니다."
    } for i in range(3)]}

class PublicOfficeAIDigest(unittest.TestCase):
    def test_public_news_only(self):
        n=sample()
        n["briefs"] += [{"id":"private","title":"실제 계약 메모","summary":"고객정보 포함"*20,
                         "summary_method":"headline_only","summary_version":3},
                        {"id":"unverified","title":"소문","summary":"정부 발표"*20,
                         "summary_method":"gemini_article","summary_version":2,
                         "summary_source_url":"https://example.org/a"}]
        self.assertEqual(len(candidates(n)),3)
        self.assertNotIn("private",str(candidates(n)))
    def test_success_and_cache_without_another_api_call(self):
        news=sample()
        calls=[]
        def gemini(prompt,key):
            calls.append(key)
            self.assertNotIn("고객정보",prompt)
            return {"items":[{"id":"b0","point":"인천에서 주택정책 관련 공식 논의가 이어졌습니다.",
                              "check":"관련 정책의 적용 대상과 공식 발표 시점을 확인하시겠습니까?"}]}
        first=enrich_digest(news,{},"FAKE_KEY","",gemini_call=gemini)
        self.assertEqual(first["ai_office_digest_stats"]["state"],"created")
        self.assertEqual(first["ai_office_digest"]["method"],"gemini")
        second=enrich_digest(sample(),first,"FAKE_KEY","",gemini_call=lambda *a: self.fail("cache missed"))
        self.assertEqual(second["ai_office_digest_stats"]["state"],"reused")
        self.assertEqual(len(calls),1)
    def test_groq_fallback_and_quota(self):
        n=sample()
        def groq(prompt,key,max_tokens):
            return {"items":[{"id":"b1","point":"인천 송도 주택정책의 추진 상황이 보도됐습니다.",
                              "check":"보도된 추진 상황을 관계 기관에서 확인하시겠습니까?"}]}
        done=enrich_digest(n,{},"GEMINI","GROQ",gemini_call=lambda *_:{},
                           groq_call=groq)
        self.assertEqual(done["ai_office_digest"]["method"],"groq")
        empty=enrich_digest(sample(),{},"GEMINI","GROQ",gemini_call=lambda *_: {},
                            groq_call=lambda *a,**k: {})
        self.assertEqual(empty["ai_office_digest_stats"]["state"],"unavailable_or_quota")
        self.assertNotIn("ai_office_digest",empty)
    def test_no_secrets_and_invalid_id(self):
        news=sample()
        bad={"items":[{"id":"other","point":"수상한 긴 설명이 들어갑니다.",
                       "check":"확인이 필요한 실제 대상이 뭔지 물어봅니다."},
                      {"id":"b0","point":"<script>안내문이 필요하다</script>",
                       "check":"새로운 내용을 확인해 보시겠습니까?"}]}
        self.assertEqual(valid_items(bad,candidates(news)),[])
        done=enrich_digest(news,{},"","")
        self.assertEqual(done["ai_office_digest_stats"]["state"],"unavailable_or_quota")
        self.assertNotIn("ai_office_digest",done)

if __name__=='__main__':
    unittest.main()
