#!/usr/bin/env python3
"""Why do some favorite complexes get no official fee total? Public apartment-level data only; key never printed."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import collect_official_maintenance as m
from collect_complexes import key_normalize, PublicApiError
KEY = key_normalize(os.environ['DATA_GO_KR_SERVICE_KEY'].strip())
catalog = json.load(open(m.CATALOG, encoding='utf-8'))['records'] if hasattr(m, 'CATALOG') else []
for code in ('A10027930', 'A10023207'):
    try:
        basic = m.fetch_basic(KEY, code)
        print('FEEGAP', code, 'basic', basic.get('kaptName'), 'privArea', basic.get('privArea'), 'kaptCode', basic.get('kaptCode'))
    except Exception as e:
        print('FEEGAP', code, 'basic ERR', type(e).__name__, str(e)[:120]); continue
    try:
        matches = m.upsert_complex_targets(catalog, basic) if catalog else 'no-catalog'
        print('FEEGAP', code, 'catalog matches', [p.get('id') for p in matches] if isinstance(matches, list) else matches)
    except Exception as e:
        print('FEEGAP', code, 'match ERR', type(e).__name__, str(e)[:120])
    for month in m.available_months()[:3]:
        for group, (service, ops) in m.GROUPS.items():
            got, unknown = [], set()
            for op in ops:
                try:
                    rsp = m.call_api(m.BASE + service + '/' + op, {'kaptCode': code, 'searchDate': month, 'dataType': 'JSON'}, KEY)
                    rows, total = m.unpack(rsp)
                    amt = m.extract_amount(rows, code, month)
                    if amt is None and rows:
                        for row in rows:
                            for k, v in row.items():
                                n = m.number(v)
                                if n is not None and n != 0 and k not in m.KNOWN_FEE_FIELDS and not m.FINANCIAL.search(k) and not m.DATE_KEYS.search(k):
                                    unknown.add(k)
                    got.append((op.replace('getHsmp', '').replace('InfoV3', '').replace('V3', ''), len(rows), amt))
                except Exception as e:
                    got.append((op, 'ERR', type(e).__name__))
            ok = [g for g in got if isinstance(g[2], int)]
            print('FEEGAP', code, month, group, 'ok', len(ok), '/', len(ops), 'sum', sum(g[2] for g in ok), 'unknown', sorted(unknown), 'none', [g[0] for g in got if g[2] is None][:8])
