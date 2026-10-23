"""Monthly fee history must survive failures and must never invent months."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from maintenance_history import merge_record, merge_records, valid_month_row


def fee(month, rate, total=270762294, **extras):
    return dict(complex_id="f15", kapt_code="A10026679", month=month,
                won_per_exclusive_m2=rate, monthly_total_won=total,
                source_url="https://www.k-apt.go.kr/", **extras)


class History(unittest.TestCase):
    def test_keeps_two_distinct_months_newest_first(self):
        old = fee("202607", 3831)
        new = fee("202608", 4190, total=300000000)
        merged = merge_record(old, new)
        self.assertEqual([x["month"] for x in merged["monthly_history"]],
                         ["202608", "202607"])
        self.assertEqual(merged["month"], "202608")
        self.assertEqual(merged["won_per_exclusive_m2"], 4190)

    def test_same_month_correction_not_duplicate(self):
        old = fee("202607", 3831)
        changed = merge_record(old, fee("202607", 3890))
        self.assertEqual(len(changed["monthly_history"]), 1)
        self.assertEqual(changed["monthly_history"][0]["won_per_exclusive_m2"], 3890)

    def test_validation_never_promotes_partial_fee(self):
        good = fee("202607", 3831)
        with self.assertRaises(ValueError):
            merge_record(good, dict(good, month="202608", monthly_total_won=None))
        with self.assertRaises(ValueError):
            merge_record(good, dict(good, month="202608",
                                    components_won=dict(common=10, individual=20, reserve=40)))
        with self.assertRaises(ValueError):
            merge_record(good, dict(good, month="202608", kapt_code="A10020000"))
        self.assertFalse(valid_month_row(dict(good, month="202613")))

    def test_old_history_survives_newer_month_data_and_limits_to_24(self):
        prior = fee("202607", 3831)
        for i in range(25):
            year, month = divmod(2026 * 12 + 7 + i, 12)
            prior = merge_record(prior, fee(f"{year:04d}{month+1:02d}", 3800+i))
        self.assertEqual(len(prior["monthly_history"]), 24)

    def test_distinct_complexes_not_mixed(self):
        other = dict(fee("202607", 5000), complex_id="m21", kapt_code="A12345678")
        merged = merge_records([fee("202607", 3831), other],
                               [fee("202608", 3900)])
        self.assertEqual(len(merged), 2)
        self.assertEqual(next(x for x in merged if x["complex_id"]=="m21")["month"], "202607")


if __name__ == "__main__":
    unittest.main()
