"""Original-precision 학구도 builder: geometry encoding, ring grouping, sanity gates (no network)."""
import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('zone_files', ROOT / 'scripts' / 'collect_school_zone_files.py')
zf = importlib.util.module_from_spec(spec); spec.loader.exec_module(zf)
spec2 = importlib.util.spec_from_file_location('schoolinfo', ROOT / 'scripts' / 'collect_schoolinfo.py')
si = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(si)

SQUARE_CW = [(126.640, 37.390), (126.640, 37.400), (126.650, 37.400), (126.650, 37.390), (126.640, 37.390)]
HOLE_CCW = [(126.644, 37.394), (126.646, 37.394), (126.646, 37.396), (126.644, 37.396), (126.644, 37.394)]
LINK = ('학구ID,학교ID,학교명,학교급구분\n'
        'Z000106155,B1,인천예송초등학교,초등학교\nZ000101206,B2,인천송일초등학교,초등학교\n'
        'Z000101210,B3,인천신정초등학교,초등학교\nZ000150065,B4,인천명선초등학교,초등학교\n'
        'Z000150065,B5,인천연송초등학교,초등학교\nZ000200101,B6,인천예송중학교,중학교\n'
        'Z000200101,B7,연수중학교,중학교\n').encode('cp949')


def shape(*rings):
    pts, parts = [], []
    for r in rings:
        parts.append(len(pts)); pts.extend(r)
    lons = [p[0] for p in pts]; lats = [p[1] for p in pts]
    return SimpleNamespace(points=pts, parts=parts, bbox=(min(lons), min(lats), max(lons), max(lats)))


def ident(x, y):
    return (x, y)


