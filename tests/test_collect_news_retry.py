"""v2.2.11: Google News sometimes answers 503 to every feed for a few minutes."""
import sys, tempfile, unittest
from datetime import datetime
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect_news  # noqa: E402

RSS = """<?xml version="1.0"?><rss><channel><item><title>송도 가상 아파트 입주 소식 - 가상일보</title>
<link>https://news.google.com/x</link><pubDate>{date}</pubDate><source url="https://example.com">가상일보</source></item></channel></rss>"""


class NewsRetry(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = mock.patch.object(collect_news, 'OUTPUT', Path(self.tmp.name) / 'news.json')
        self.out.start()
        self.now = datetime(2026, 11, 22, 10, 0, tzinfo=collect_news.KST)

    def tearDown(self):
        self.out.stop(); self.tmp.cleanup()

    def unavailable(self, url):
        raise HTTPError(url, 503, 'Service Unavailable', None, None)

    def test_retries_once_when_every_feed_fails(self):
        calls = {'n': 0}; first_pass = sum(len(q) for q in collect_news.TOPICS.values())
        date = 'Sun, 22 Nov 2026 00:00:00 GMT'
        def request(url):
            calls['n'] += 1
            if calls['n'] <= first_pass:
                self.unavailable(url)
            return RSS.format(date=date).encode()
        pauses = []
        out = collect_news.update(request=request, now=self.now, sleep=pauses.append)
        self.assertEqual(pauses, [collect_news.ALL_FAILED_RETRY_PAUSE])
        self.assertEqual(out['errors'], [])
        self.assertEqual(calls['n'], first_pass * 2)

    def test_still_failing_keeps_old_news(self):
        pauses = []
        with self.assertRaises(RuntimeError):
            collect_news.update(request=self.unavailable, now=self.now, sleep=pauses.append)
        self.assertEqual(len(pauses), 1)
        self.assertFalse((Path(self.tmp.name) / 'news.json').exists())

    def test_partial_failure_does_not_wait(self):
        date = 'Sun, 22 Nov 2026 00:00:00 GMT'; seen = {'n': 0}
        def request(url):
            seen['n'] += 1
            if seen['n'] == 1:
                self.unavailable(url)
            return RSS.format(date=date).encode()
        pauses = []
        out = collect_news.update(request=request, now=self.now, sleep=pauses.append)
        self.assertEqual(pauses, [])
        self.assertEqual(out['state'], 'partial')


if __name__ == '__main__':
    unittest.main()
