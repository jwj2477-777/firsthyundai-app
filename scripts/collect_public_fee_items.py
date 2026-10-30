#!/usr/bin/env python3
"""Verified *partial* K-apt public common-fee items for complexes without full bills.

Only a same-month, official guard/cleaning pair is published. Never label its
sum an overall management fee or a per-household invoice. A known F15 July
sample calibrates field and unit interpretation before surveying other sites.
"""
from __future__ import annotations
import json,os,re,sys,time
from decimal import Decimal,InvalidOperation
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from collect_complexes import call_api,unpack,PublicApiError
from collect_registry_maintenance import fetch_basic,upsert_complex_targets

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'complexes.json'
OUT=ROOT/'data'/'maintenance_partial.json'
URL='https://apis.data.go.kr/1613000/AptCmnuseManageCostServiceV3/'
SOURCE='https://www.data.go.kr/data/15057937/openapi.do'
OPS={'guard':'getHsmpGuardCostInfoV3','clean':'getHsmpCleaningCostInfoV3'}
FIELDS={'guard':'guardCost','clean':'cleanCost'}
REFERENCE={'guard':22188900,'clean':29219060}
REFERENCE_CODE='A10026679'
REFERENCE_MONTH='202607'

def amount(value):
 if isinstance(value,bool) or value is None:return None
 raw=str(value).replace(',','').strip()
 if not re.fullmatch(r'(?:0|[1-9][0-9]{0,11})(?:\\.0+)?',raw):return None
 value=int(raw.split('.',1)[0])
 return value if value<=100_000_000_000 else None

def extract(rows,code,month,field):
 if len(rows)!=1 or not isinstance(rows[0],dict):return None
 row=rows[0]
 if str(row.get('kaptCode',''))!=code:return None
 if 'searchDate' in row and str(row['searchDate']).replace('-','')[:6]!=month:return None
 if 'kaptName' in row and not str(row['kaptName']).strip():return None
 return amount(row.get(field))

def fetch_items(code,month,key,request=call_api):
 result={}
 for label,operation in OPS.items():
  try:
   response=request(URL+operation,{'kaptCode':code,'searchDate':month,'dataType':'JSON'},key)
   rows,total=unpack(response)
   if total is not None and total>len(rows):return None
   value=extract(rows,code,month,FIELDS[label])
   if value is None:return None
   result[label]=value
  except (PublicApiError,ValueError,RuntimeError,KeyError,TypeError):
   return None
 return result if any(result.values()) else None

def reference_passes(items):
 return bool(items and set(items)==set(REFERENCE) and
  all(isinstance(items[k],int) and
  abs(items[k]-REFERENCE[k])<=REFERENCE[k]*0.02 for k in REFERENCE))

def months(now=None):
 d=now or datetime.now(ZoneInfo('Asia/Seoul'))
 # The published period typically lags several months. Retry the prior month.
 y=d.year*12+d.month-1
 return [f'{(y-n)//12:04d}{(y-n)%12+1:02d}' for n in (2,3)]

def collect(catalog,key,*,get_items=fetch_items,get_basic=fetch_basic,match=upsert_complex_targets,
            target_months=None,pause=0.04):
 if not reference_passes(get_items(REFERENCE_CODE,REFERENCE_MONTH,key)):
  return None
 by_code={}
 for row in catalog:
  code=str(row.get('kapt_code') or '')
  if not row.get('aggregate_only') and re.fullmatch(r'A[0-9]{8}',code):
   by_code.setdefault(code,[]).append(row)
 rows=[];checked=0
 for code in sorted(by_code):
  try:
   basic=get_basic(key,code)
   verified=match(catalog,basic)
   if not verified or str(basic.get('kaptCode'))!=code:continue
   try:area=Decimal(str(basic.get('privArea')))
   except (InvalidOperation,ValueError,TypeError):continue
   if not area.is_finite() or not Decimal(300)<=area<=Decimal(1000000):continue
   checked+=1
   for month in target_months or months():
    items=get_items(code,month,key)
    if not items or not all(isinstance(v,int) and 0<=v<=100_000_000_000 for v in items.values()):
     continue
    for apt in verified:
     rows.append({'complex_id':apt['id'],'kapt_code':code,'month':month,
       'guard_won':items['guard'],'clean_won':items['clean'],'residential_exclusive_total_m2':float(area),
       'source_url':SOURCE,'method':'official_kapt_two_item_only',
       'basis':'공식 단지 경비비 및 청소비 일부 항목. 전체 관리비·세대 고지액 아님.'})
    break
  except (PublicApiError,ValueError,RuntimeError,KeyError,TypeError):
   continue
  if pause:time.sleep(pause)
 return {'schema_version':1,'state':'verified_partial' if rows else 'awaiting_verified_source',
  'updated_at':datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
  'source':SOURCE,'checked_codes':checked,'success_count':len(rows),
  'records':sorted(rows,key=lambda x:x['complex_id']),
  'note':'공식 경비비+청소비만. 전체 월 관리비 또는 타입별 실제 고지액이 아니므로 합계/예상 관리비로 표시 금지.'}

def main():
 key=os.environ.get('DATA_GO_KR_SERVICE_KEY','')
 if not key:
  print('관리비 일부항목 공식 키 미설정 · 기존 자료 보존');return 0
 catalog=json.loads(CATALOG.read_text(encoding='utf-8')).get('records',[])
 try:result=collect(catalog,key)
 except (RuntimeError,PublicApiError):result=None
 if result is None or not result['records']:
  print('경비·청소 공식 단가 보정 불일치/수집 실패 · 이전 데이터 보존');return 0
 previous=json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
 if result['records']==previous.get('records',[]):
  print('경비·청소 공식 금액 변동 없음',len(result['records']));return 0
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('경비·청소 일부 검증',len(result['records']),'/',result['checked_codes'],'단지 · 전체 관리비 아님')
 return 0

if __name__=='__main__':
 sys.exit(main())
