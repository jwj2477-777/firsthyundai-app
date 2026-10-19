"""Offline K-apt parser, completeness and no-fabrication tests."""
import importlib.util
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

SRC = Path(__file__).resolve().parents[1] / "scripts" / "collect_complexes.py"
spec = importlib.util.spec_from_file_location("collect_complexes", SRC)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def record(code, name, district="송도동", bjd=c.SONGDO_CODE):
    return {
        "kaptCode": code, "kaptName": name, "bjdCode": bjd,
        "kaptAddr": f"인천광역시 연수구 {district} 123-4",
        "doroJuso": "인천광역시 연수구 아트센터대로 100",
        "kaptdaCnt": "850", "kaptDongCnt": "8",
        "kaptUsedate": "20180123", "codeHeatNm": "지역난방", "kaptTopFloor": "37",
        "kaptBcompany": "테스트건설", "kaptTel": "0328314567",
    }


class KaptTest(unittest.TestCase):
    def test_parse_xml_and_json(self):
        a = c.parse_payload(b'<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><kaptCode>A10012345</kaptCode></item></items></body></response>')
        rows, total = c.unpack(a)
        self.assertEqual(rows[0]["kaptCode"], "A10012345")
        self.assertEqual(total, 1)
        j = c.parse_payload(b'{"response":{"header":{"resultCode":"00"},"body":{"items":{"item":{"kaptCode":"A10012345"}},"totalCount":1}}}')
        self.assertEqual(c.unpack(j), (rows, 1))
        with self.assertRaises(c.PublicApiError):
            c.unpack({"response":{"header":{"resultCode":"30"},"body":{}}})

    def test_normalize_songdo_only(self):
        s = record("A10012345", "송도 테스트")
        self.assertTrue(c.is_songdo(s))
        self.assertFalse(c.is_songdo(record("A10098765", "옆동네", "동춘동", "2818510500")))
        p = c.apt_profile(s, {"kaptdPcnt": 150, "kaptdPcntu": 900, "groundElChargerCnt": 5, "undergroundElChargerCnt": 8}, "2026-10-19")
        self.assertEqual(p["households"], 850)
        self.assertEqual(p["parking_total"], 1050)
        self.assertEqual(p["ev_chargers"], 13)
        self.assertEqual(p["floors"], "최고 37층")
        self.assertEqual(p["approved_date"], "2018-01-23")
        self.assertEqual(p["management_phone"], "032-831-4567")
        self.assertIsNone(p.get("floor_area_ratio"))
        self.assertFalse(p["supply_type_labels"])
        self.assertEqual(p["catalog_source"], "kapt")
        self.assertIsNone(c.apt_profile(record("A10012345", "outside", "동춘동", "2818510500"), {}, "2026-10-19"))

    def test_preserves_13_and_avoids_duplication(self):
        old = [{"id": "f13", "label": "퍼스트파크 13블럭",
                "address": "인천광역시 연수구 아트센터대로 100",
                "aliases": ["더샵 퍼스트 파크 13BL"], "heating": "지역난방"}]
        k = c.apt_profile(record("A10012345", "송도 테스트"), {}, "2026-10-19")
        self.assertEqual(len(c.join_curated(old, [k])), 1)
        k["address"] = "인천광역시 연수구 해돋이로 22"
        self.assertEqual(len(c.join_curated(old, [k])), 2)
        self.assertEqual(c.join_curated(old, [k])[0]["heating"], "지역난방")

    def test_integral_decimal_counts_and_total_household_precedence(self):
        self.assertEqual(c.to_positive_int("1114.0"), 1114)
        self.assertEqual(c.to_positive_int(1114.0), 1114)
        self.assertIsNone(c.to_positive_int("1114.5"))
        self.assertIsNone(c.to_positive_int("unknown"))
        row = record("A10012345", "송도 신축 테스트")
        row["hoCnt"] = "581"
        row["kaptdaCnt"] = 578.0
        p = c.apt_profile(row, {}, "2026-10-19")
        self.assertEqual(p["households"], 581)
        self.assertIn("578세대", p["detail_note"])

    def test_kapt_refresh_preserves_verified_supply_area_pairs(self):
        old={"id":"kapt-a10012345","kapt_code":"A10012345",
             "supply_type_labels":["117A"],"area_types_m2":[84.9],
             "area_type_pairs":[{"exclusive_m2":84.9,"supply_m2":117.09,
                                  "supply_label":"117A","source_url":"https://example.com/"}],
             "area_types_source":"국토교통부 실거래 관측",
             "area_types_observation_count":18}
        refreshed={"id":"kapt-a10012345","kapt_code":"A10012345",
                   "supply_type_labels":[],"area_types_m2":[]}
        got=c.preserve_area_enrichment(refreshed,old)
        for key in c.AREA_ENRICHMENT_FIELDS:
            if key in old:self.assertEqual(got[key],old[key],key)
        self.assertIsNot(got["area_type_pairs"],None)

    def test_unapproved_api_never_returns_fake_data(self):
        def fake(req):
            args = parse_qs(urlsplit(req.full_url).query)
            if "getSigunguAptList4" in req.full_url:
                return b'{"response":{"header":{"resultCode":"30","resultMsg":"DENIED"}}}'
            self.fail("No detail calls should run after access denied")
        with self.assertRaisesRegex(c.PublicApiError, "30"):
            c.collect([], "fake-test-key", session=fake, wait=0)

    def test_pipeline(self):
        names = ["송도 시험1", "송도 시험2"]
        def fake(req):
            parts = urlsplit(req.full_url)
            args = parse_qs(parts.query)
            if "getSigunguAptList4" in parts.path:
                return b'{"response":{"header":{"resultCode":"00"},"body":{"totalCount":3,"items":{"item":[{"kaptCode":"A10012345"},{"kaptCode":"A10012346"},{"kaptCode":"A10012347"}]}}}}'
            code = args["kaptCode"][0]
            if "BassInfo" in parts.path:
                if code == "A10012347":
                    obj = record(code, "동춘 시험", "동춘동", "2818510500")
                else:
                    obj = record(code, names[int(code[-1]) - 5])
                import json
                return json.dumps({"response":{"header":{"resultCode":"00"},"body":{"item":obj}}}, ensure_ascii=False).encode()
            if "DtlInfo" in parts.path:
                return b'{"response":{"header":{"resultCode":"00"},"body":{"item":{"kaptdPcnt":100,"kaptdPcntu":400}}}}'
            self.fail(parts.path)
        old = [{"id":"f13","label":"퍼스트파크 13블럭","aliases":[]}]
        result, total, failures = c.collect(old, "fixture-key", session=fake, wait=0)
        self.assertEqual((len(result),total,failures),(3,2,0))
        self.assertEqual(result[0],old[0])
        self.assertEqual(len([r for r in result if r.get("catalog_source")=="kapt"]),2)


if __name__ == "__main__":
    unittest.main()
