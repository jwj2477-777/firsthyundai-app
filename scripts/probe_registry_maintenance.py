#!/usr/bin/env python3
"""One-time sanitized shape probe of separately approved registry and K-apt fee APIs.
No credentials, response bodies or full request URLs are ever printed."""
import os,re,json,sys
from pathlib import Path
from urllib.parse import urlencode,unquote
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from xml.etree import ElementTree as ET
sys.path.insert(0,str(Path(__file__).resolve().parent))
from collect_complexes import parse_payload,unpack

BASE='https://apis.data.go.kr/1613000/'
KEY=os.getenv('DATA_GO_KR_SERVICE_KEY','').strip()
if not KEY:raise SystemExit('No GitHub secret configured')
KEY=unquote(KEY)

def probe(label,path,args):
  print('PROBE',label,flush=True)
  url=BASE+path+'?'+urlencode(dict(serviceKey=KEY,**args))
  request=Request(url,headers={'User-Agent':'FirstHyundai-Probe/1.0','Accept':'application/json, application/xml'})
  try:
    with urlopen(request,timeout=24) as x:
      raw=x.read(300000)
  except HTTPError as e:
    print('HTTP_STATUS',e.code,flush=True);return None
  except (URLError,TimeoutError):
    print('NETWORK_ERROR',flush=True);return None
  try:
    obj=parse_payload(raw)
    print('TOPLEVEL_KEYS',sorted(obj.keys())[:24] if isinstance(obj,dict) else type(obj).__name__,flush=True)
    if isinstance(obj,dict):
      env=obj.get('response',obj)
      if isinstance(env,dict):
        h=env.get('header') or {}
        print('RESULT_CODE',str(h.get('resultCode',''))[:15],flush=True)
    rows,total=unpack(obj)
    print('RESULT_ROWS',len(rows),'TOTAL',total,flush=True)
    if rows:print('FIELD_NAMES',sorted(rows[0].keys())[:90],flush=True)
    return rows[0] if rows else None
  except Exception:
    print('UNEXPECTED_RESPONSE_FORMAT',flush=True)
    return None

sample=probe('kapt-basic','AptBasisInfoServiceV5/getAphusBassInfoV5',
  {'kaptCode':'A10020270','dataType':'JSON'})
for date in ('202608','2026-08'):
  probe('maintenance-labor-'+date,'AptCmnuseManageCostServiceV3/getHsmpLaborCostInfoV3',
   {'kaptCode':'A10020270','searchDate':date,'dataType':'JSON'})
if isinstance(sample,dict):
  address=str(sample.get('kaptAddr') or '')
  match=re.search(r'송도동\s+(\d+)(?:-(\d+))?',address)
  print('BUILDING_LOT_IDENTIFIED',bool(match),flush=True)
  if match and str(sample.get('bjdCode') or '')=='2818510600':
    probe('building-recap','BldRgstHubService/getBrRecapTitleInfo',
     {'sigunguCd':'28185','bjdongCd':'10600','platGbCd':'0',
      'bun':match.group(1).zfill(4),'ji':(match.group(2) or '0').zfill(4),
      'numOfRows':10,'pageNo':1,'_type':'json'})
else: print('BUILDING_PROBE_SKIPPED',flush=True)
print('PROBE_DONE',flush=True)
