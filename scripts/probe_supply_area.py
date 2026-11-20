#!/usr/bin/env python3
"""Can official 건축물대장 전유공용면적 give 공급면적 per exclusive type? Prints only
aggregated area facts (no 동/호, no owners). Key never printed."""
import collections, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from collect_complexes import key_normalize, call_api, unpack
from collect_registry_maintenance import fetch_basic, match_lot
KEY = key_normalize(os.environ['DATA_GO_KR_SERVICE_KEY'].strip())
URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo'
for name, code in (('F15', 'A10026679'), ('M21', 'A10027925'), ('CPP', 'A10027887')):
    try:
        basic = fetch_basic(KEY, code); lot = match_lot(basic.get('kaptAddr'))
        print('SUPPLY', name, 'lot', lot)
        rows, total, page = [], None, 1
        while page <= 80:
            rsp = call_api(URL, {'sigunguCd': '28185', 'bjdongCd': '10600', 'platGbCd': '0', 'bun': lot[0], 'ji': lot[1],
                                 'numOfRows': '100', 'pageNo': str(page), '_type': 'json'}, KEY)
            got, total = unpack(rsp)
            rows += got
            if not got or (total is not None and len(rows) >= total): break
            page += 1
        print('SUPPLY', name, 'rows', len(rows), 'total', total, 'pages', page)
        if rows: print('SUPPLY', name, 'fields', sorted(rows[0].keys()))
        kinds = collections.Counter((str(r.get('exposPubuseGbCdNm')), str(r.get('mainPurpsCdNm'))[:12], str(r.get('etcPurps'))[:16]) for r in rows)
        print('SUPPLY', name, 'kinds', kinds.most_common(14))
        units = collections.defaultdict(lambda: {'ex': 0.0, 'pub': collections.Counter()})
        for r in rows:
            k = (r.get('dongNm'), r.get('hoNm'))
            a = float(r.get('area') or 0)
            if str(r.get('exposPubuseGbCdNm')) == '전유': units[k]['ex'] += a
            else: units[k]['pub'][str(r.get('etcPurps'))[:14]] += a
        by_ex = collections.defaultdict(list)
        for u in units.values():
            if u['ex'] > 0: by_ex[round(u['ex'], 2)].append(u['pub'])
        for ex, pubs in sorted(by_ex.items())[:12]:
            totals = collections.Counter(round(sum(p.values()), 2) for p in pubs)
            sample = pubs[0]
            print('SUPPLY', name, 'excl', ex, 'units', len(pubs), 'common_total_variants', totals.most_common(3), 'items', [(k, round(v, 2)) for k, v in sample.most_common(8)])
    except Exception as e:
        print('SUPPLY', name, 'ERROR', type(e).__name__, str(e).replace(KEY, '[KEY]')[:160])
