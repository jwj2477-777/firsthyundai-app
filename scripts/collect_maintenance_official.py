#!/usr/bin/env python3
"""Official K-apt common + individual monthly fee subtotal (NOT full bill).

Uses data.go.kr V3 APIs already approved by the user and private Actions key.
For every apartment, identity/code/address, all 26 endpoint fields, billing
month and official residential exclusive m2 are validated. Only then may an
approximate type-based monthly subtotal be published.

K-apt repair reserve API's sUse is monthly SPENT amount, NOT monthly LEVIED
fee. Never add sUse, never claim this subtotal is a complete bill. Preserve
independently verified full-month data (F15 202607) over newer partial data.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json,os,re,time,sys
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.request import urlopen

from collect_complexes import call_api,unpack,PublicApiError
from collect_registry_maintenance import fetch_basic,upsert_complex_targets,norm,fee_month

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'data'/'maintenance_estimates.json'
CATALOG=ROOT/'data'/'complexes.json'
KST=ZoneInfo('Asia/Seoul')
API_ROOT='https://apis.data.go.kr/1613000/'
LINKS={
 'common':'https://www.data.go.kr/data/15057937/openapi.do',
 'individual':'https://www.data.go.kr/data/15059469/openapi.do',
 'reserve':'https://www.data.go.kr/data/15059160/openapi.do'
}
COMMON=(
 ('getHsmpLaborCostInfoV3',('pay','bonus','pension','accidentPremium','employPremium','healthPremium','nationalPension','sundryCost','welfareBenefit')),
 ('getHsmpGuardCostInfoV3',('guardCost',)),
 ('getHsmpCleaningCostInfoV3',('cleanCost',)),
 ('getHsmpEtcCostInfoV3',('accountingCost','careItemCost','hiddenCost')),
 ('getHsmpDisinfectionCostInfoV3',('disinfCost',)),
 ('getHsmpRepairsCostInfoV3',('lrefCost1',)),
 ('getHsmpElevatorMntncCostInfoV3',('elevCost',)),
 ('getHsmpFacilityMntncCostInfoV3',('lrefCost2',)),
 ('getHsmpSafetyCheckUpCostInfoV3',('lrefCost3',)),
 ('getHsmpConsignManageFeeInfoV3',('manageCost',)),
 ('getHsmpDisasterPreventionCostInfoV3',('lrefCost4',)),
 ('getHsmpOfcrkCostInfoV3',('bookSupply','officeSupply','transportCost')),
 ('getHsmpTaxdueInfoV3',('electCost','postageCost','taxrestCost','telCost')),
 ('getHsmpHomeNetworkMntncCostInfoV3',('hnetwCost',)),
 ('getHsmpVhcleMntncCostInfoV3',('carEtc','carInsurance','fuelCost','refairCost')),
 ('getHsmpClothingCostInfoV3',('clothesCost',))
)
INDIVIDUAL=(
 ('getHsmpHeatCostInfoV3',('heatC','heatP')),
 ('getHsmpWaterCostInfoV3',('waterCoolC','waterCoolP')),
 ('getHsmpElectricityCostInfoV3',('electC','electP')),
 ('getHsmpHotWaterCostInfoV3',('waterHotC','waterHotP')),
 ('getHsmpGasRentalFeeInfoV3',('gasC','gasP')),
 ('getHsmpWaterPurifierTankFeeInfoV3',('purifi',)),
 ('getHsmpDomesticWasteFeeInfoV3',('scrap',)),
 ('getHsmpMovingInRepresentationMtgInfoV3',('preMeet',)),
 ('getHsmpBuildingInsuranceFeeInfoV3',('buildInsu',)),
 ('getHsmpElectionOrpnsInfoV3',('electionMng',))
)
COMMON_BASE=API_ROOT+'AptCmnuseManageCostServiceV3/'
INDIVIDUAL_BASE=API_ROOT+'AptIndvdlzManageCostServiceV3/'
REPAIR_URL=API_ROOT+'AptRepairsCostServiceV3/getHsmpMonthRetalFeeInfoV3'
PILOT='A10026679'
PILOT_MONTH='202607'
PILOT_COMMON=115610190
PILOT_INDIVIDUAL=145310174
PILOT_EXCLUSIVE_AREA=Decimal('70685.27')

def money(v):
 if v is None or str(v).strip()=='':
  return 0
 raw=str(v).strip().replace(',','')
 if not re.fullmatch(r'[0-9]{1,12}(?:\\.0{1,5})?',raw):
  raise ValueError('K-apt 원화 액수 형식이 비정상입니다')
 try:amount=Decimal(raw)
 except InvalidOperation:raise ValueError('K-apt 원화 수치가 비정상입니다') from None
 if amount!=amount.to_integral_value() or not 0<=amount<=100_000_000_000:
  raise ValueError('K-apt 원화 범위 확인 불가')
 return int(amount)
def area_value(v):
 try:
  d=Decimal(str(v or ''))
  if d.is_finite() and Decimal('100')<=d<=Decimal('2000000'):
   return d
 except InvalidOperation:pass
 raise ValueError('K-apt 전용면적 확인 실패')
def source_row(key,code,month,endpoint,expected,session=None):
 payload=call_api(endpoint,{'kaptCode':code,'searchDate':month,'dataType':'JSON'},key,session=session)
 rows,total=unpack(payload)
 if len(rows)!=1 or not isinstance(rows[0],dict):
  raise ValueError('K-apt 월별 API 유효 단일 자료 없음')
 r=rows[0]
 if str(r.get('kaptCode'))!=code or norm(r.get('kaptName'))!=norm(expected):
  raise ValueError('K-apt 단지코드/단지명 불일치')
 return r
def group_month(key,code,name,month,base,definitions,session=None,delay=0):
 total=0
 for operation,fields in definitions:
  row=source_row(key,code,month,base+operation,name,session=session)
  if not all(k in row for k in fields):
   raise ValueError('K-apt 비용 응답 필수 필드 누락')
  subtotal=sum(money(row[k]) for k in fields)
  total+=subtotal
  if delay:time.sleep(delay)
 if not 0<total<250_000_000_000:raise ValueError('K-apt 월별 합계 이상치')
 return total
def get_costs(key,code,month,*,basic=None,session=None,delay=0):
 basic=basic or fetch_basic(key,code,session)
 if basic.get('kaptCode')!=code or str(basic.get('bjdCode'))!='2818510600':
  raise ValueError('송도동 K-apt 단지 식별 실패')
 name=basic['kaptName']
 area=area_value(basic.get('privArea'))
 common=group_month(key,code,name,month,COMMON_BASE,COMMON,session=session,delay=delay)
 individual=group_month(key,code,name,month,INDIVIDUAL_BASE,INDIVIDUAL,session=session,delay=delay)
 # Explicitly verify reserve endpoint response, but sUse = spent, not levied.
 # The component is NOT included in the subtotal; a missing reserve
 # response does not stop legitimate common/individual subtotal reporting.
 reserve_usage_checked=False
 try:
  r=source_row(key,code,month,REPAIR_URL,name,session=session)
  reserve_usage_checked='sUse' in r
 except (PublicApiError,ValueError,KeyError):
  pass
 subtotal=common+individual
 unit=int((Decimal(subtotal)/area).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
 if not 300<=unit<=20000:raise ValueError('K-apt 비용 단가 이상치')
 return {'kapt_code':code,'month':month,
   'monthly_total_won':subtotal,'common_won':common,'individual_won':individual,
   'reserve_won':None,'won_per_exclusive_m2':unit,
   'method':'official_common_individual_subtotal_excludes_repair_reserve',
   'is_full_monthly_fee':False,'excluded_categories':['장기수선충당금'],
   'exclusive_area_total_m2':float(area),
   'reserve_usage_verified_not_billed':reserve_usage_checked,
   'source_url':LINKS['common'],
   'source_urls':[LINKS['common'],LINKS['individual'],LINKS['reserve']],
   'basis':'단지 전체 공용관리비+개별사용료 검증 합계/공식 주거전용면적 합계. 장기수선충당금 미포함; 세대별 고지액 아님.'}
def crosscheck_pilot(key,session=None,delay=0):
 d=get_costs(key,PILOT,PILOT_MONTH,session=session,delay=delay)
 if (d['common_won']!=PILOT_COMMON or
     d['individual_won']!=PILOT_INDIVIDUAL or
     Decimal(str(d['exclusive_area_total_m2']))!=PILOT_EXCLUSIVE_AREA):
  raise ValueError('기존 공개 원문과 공식 공용/개별/전용면적 3중 교차검증 불일치')
 return d
def _collect_code(code,records,key,month,delay):
 try:
  basic=fetch_basic(key,code)
  matches=upsert_complex_targets(records,basic)
  if not matches:return None
  # Two-month fallback when latest month is incompletely published.
  months=[month]
  prev_year=int(month[:4]);prev_month=int(month[4:])-1
  if prev_month==0:prev_year-=1;prev_month=12
  older=f'{prev_year:04d}{prev_month:02d}'
  if older not in months:months.append(older)
  for m in months:
   try:
    result=get_costs(key,code,m,basic=basic,delay=delay)
    return [dict(complex_id=x['id'],**result) for x in matches]
   except (PublicApiError,ValueError,KeyError,TimeoutError):
    continue
 except (PublicApiError,ValueError,KeyError,TimeoutError):
  pass
 return None
def collect(records,key,old,*,month=None,pilot=True,delay=0.20,workers=3):
 if not key:raise ValueError('GitHub Secret DATA_GO_KR_SERVICE_KEY 미설정')
 if pilot:crosscheck_pilot(key,delay=delay)
 month=month or fee_month()
 oldrecords={p['complex_id']:p for p in old.get('records',[]) if p.get('complex_id')}
 codes=sorted({p['kapt_code'] for p in records if
   re.fullmatch(r'A\\d{8}',str(p.get('kapt_code') or '')) and not p.get('aggregate_only')})
 if len(codes)>180:raise ValueError('허용 단지수 초과')
 success=0;updated=0
 # Throttle across three workers rather than calling public APIs from devices.
 with ThreadPoolExecutor(max_workers=max(1,min(workers,3))) as executor:
  jobs={executor.submit(_collect_code,code,records,key,month,delay):code for code in codes}
  for task in as_completed(jobs):
   result=task.result()
   if not result:continue
   success+=1
   for new in result:
    prev=oldrecords.get(new['complex_id'])
    if prev and prev.get('is_full_monthly_fee') is not False and
       prev.get('method')!='official_common_individual_subtotal_excludes_repair_reserve':
      # Do not downgrade an actually complete, manually verified monthly fee
      # to a subtotal that omits repair-reserve assessments.
      continue
    if prev and str(prev.get('month',''))>new['month']:continue
    if prev!=new:updated+=1
    oldrecords[new['complex_id']]=new
 state='verified_partial' if oldrecords else 'awaiting_verified_source'
 return {'schema_version':1,'state':state,'source':'국토부 K-apt 공식 공용관리비+개별사용료 세부 API',
  'source_urls':[LINKS[k] for k in ('common','individual','reserve')],
  'updated_at':datetime.now(KST).isoformat(timespec='seconds'),
  'checked_codes':len(codes),'success_count':success,'updated_count':updated,
  'failed_codes':len(codes)-success,'records':sorted(oldrecords.values(),key=lambda x:x['complex_id']),
  'note':'장기수선충당금 API sUse는 월사용액으로 세대 부과액이 아니다. 공용+개별 항목의 단가에는 장기수선충당금을 더하지 않는다. 기존 출처가 확인된 전체 관리비 자료는 보존한다.'}
def main():
 old=json.loads(TARGET.read_text(encoding='utf-8'))
 records=json.loads(CATALOG.read_text(encoding='utf-8'))['records']
 key=os.environ.get('DATA_GO_KR_SERVICE_KEY','').strip()
 if not key:
  print('OFFICIAL_KAPT_STATUS secret_missing');return
 try:
  result=collect(records,key,old)
 except (PublicApiError,ValueError,KeyError,RuntimeError) as exc:
  # No exception payloads or URLs with private query keys may be logged.
  print('OFFICIAL_KAPT_STATUS pilot_not_verified_or_service_unavailable')
  return
 print('OFFICIAL_KAPT_STATUS','codes',result['checked_codes'],
  'verified',result['success_count'],'updated',result['updated_count'],
  'failed',result['failed_codes'],'total_public_rows',len(result['records']))
 if result['updated_count']<=0:return
 temp=TARGET.with_suffix('.json.tmp')
 temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\\n',encoding='utf-8')
 temp.replace(TARGET)
if __name__=='__main__':main()
