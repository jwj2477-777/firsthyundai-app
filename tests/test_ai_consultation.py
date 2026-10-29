"""No live requests: evidence, freshness, empty cache and quota failure paths."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import ai_quota
from news_intelligence import candidates, enrich_digest, valid_items, signature, gemini_generate
from summarize_news import enrich, summarize_batch

SUMMARY = "송도 교통사업의 추진 방안을 논의하고 있습니다.\n사업 시행일은 아직 확정되지 않았습니다.\n관련 기관이 검토 결과를 추후 발표할 예정입니다."


def news():
    return {"schema_version": 1, "checked_at": "2026-10-30T09:00:00+09:00", "briefs": [
        {"id": "n1", "title": "송도 교통 검토", "summary": SUMMARY,
         "summary_method": "gemini_article", "summary_version": 3,
         "summary_source_url": "https://example.org/public",
         "last_published_at": "2026-10-29T09:00:00+09:00", "category": "개발·교통"}]}


def answer():
    return {"items": [{"id": "n1", "evidence": SUMMARY.splitlines()[1],
        "check": "사업 일정의 확정 여부를 관계 기관에 확인하시겠습니까?",
        "audiences": ["매수", "임대", "매수", "개인정보"],
        "questions": ["사업 검토 결과의 공식 발표 자료를 확인하시겠습니까?",
                      "해당 사업의 적용 지역을 관계 기관에 문의하시겠습니까?"]}]}


class Consultation(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_evidence_and_questions_are_bounded(self):
        items = valid_items(answer(), candidates(news()))
        self.assertEqual(items[0]["point"], SUMMARY.splitlines()[1])
        self.assertEqual(items[0]["audiences"], ["매수", "임대"])
        self.assertEqual(len(items[0]["questions"]), 2)
        bad = answer()
        bad["items"][0]["evidence"] = "사업 시행일은 확정되었습니다."
        self.assertEqual(valid_items(bad, candidates(news())), [])
        bad = answer()
        bad["items"][0]["check"] = "2030년 착공 여부를 확인하시겠습니까?"
        self.assertEqual(valid_items(bad, candidates(news())), [])
        bad = answer()
        bad["items"][0]["questions"] = ["개인 비밀번호 password를 확인해 주세요.",
                                            "<script>개인정보를 확인해 주세요</script>"]
        self.assertEqual(valid_items(bad, candidates(news()))[0]["questions"], [])

    def test_candidates_fresh_diverse_and_order_independent_cache(self):
        n = news()
        for i in range(12):
            n["briefs"].append({**n["briefs"][0], "id": str(i), "category": "정책·규제"})
        n["briefs"].append({**n["briefs"][0], "id": "stale", "last_published_at": "2026-10-01"})
        n["briefs"].append({**n["briefs"][0], "id": "future", "last_published_at": "2026-11-20"})
        rows = candidates(n)
        self.assertEqual(len(rows), 9)
        self.assertIn("n1", [r["id"] for r in rows])
        self.assertNotIn("stale", [r["id"] for r in rows])
        self.assertNotIn("future", [r["id"] for r in rows])
        self.assertEqual(signature(rows), signature(list(reversed(rows))))

    def test_empty_selection_cached_but_failure_retries_next_run(self):
        first = enrich_digest(news(), {}, "test", "fallback", gemini_call=lambda *_: {"items": []},
                              groq_call=lambda *a, **k: self.fail("Do not override editorial empty"))
        self.assertEqual(first["ai_office_digest_stats"]["state"], "no_relevant_items")
        second = enrich_digest(news(), first, "test", "fallback", gemini_call=lambda *_: self.fail("cache missed"))
        self.assertEqual(second["ai_office_digest_stats"]["state"], "reused_empty")
        failed = enrich_digest(news(), {}, "test", "", gemini_call=lambda *_: {})
        self.assertNotIn("ai_office_digest_empty", failed)
        retry = enrich_digest(news(), failed, "test", "", gemini_call=lambda *_: answer())
        self.assertEqual(retry["ai_office_digest_stats"]["state"], "created")

    def test_http_429_stops_requests_and_digest_uses_groq(self):
        calls = []
        class Opener:
            def open(self, *args, **kwargs):
                calls.append(1)
                raise HTTPError("https://example.org", 429, "limited", {}, None)
        items = [{"id": "n1", "title": "송도", "publisher": "신문", "body": "공개 본문 검증 자료입니다. " * 30}]
        with patch("summarize_news.sleep", side_effect=AssertionError("No retry after quota")):
            self.assertEqual(summarize_batch(items, "TEST", Opener()), {})
            self.assertEqual(summarize_batch(items, "TEST", Opener()), {})
        self.assertEqual(len(calls), 1)
        self.assertEqual(gemini_generate("public", "test", opener=lambda *a, **k: self.fail("blocked")), {})
        got = enrich_digest(news(), {}, "test", "groq", gemini_call=lambda *_: self.fail("blocked"),
                            groq_call=lambda *a, **k: answer())
        self.assertEqual(got["ai_office_digest"]["method"], "groq")

    def test_collection_stops_after_quota_and_retains_cached_news(self):
        before = news()
        current = news()
        current["briefs"] += [{"id": str(i), "title": "공개 뉴스 " + str(i),
                               "sources": [{"link": "https://example.org/" + str(i)}]} for i in range(7)]
        calls = []
        def fail(batch, key):
            calls.append(len(batch))
            ai_quota.reject(429)
            return {}
        got = enrich(current, before, "test", read=lambda _: "확인된 원문 본문입니다. " * 25,
                     generate=fail, resolve=lambda urls: {u: u for u in urls})
        self.assertEqual(calls, [5])
        self.assertEqual(got["briefs"][0]["summary"], SUMMARY)
        self.assertEqual(got["ai_summary_stats"]["reused"], 1)
        self.assertEqual(got["ai_summary_stats"]["retry_requests"], 0)
        self.assertEqual(got["ai_summary_stats"]["gemini_circuit"], "quota")

    def test_reused_counter_counts_current_matches_only(self):
        previous = news()
        previous["briefs"].append({**previous["briefs"][0], "id": "removed"})
        got = enrich(news(), previous, "")
        self.assertEqual(got["ai_summary_stats"]["reused"], 1)


if __name__ == "__main__":
    unittest.main()
