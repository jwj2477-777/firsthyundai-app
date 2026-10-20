"""Synthetic test only. Never log authorization, customer text or model output."""
import json,os,time
from urllib.request import Request,urlopen
for attempt in range(6):
 try:
  with urlopen('https://firsthyundai-contract.jwj2477.workers.dev/health',timeout=15) as r:
   assert json.load(r)['ready']
  break
 except Exception:
  if attempt==5:raise SystemExit('Contract AI health check failed')
  time.sleep(5)
req=Request('https://firsthyundai-contract.jwj2477.workers.dev/draft',data=json.dumps({'text':'테스트: 전세 보증금 3억9천만원, 전체 계약금 3900만원, 먼저 500만원. 잔금 2027년 2월 28일. 임대인이 천장 파손 수리.'}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ['ACCESS_CODE']})
try:
 with urlopen(req,timeout=55) as r:d=json.load(r)['draft']
 assert d['kind']=='전세' and d['total']=='390000000' and d['deposit']=='39000000' and d['partial']=='5000000'
 assert '임대인' in d['special'] and '천장' in d['special']
 print('Live AI extraction passed using synthetic contract terms only.')
except Exception:raise SystemExit('Contract AI live extraction failed; APK release stopped.')
