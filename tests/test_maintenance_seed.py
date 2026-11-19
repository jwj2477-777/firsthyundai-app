"""Validate the manually verified Songdo K-apt reference snapshots.

These fixtures are public, K-apt-derived historical fee summaries, NOT proof
that the remote monthly collection API succeeds. No invented current-month rows.
"""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
 'f13':'A10026678', 'f14':'A10026681', 'f15':'A10026679',
 'm21':'A10027925', 'm22':'A10027929',
 'avenue':'A10025853', 'skcentral':'A10024573',
 'central3':'A10023434', 'kapt-a10027887':'A10027887'
}

class SeedValidation(unittest.TestCase):
 def test_every_fee_references_a_unique_exact_catalog_code(self):
  catalog={r['id']:r for r in json.loads((ROOT/'data/complexes.json').read_text(encoding='utf8'))['records']}
  data=json.loads((ROOT/'data/maintenance_estimates.json').read_text(encoding='utf8'))
  self.assertEqual(data['schema_version'],1)
  records=data['records']
  ids=[r['complex_id'] for r in records]
  self.assertEqual(len(ids),len(set(ids)))
  self.assertTrue(set(EXPECTED).issubset(set(ids)))
  for r in records:
   self.assertIn(r['complex_id'],catalog)
   self.assertEqual(catalog[r['complex_id']]['kapt_code'],r['kapt_code'])
   self.assertRegex(r['kapt_code'],r'^A[0-9]{8}$')
   self.assertRegex(r['month'],r'^20[0-9]{2}(0[1-9]|1[0-2])$')
   self.assertTrue(300 <= r['won_per_exclusive_m2'] <= 20000)
   self.assertTrue(100000 <= r['monthly_total_won'] <= 200000000000)
   self.assertTrue(r['source_url'].startswith('https://'))
   if 'components_won' in r:
    self.assertEqual(sum(r['components_won'].values()),r['monthly_total_won'])
   months=[h['month'] for h in r.get('monthly_history',[])]
   self.assertEqual(len(months),len(set(months)))
   if months:self.assertEqual(r['month'],max(months))
   for h in r.get('monthly_history',[]):
    self.assertRegex(h['month'],r'^20[0-9]{2}(0[1-9]|1[0-2])$')
    self.assertTrue(h['source_url'].startswith('https://'))
 def test_original_f15_preserved(self):
  data=json.loads((ROOT/'data/maintenance_estimates.json').read_text(encoding='utf8'))
  r=next(x for x in data['records'] if x['complex_id']=='f15')
  # The independently verified 2026-07 seed must survive in the history; newer
  # official months (e.g. 2026-08 after the reserve API fix) may become current.
  history={h['month']:(h['won_per_exclusive_m2'],h['monthly_total_won']) for h in r.get('monthly_history',[])}
  current=(r['won_per_exclusive_m2'],r['monthly_total_won'])
  self.assertEqual(history.get('202607',current if r['month']=='202607' else None),(3831,270762294))
  self.assertGreaterEqual(r['month'],'202607')

if __name__=='__main__':unittest.main()
