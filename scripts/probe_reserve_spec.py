#!/usr/bin/env python3
"""Read the public data.go.kr page of the K-apt reserve API and list its operations."""
import re, sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

UA = {'User-Agent': 'Mozilla/5.0 FirstHyundai-SpecProbe'}
def get(url, data=None):
    req = Request(url, data=urlencode(data).encode() if data else None, headers=UA)
    with urlopen(req, timeout=30) as r:
        return r.read(3_000_000).decode('utf-8', 'replace')

page = get('https://www.data.go.kr/data/15059160/openapi.do')
print('SPEC page bytes', len(page))
print('SPEC getHsmp names', sorted(set(re.findall(r'getHsmp[A-Za-z0-9]+', page))))
seqs = sorted(set(re.findall(r"oprtinSeqNo['\"]?\s*[:=,]\s*['\"]?(\d{4,})", page)) | set(re.findall(r"fn_detailFunction\(\s*'?(\d{4,})", page)))
print('SPEC seqs', seqs[:20])
for m in re.finditer(r'<option[^>]*value="(\d+)"[^>]*>([^<]{2,80})</option>', page):
    print('SPEC option', m.group(1), re.sub(r'\s+', ' ', m.group(2)).strip())
pk = re.search(r'publicDataPk["\']?\s*[:=]\s*["\']?(\d+)', page)
print('SPEC pk', pk.group(1) if pk else None)
for seq in seqs[:8]:
    for url in ('https://www.data.go.kr/tcs/dss/selectApiDetailFunction.do',):
        try:
            body = get(url, {'oprtinSeqNo': seq, 'publicDataPk': '15059160', 'publicDataDetailPk': 'uddi:'})
        except Exception as e:
            print('SPEC detail', seq, 'ERR', type(e).__name__); continue
        text = re.sub(r'<[^>]+>', ' ', body); text = re.sub(r'\s+', ' ', text)
        names = sorted(set(re.findall(r'getHsmp[A-Za-z0-9]+', body)))
        print('SPEC detail', seq, names, text[:1500])
