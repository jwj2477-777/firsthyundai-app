#!/usr/bin/env python3
"""Diagnose the K-apt long-term repair reserve API (AptRepairsCostServiceV3).

Public apartment-level fee data only. The service key is never printed: any
response text is scrubbed of the key before a short excerpt is shown.
"""
import json, os, re, sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

sys.path.insert(0, os.path.dirname(__file__))
from collect_complexes import key_normalize
RAW = os.environ.get('DATA_GO_KR_SERVICE_KEY', '').strip()
KEY = key_normalize(RAW) if RAW else ''
BASE = 'https://apis.data.go.kr/1613000/AptRepairsCostServiceV3/'
OPS = ['getHsmpMonthRetalFeeInfoV3', 'getHsmpMonthChargeAmtInfoV3']
CODES = {'F15': 'A10026679'}
MONTHS = ['202607', '202606', '202604', '202601', '202512']

def scrub(text):
    for secret in {KEY, RAW}:
        if secret:
            text = text.replace(secret, '[KEY]')
    return re.sub(r'serviceKey=[^&\s"]+', 'serviceKey=[KEY]', text)

def call(op, params):
    url = BASE + op + '?' + urlencode({'serviceKey': KEY, **params})
    req = Request(url, headers={'User-Agent': 'FirstHyundai-Probe/1.0', 'Accept': 'application/json, application/xml'})
    try:
        with urlopen(req, timeout=30) as r:
            return r.status, r.read(200000).decode('utf-8', 'replace')
    except HTTPError as e:
        return e.code, e.read(4000).decode('utf-8', 'replace')
    except (URLError, TimeoutError) as e:
        return 0, type(e).__name__

def summarize(body):
    try:
        data = json.loads(body)
    except Exception:
        return 'non-json: ' + scrub(re.sub(r'\s+', ' ', body))[:300]
    out = []
    def walk(x, path=''):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(v, path + '.' + k if path else k)
        elif isinstance(x, list):
            for i, v in enumerate(x[:3]):
                walk(v, path + '[' + str(i) + ']')
        else:
            out.append(path + '=' + scrub(str(x))[:60])
    walk(data)
    return ' | '.join(out)[:1500]

if not KEY:
    print('NO_KEY'); sys.exit(1)
for op in OPS:
    for name, code in CODES.items():
        for month in MONTHS:
            for variant in ({'kaptCode': code, 'searchDate': month},
                            {'kaptCode': code, 'searchDate': month, '_type': 'json'},
                            {'kaptCode': code, 'searchDate': month, 'dataType': 'JSON'}):
                status, body = call(op, variant)
                keys = ','.join(k for k in variant if k != 'kaptCode')
                print('RESERVE', op, name, month, keys, 'HTTP', status, '::', summarize(body), flush=True)
