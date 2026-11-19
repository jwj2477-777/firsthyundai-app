"""trades.json must stay compact: the Android app rejects public feeds above 8 MiB."""
import importlib.util, json, pathlib, unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('collect_trades', ROOT / 'scripts' / 'collect_trades.py')
collect = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collect)


class CompactFeedTest(unittest.TestCase):
    def test_round_trip_and_one_record_per_line(self):
        payload = {'schema_version': 1, 'state': 'ok', 'errors': [],
                   'records': [{'id': 'a', 'building': '가상단지', 'amount_10k': 1},
                               {'id': 'b', 'building': '테스트', 'amount_10k': 2}]}
        text = collect.compact_feed(payload)
        self.assertEqual(json.loads(text), payload)
        self.assertEqual(text.count('\n'), 4)
        self.assertNotIn('  ', text)

    def test_empty_records(self):
        self.assertEqual(json.loads(collect.compact_feed({'records': []})), {'records': []})

    def test_published_snapshot_has_headroom(self):
        size = (ROOT / 'data' / 'trades.json').stat().st_size
        self.assertLess(size, 7 * 1024 * 1024, 'trades.json is close to the 8 MiB app limit')


if __name__ == '__main__':
    unittest.main()
