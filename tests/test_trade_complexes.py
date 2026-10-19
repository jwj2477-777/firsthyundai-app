"""Regression tests for Songdo apartment crosswalk and trade-only records."""
import importlib.util
from pathlib import Path
import unittest

src = Path(__file__).resolve().parents[1] / 'scripts' / 'sync_trade_complexes.py'
spec = importlib.util.spec_from_file_location('sync_trade_complexes', src)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def fixture():
    # 13 pre-existing curated profiles plus every K-apt source of the vetted aliases.
    rows=[{'id':f'favorite-{i}', 'label':f'기존아파트{i}', 'aliases':[f'기존아파트{i}'],
           'households':500, 'catalog_source':'verified'} for i in range(13)]
    for t in sorted(set(m.ALIASES.values())|set(m.SUBCOMPLEX.values())):
        rows.append({'id':t,'label':'K-apt-'+t,'aliases':['K-apt-'+t],
                     'households':800,'catalog_source':'kapt'})
    trades={'state':'ok','checked_at':'2026-10-19T10:30:00+09:00','records':[
       {'building':'송도LuxeOceanSKVIEW','building_year':'2025'},
       {'building':'송도SKVIEW','building_year':'2019'},
       {'building':'송도푸르지오월드마크2단지','building_year':'2010'},
       {'building':'송도푸르지오월드마크2단지','building_year':'2010'},
       {'building':'더샵엑스포6단지','building_year':'2009'},
       {'building':'K-apt-'+sorted(set(m.ALIASES.values()))[0], 'building_year':'2009'}
    ]}
    return {'schema_version':1,'records':rows},trades

class SyncTest(unittest.TestCase):
    def test_normalize_and_id(self):
        self.assertEqual(m.normalized(' 송도(S K VIEW) '),'송도SKVIEW')
        self.assertRegex(m.trade_id('더샵엑스포6단지'),r'^trade-[0-9a-f]{8}$')
        self.assertNotEqual(m.trade_id('더샵엑스포6단지'),m.trade_id('더샵엑스포9단지'))

    def test_crosswalk_separates_similarly_named_distinct_complexes(self):
        doc,deal=fixture()
        before=len(doc['records'])
        result,added,linked=m.build(doc,deal)
        self.assertEqual(added,2)
        self.assertEqual(linked,2)
        self.assertEqual(len(result['records']),before+2)
        luxe=next(x for x in result['records'] if x['id']=='kapt-a10020744')
        older=next(x for x in result['records'] if x['id']=='kapt-a10025399')
        self.assertIn('송도LuxeOceanSKVIEW',luxe['aliases'])
        self.assertIn('송도SKVIEW',older['aliases'])
        separate=next(x for x in result['records'] if x['label']=='송도푸르지오월드마크2단지')
        self.assertIsNone(separate['households'])
        self.assertIsNone(separate['approved_date'])
        self.assertEqual(separate['observed_trade_count'],2)
        self.assertEqual(separate['observed_building_year'],'2010')
        child=next(x for x in result['records'] if x['label']=='더샵엑스포6단지')
        self.assertEqual(child['parent_catalog_id'],'kapt-a40673901')
        self.assertIsNone(child['households'])
        # Idempotency matters for scheduled recurring syncs.
        final,again,_=m.build(result,deal)
        self.assertEqual(again,0)
        self.assertEqual(len(final['records']),before+2)

    def test_no_false_household_count_when_kapt_parent_is_group(self):
        doc,deal=fixture()
        final,_,_=m.build(doc,deal)
        child=next(x for x in final['records'] if x['label']=='더샵엑스포6단지')
        parent=next(x for x in final['records'] if x['id']=='kapt-a40673901')
        self.assertEqual(parent['households'],800)
        self.assertIsNone(child['households'])

if __name__=='__main__':
    unittest.main()