class ZoneFiles(unittest.TestCase):
    def test_encode_round_trips_with_matcher_decoder(self):
        ring = [(126.6412345, 37.3912345), (126.64, 37.40), (126.65, 37.40), (126.6412345, 37.3912345)]
        decoded = si.decode_ring(zf.encode(ring))
        for (a, b), (c, d) in zip(ring, decoded):
            self.assertLess(abs(a - c), 1e-5); self.assertLess(abs(b - d), 1e-5)

    def test_clockwise_outer_and_counterclockwise_hole(self):
        polys = zf.polygons(shape(SQUARE_CW, HOLE_CCW), ident)
        self.assertEqual(len(polys), 1); self.assertEqual(len(polys[0]), 2)
        zones = [{'id': 'Z000000001', 'name': 'x통학구역', 'kind': '0',
                  'rings': [[zf.encode(r) for r in p] for p in polys]}]
        self.assertEqual(len(si.zone_matches(zones, 126.6420, 37.3920)), 1)
        self.assertEqual(si.zone_matches(zones, 126.6450, 37.3950), [], 'Point in a hole is outside')

    def test_links_by_level(self):
        links = zf.school_links(LINK)
        self.assertIn(('인천예송중학교', '중학교'), links['Z000200101'])
        with self.assertRaises(RuntimeError):
            zf.school_links('a,b,c\n'.encode('cp949'))

    def _fake(self, elementary, middle):
        def reader(raw):
            return iter(elementary if raw == b'E' else middle)
        return reader

    def rec(self, zid, name, kind='0', sgg='185', date='2026-09-20'):
        return {'HAKGUDO_ID': zid, 'HAKGUDO_NM': name, 'HAKGUDO_GB': kind, 'SD_CD': '28', 'SGG_CD': sgg, 'BASE_DT': date}

    def test_build_filters_yeonsu_and_attaches_school_names(self):
        sq = shape(SQUARE_CW)
        names = ['인천예송초통학구역', '인천송일초통학구역', '인천신정초통학구역'] + ['인천기타%02d초통학구역' % i for i in range(20)]
        ids = ['Z000106155', 'Z000101206', 'Z000101210'] + ['Z0001%05d' % i for i in range(20)]
        elementary = [(self.rec(i, n), sq, ident) for i, n in zip(ids, names)]
        elementary.append((self.rec('Z000150065', '인천명선초인천연송초공동통학구역', '1'), sq, ident))
        elementary.append((self.rec('Z000199999', '인천남동초통학구역', sgg='200'), sq, ident))  # other district
        middle = [(self.rec('Z000200101', '7학교군'), sq, ident),
                  ({**self.rec('Z000200411', '정왕중학군'), 'SD_CD': '41'}, sq, ident)]  # Gyeonggi
        original = zf.read_shp
        zf.read_shp = self._fake(elementary, middle)
        try:
            zdoc, mdoc = zf.build(b'E', b'M', LINK)
        finally:
            zf.read_shp = original
        self.assertEqual(zdoc['precision'], 'original'); self.assertEqual(zdoc['reference_date'], '2026-09-20')
        self.assertEqual(len(zdoc['zones']), 24)
        byname = {z['name']: z for z in zdoc['zones']}
        self.assertEqual(byname['인천예송초통학구역']['schools'], ['인천예송초등학교'])
        self.assertEqual(byname['인천명선초인천연송초공동통학구역']['schools'], ['인천명선초등학교', '인천연송초등학교'])
        self.assertNotIn('인천남동초통학구역', byname)
        self.assertEqual([g['name'] for g in mdoc['groups']], ['7학교군'])
        self.assertEqual(mdoc['groups'][0]['schools'], ['연수중학교', '인천예송중학교'])

    def test_build_refuses_incomplete_or_mixed_releases(self):
        sq = shape(SQUARE_CW)
        few = [(self.rec('Z000106155', '인천예송초통학구역'), sq, ident)]
        mid = [(self.rec('Z000200101', '7학교군'), sq, ident)]
        original = zf.read_shp
        zf.read_shp = self._fake(few, mid)
        try:
            with self.assertRaises(RuntimeError):
                zf.build(b'E', b'M', LINK)
        finally:
            zf.read_shp = original

    def test_matcher_uses_precision_aware_clearance(self):
        self.assertEqual(si.required_clearance({'precision': 'original'}), 10)
        self.assertEqual(si.required_clearance({'simplified_degrees': 0.0001}), 35)
        zones = [{'id': 'Z000106155', 'name': '인천예송초통학구역', 'kind': '0', 'schools': ['인천예송초등학교'],
                  'rings': [[zf.encode(SQUARE_CW)]]}]
        # ~22 m inside the west edge: rejected with the legacy 35 m margin, accepted at 10 m.
        point = [{'id': 'c1', 'lng': 126.64025, 'lat': 37.395}]
        self.assertEqual(si.build_assignments(zones, point, 35), [])
        rows = si.build_assignments(zones, point, 10, '2026-09-20')
        self.assertEqual(rows[0]['schools'], ['인천예송초등학교'])
        self.assertEqual(rows[0]['min_required_clearance_m'], 10)
        groups = [{'id': 'Z000200101', 'name': '7학교군', 'kind': '0', 'schools': ['연수중학교'],
                   'rings': [[zf.encode(SQUARE_CW)]]}]
        mrows = si.build_middle_groups(groups, point, 10, '2026-09-20')
        self.assertEqual(mrows[0]['group_name'], '7학교군'); self.assertEqual(mrows[0]['kind'], 'middle_school_group')

    def test_joint_zone_lists_choices_instead_of_one_school(self):
        zones = [{'id': 'Z000150065', 'name': '인천명선초인천연송초공동통학구역', 'kind': '1',
                  'schools': ['인천명선초등학교', '인천연송초등학교'], 'rings': [[zf.encode(SQUARE_CW)]]}]
        point = [{'id': 'c2', 'lng': 126.645, 'lat': 37.395}]
        self.assertEqual(si.build_assignments(zones, point, 10), [])
        review = si.review_unmatched_zones(zones, point, [{'id': 'c2'}], [], 10, '2026-09-20')
        self.assertEqual(review[0]['reason'], 'joint_zone')
        self.assertEqual(review[0]['schools'], ['인천명선초등학교', '인천연송초등학교'])


if __name__ == '__main__':
    unittest.main()
