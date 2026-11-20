#!/usr/bin/env python3
"""Run only the F15 benchmark of the official fee collector and say why it fails. Key never printed."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import collect_official_maintenance as m
from collect_complexes import key_normalize, PublicApiError
KEY = key_normalize(os.environ['DATA_GO_KR_SERVICE_KEY'].strip())
for group, (service, ops) in m.GROUPS.items():
    for op in ops:
        try:
            rsp = m.call_api(m.BASE + service + '/' + op, {'kaptCode': m.F15, 'searchDate': m.CALIBRATION_MONTH, 'dataType': 'JSON'}, KEY)
            rows, total = m.unpack(rsp)
            amt = m.extract_amount(rows, m.F15, m.CALIBRATION_MONTH)
            flag = '' if amt is not None or not rows else ' <-- refused'
            print('CALIB', group, op.replace('getHsmp', '').replace('InfoV3', ''), 'rows', len(rows), 'total', total, 'amount', amt, flag)
        except Exception as e:
            print('CALIB', group, op, 'ERROR', type(e).__name__, str(e).replace(KEY, '[KEY]')[:160])
try:
    base = m.fetch_basic(KEY, m.F15); print('CALIB area', base.get('privArea'))
except Exception as e:
    print('CALIB basic ERROR', type(e).__name__, str(e).replace(KEY, '[KEY]')[:160])
totals = m.fetch_groups(m.F15, m.CALIBRATION_MONTH, KEY)
print('CALIB fetch_groups', totals, 'passes', m.calibration_passes(totals, '70685.27'))
