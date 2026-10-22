"""Regression for official 2026-10 school-location CSV snapshot and converter."""
import csv,importlib.util,json,sys,tempfile,unittest
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
spec=importlib.util.spec_from_file_location('import_school_csv',root/'scripts'/'import_school_locations_csv.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def snapshot():
    return json.loads((root/'data'/'public_services.json').read_text(encoding='utf8'))
class OfficialSchoolCSVTests(unittest.TestCase):
    def test_published_31_actual_verified_school_locations(self):
        data=snapshot()['school_locations']
        self.assertEqual(data['state'],'verified')
        self.assertEqual(data['import_method'],'official_csv')
        self.assertEqual(data['reference_date'],'2026-10-01')
        rows=data['records']
        self.assertEqual(len(rows),31)
        self.assertEqual({kind:sum(x['level']==kind for x in rows) for kind in mod.LEVELS},
                         {'초등학교':16,'중학교':9,'고등학교':6})
        self.assertEqual(len({x['code'] for x in rows}),31)
        self.assertEqual(len({x['name'] for x in rows}),31)
        names={x['name'] for x in rows}
        self.assertTrue({'인천송일초등학교','인천해송초등학교','신송중학교','인천포스코고등학교'}.issubset(names))
        for r in rows:
            self.assertRegex(r['code'],r'^B\d{9,12}$')
            self.assertTrue(r['address'].startswith('인천광역시 연수구 '))
            self.assertTrue(37.2<r['lat']<37.6 and 126.3<r['lng']<127)
            self.assertEqual(r['reference_date'],'2026-10-01')
            self.assertEqual(r['source_url'],mod.SOURCE)
            self.assertNotIn('assigned',r)
        self.assertNotIn('NEIS_EDU_KEY',json.dumps(rows,ensure_ascii=False))
    def test_csv_can_be_reimported_safely_and_preserve_other_sections(self):
        saved=snapshot()
        with tempfile.TemporaryDirectory() as d:
            csvpath=Path(d)/'official.csv';out=Path(d)/'snapshot.json'
            cols=['학교ID','학교명','학교급구분','운영상태','소재지지번주소',
                  '소재지도로명주소','위도','경도','데이터기준일자']
            with csvpath.open('w',encoding='utf-8-sig',newline='') as f:
                writer=csv.DictWriter(f,fieldnames=cols)
                writer.writeheader()
                for row in saved['school_locations']['records']:
                    writer.writerow({
                      '학교ID':row['code'],'학교명':row['name'],
                      '학교급구분':row['level'],'운영상태':'운영',
                      '소재지지번주소':'인천광역시 연수구 송도동 100',
                      '소재지도로명주소':row['address'],
                      '위도':row['lat'],'경도':row['lng'],
                      '데이터기준일자':row['reference_date']
                    })
            out.write_text(json.dumps(saved,ensure_ascii=False),encoding='utf8')
            self.assertEqual(mod.update_snapshot(csvpath,out),31)
            reread=json.loads(out.read_text(encoding='utf8'))
            self.assertEqual({x['code'] for x in reread['school_locations']['records']},
                             {x['code'] for x in saved['school_locations']['records']})
            for section in ('schools','school_zones','subscriptions','office_rents','building_registry','maintenance'):
                self.assertEqual(reread.get(section),saved.get(section))
            # Never publish a truncated nationwide CSV.
            old=out.read_bytes()
            csvpath.write_text('학교ID,학교명\nB000123456,broken\n',encoding='utf-8-sig')
            with self.assertRaises(RuntimeError):mod.update_snapshot(csvpath,out)
            self.assertEqual(old,out.read_bytes())
if __name__=='__main__':unittest.main()
