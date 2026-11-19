#!/usr/bin/env python3
"""Find data.go.kr school-district (학구도) file datasets and their download links. No keys."""
import re
from urllib.request import Request, urlopen
UA={'User-Agent':'Mozilla/5.0 FirstHyundai-SchoolZoneProbe'}
def get(u):
    with urlopen(Request(u,headers=UA),timeout=40) as r: return r.read(2_000_000).decode('utf-8','replace')
for pk in list(range(15159258,15159272))+[15159184]:
    try: html=get(f'https://www.data.go.kr/data/{pk}/fileData.do')
    except Exception as e:
        print('ZONEFILE',pk,'ERR',type(e).__name__); continue
    t=re.search(r'<title>([^<]+)</title>',html); title=t.group(1).strip() if t else ''
    h=re.search(r'class="tit"[^>]*>\s*([^<]{3,80})<',html)
    ids=sorted(set(re.findall(r'atchFileId=([A-Za-z0-9_]+)',html))|set(re.findall(r"atchFileId['\"]?\s*[:=]\s*['\"]([A-Za-z0-9_]+)",html)))
    sn=sorted(set(re.findall(r'fileDetailSn=(\d+)',html)))
    funcs=sorted(set(re.findall(r'(fn_fileDataDown\([^)]{0,120}\)|fileDownload[^"\'\s]{0,140})',html)))[:6]
    ext=sorted(set(re.findall(r'확장자\s*</th>\s*<td[^>]*>\s*([A-Z]{2,5})',html)))
    print('ZONEFILE',pk,'|',title[:70],'|',(h.group(1).strip() if h else ''),'| ext',ext,'| atch',ids[:4],'| sn',sn[:4],'| funcs',funcs)
