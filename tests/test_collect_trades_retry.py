"""Trade collector retries network blips, never key/permission errors (2026-11-22).

Before: one URLError (e.g. 202605:매매) marked every run "partial", so the 실거래
screen always showed "일부 수집 실패: 최신성 주의" although no month was missing.
"""
import sys
import unittest
from pathlib import Path
from urllib.error import URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect_trades as ct  # noqa: E402


class RetryTest(unittest.TestCase):
    def setUp(self):
        self.original = ct.fetch_month
        self.sleeps = []

    def tearDown(self):
        ct.fetch_month = self.original

    def fake(self, failures, error):
        calls = {'n': 0}

        def fetch(request, category, month, key):
            calls['n'] += 1
            if calls['n'] <= failures:
                raise error
            return [{'ok': month}]
        ct.fetch_month = fetch
        return calls

    def test_network_blip_is_retried(self):
        calls = self.fake(2, URLError('reset'))
        out = ct.fetch_with_retry(None, '매매', '202605', 'k', pauses=(0, 0), sleep=self.sleeps.append)
        self.assertEqual(out, [{'ok': '202605'}])
        self.assertEqual(calls['n'], 3)
        self.assertEqual(len(self.sleeps), 2)

    def test_timeout_after_retries_still_fails(self):
        calls = self.fake(5, TimeoutError())
        with self.assertRaises(TimeoutError):
            ct.fetch_with_retry(None, '임대', '202604', 'k', pauses=(0, 0), sleep=self.sleeps.append)
        self.assertEqual(calls['n'], ct.TRANSIENT_RETRIES + 1)

    def test_key_and_api_errors_are_not_retried(self):
        for error in (RuntimeError('API HTTP 403 (SERVICE_ACCESS_DENIED_ERROR)'),
                      RuntimeError('매매 202605 최대 페이지 초과: 잘린 자료를 게시하지 않습니다')):
            calls = self.fake(1, error)
            with self.assertRaises(RuntimeError):
                ct.fetch_with_retry(None, '매매', '202605', 'k', pauses=(0, 0), sleep=self.sleeps.append)
            self.assertEqual(calls['n'], 1)
        self.assertEqual(self.sleeps, [])


if __name__ == '__main__':
    unittest.main()
