#!/usr/bin/env python3
"""Download data.go.kr school-district (학구도) files and describe them. No keys, no personal data."""
import io, json, re, zipfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
UA={'User-Agent':'Mozilla/5.0 FirstHyundai-SchoolZoneProbe','Referer':'https://www.data.go.kr/'}
def get(u, raw=False, limit=300_000_000):
    with urlopen(Request(u,headers=UA),timeout=120) as r:
        b=r.read(limit); return (b, r.headers.get('Content-Type','')) if raw else b.decode('utf-8','replace')
page=get('https://www.data.go.kr/data/15159265/fileData.do')
i=page.find('function fn_fileDataDown')
print('ZJS', re.sub(r'\s+',' ',page[i:i+1500]) if i>=0 else 'function not inline')
for src in sorted(set(re.findall(r'<script[^>]+src="([^"]+)"',page)))[:40]:
    if 'fileData' in src or 'dss' in src or 'common' in src: print('ZSCRIPT',src)
DATASETS={'elementary':('15159265','uddi:fe8b71fa-5321-4d89-b6bb-a9a6ddd2fa8c'),
          'middle':('15159264','uddi:0dae54bb-7464-4e01-9d82-c4b901686200'),
          'link':('15159266','uddi:0765351b-d4d6-4ca3-85fa-e4e01dbb7963')}
for name,(pk,uddi) in DATASETS.items():
    q=urlencode({'recommendDataYn':'','publicDataPk':pk,'publicDataDetailPk':uddi,'fileDetailSn':'1'})
    try:
        meta=get('https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?'+q)
        print('ZMETA',name,meta[:400])
        m=json.loads(meta)
        atch=m.get('atchFileId') or (m.get('fileDataRegistVO') or {}).get('atchFileId')
        sn=str(m.get('fileDetailSn') or (m.get('fileDataRegistVO') or {}).get('fileDetailSn') or '1')
        data,ctype=get('https://www.data.go.kr/cmm/cmm/fileDownload.do?'+urlencode({'atchFileId':atch,'fileDetailSn':sn}),raw=True)
        print('ZDOWN',name,len(data),ctype,data[:4])
        z=zipfile.ZipFile(io.BytesIO(data))
        for info in z.infolist()[:40]: print('ZENTRY',name,info.filename.encode('cp437','replace').decode('cp949','replace') if info.flag_bits & 0x800 == 0 else info.filename,info.file_size)
    except Exception as e:
        print('ZERR',name,type(e).__name__,str(e)[:200])
