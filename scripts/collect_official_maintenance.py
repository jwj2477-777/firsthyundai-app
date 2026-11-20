#!/usr/bin/env python3
"""Verify complete K-apt management fees from the three approved official APIs.

Nothing is published unless the known July 2026 F15 public totals calibrate
all three categories within a narrow approximate-estimate tolerance, and every published complex passes strict validations.
No credentials or raw API payloads are ever stored in the public repository.
"""
from __future__ import annotations
import json
import re
import sys
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo

from collect_complexes import call_api, unpack, PublicApiError
from collect_registry_maintenance import fetch_basic, upsert_complex_targets
from maintenance_history import merge_records

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'maintenance_estimates.json'
CATALOG = ROOT / 'data' / 'complexes.json'
BASE = 'https://apis.data.go.kr/1613000/'
GROUPS = {
 'common': ('AptCmnuseManageCostServiceV3', (
  'getHsmpLaborCostInfoV3', 'getHsmpGuardCostInfoV3',
  'getHsmpCleaningCostInfoV3', 'getHsmpEtcCostInfoV3',
  'getHsmpDisinfectionCostInfoV3', 'getHsmpRepairsCostInfoV3',
  'getHsmpElevatorMntncCostInfoV3', 'getHsmpFacilityMntncCostInfoV3',
  'getHsmpSafetyCheckUpCostInfoV3', 'getHsmpConsignManageFeeInfoV3',
  'getHsmpDisasterPreventionCostInfoV3', 'getHsmpOfcrkCostInfoV3',
  'getHsmpTaxdueInfoV3', 'getHsmpHomeNetworkMntncCostInfoV3',
  'getHsmpVhcleMntncCostInfoV3', 'getHsmpClothingCostInfoV3')),
 'individual': ('AptIndvdlzManageCostServiceV3', (
  'getHsmpHeatCostInfoV3', 'getHsmpWaterCostInfoV3',
  'getHsmpElectricityCostInfoV3', 'getHsmpHotWaterCostInfoV3',
  'getHsmpGasRentalFeeInfoV3', 'getHsmpWaterPurifierTankFeeInfoV3',
  'getHsmpDomesticWasteFeeInfoV3', 'getHsmpMovingInRepresentationMtgInfoV3',
  'getHsmpBuildingInsuranceFeeInfoV3', 'getHsmpElectionOrpnsInfoV3')),
 # Official operation list (data.go.kr 15059160): getHsmpMonthFeeInfoV3 = monthly levy (sLevy),
 # getHsmpMonthRetalFeeInfoV3 = monthly USE (sUse), getHsmpReserveBalanceInfoV3 = balance (sTot),
 # getHsmpAccumulationTariffInfoV3 = rate % (sPer). Only the levy belongs in the monthly fee total.
 # The previous getHsmpMonthChargeAmtInfoV3 never existed (HTTP 400, returnReasonCode 12).
 'reserve': ('AptRepairsCostServiceV3', ('getHsmpMonthFeeInfoV3',)),
}
F15 = 'A10026679'
CALIBRATION_MONTH = '202607'
CALIBRATION = {'common': 115610190, 'individual': 145310174, 'reserve': 9841930}
CALIBRATION_AREA = Decimal('70685.27')
IDENTITY = {'kaptCode', 'kaptName', 'searchDate', 'date', 'year', 'month',
            'baseYear', 'baseMonth', 'yyyymm', 'sido', 'sigungu', 'resultCode',
            'resultMsg', 'numOfRows', 'pageNo', 'totalCount'}
FINANCIAL = re.compile(r'(cost|fee|pay|bonus|pension|premium|benefit|amt|amount|wage|money|charge|levy|금액|비용|관리비|사용료|수선충당금)', re.I)
# Live K-apt V3 field names whose names do not contain a cost word. Verified 2026-11-20 against
# F15 2026-07: with these, the three group sums equal the independent calibration to the won.
# *C = common-area usage, *P = household usage; both are billed as individual usage fees.
KNOWN_FEE_FIELDS = frozenset({
 'heatC', 'heatP', 'waterCoolC', 'waterCoolP', 'electC', 'electP', 'waterHotC', 'waterHotP',
 'gasC', 'gasP', 'purifi', 'scrap', 'preMeet', 'buildInsu', 'electionMng',
 'bookSupply', 'officeSupply', 'sLevy'})
DATE_KEYS = re.compile(r'(date|month|year|search|code|number|count|area|rate|ratio|per|unit|index|seq|id)$', re.I)

def number(value):
 if isinstance(value, bool) or value is None:
  return None
 raw = str(value).strip().replace(',', '')
 if not re.fullmatch(r'(?:0|[1-9][0-9]*)(?:\.[0-9]+)?', raw):
  return None
 try:
  return Decimal(raw)
 except InvalidOperation:
  return None

def extract_amount(rows, code, month):
 """Select itemized won-denominated values, never percentages/area/months.

 A row may have several component fields. Unknown positive numeric fields are
 rejected, not guessed. One whole-category total plus individual subitems
 cannot be safely added: calibration below rejects such double counts.
 """
 if not rows:
  return None
 if len(rows) != 1 or not isinstance(rows[0], dict):
  return None
 row = rows[0]
 if str(row.get('kaptCode', '')) != code:
  return None
 for k in ('searchDate', 'yyyymm'):
  if k in row and str(row[k]).replace('-', '')[:6] != month:
   return None
 if 'kaptName' in row and not str(row['kaptName']).strip():
  return None
 fees = []
 for k, value in row.items():
  if k in IDENTITY or DATE_KEYS.search(k):
   continue
  amount = number(value)
  if amount is None:
   if value not in ('', None) and (k in KNOWN_FEE_FIELDS or FINANCIAL.search(k)):
    return None
   continue
  if k in KNOWN_FEE_FIELDS or FINANCIAL.search(k):
   if amount != amount.to_integral_value() or amount > 100_000_000_000:
    return None
   fees.append(int(amount))
  elif amount != 0:
   # An unclassified numeric field might be a monetary cost; refuse to
   # publish instead of silently omitting it.
   return None
 return sum(fees) if fees else None

def fetch_groups(code, month, key, request=call_api, pause=0.025):
 totals = {}
 for group, (service, operations) in GROUPS.items():
  amounts = []
  for op in operations:
   try:
    # One retry absorbs a transient throttle/network blip between ~27 rapid calls
    # (2026-11-20: every call succeeded singly while the batched run failed).
    for attempt in (1, 2):
     try:
      response = request(BASE + service + '/' + op,
                         {'kaptCode': code, 'searchDate': month, 'dataType': 'JSON'}, key)
      break
     except (PublicApiError, RuntimeError, ValueError, KeyError) as exc:
      if attempt == 2:
       # Fixed public-API error text only (never the URL or key).
       print('KAPT_OFFICIAL op failed', code, month, op, type(exc).__name__, str(exc)[:80])
       raise
      time.sleep(OP_RETRY_SECONDS)
    rows, total = unpack(response)
    if total is not None and total > len(rows):
     return None
    amount = extract_amount(rows, code, month)
    # Sparse optional categories may be unpublished or legitimately empty.
    # Missing is NOT zero: skip and require benchmark + minimum coverage.
    if amount is not None:
     amounts.append(amount)
   except (PublicApiError, RuntimeError, ValueError, KeyError):
    return None
   if pause:
    time.sleep(pause)
  # Prevent very sparse partial sums from masquerading as a full total.
  if group == 'reserve' and not amounts:
   return None
  if group != 'reserve' and len(amounts) < max(2, (len(operations) + 2) // 3):
   return None
  totals[group] = sum(amounts)
 return totals

def validated_rate(totals, area):
 if not isinstance(totals, dict) or set(totals) != set(GROUPS):
  return None
 if any(type(x) is not int or x < 0 or x > 1_000_000_000_000 for x in totals.values()):
  return None
 if min(totals.values()) <= 0:
  return None
 area = number(area)
 if area is None or not Decimal(300) <= area <= Decimal(1_000_000):
  return None
 full = sum(totals.values())
 rate = int((Decimal(full) / area).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
 if not 300 <= rate <= 20000:
  return None
 return full, rate

def calibration_passes(totals, area):
 # Sanity check the new parser against F15's independently sourced 2026-07
 # data. An approximate 84.7m2 fee within 10,000 won is only a *parser
 # calibration threshold*, NOT a guarantee of household invoice accuracy.
 # Crucially this does NOT cap month-to-month moves in any other period.
 if not isinstance(totals, dict) or set(totals) != set(CALIBRATION):
  return False
 size = number(area)
 if size is None or abs(size - CALIBRATION_AREA) / CALIBRATION_AREA > Decimal('0.01'):
  return False
 if any(type(totals[k]) is not int or totals[k] <= 0 or
        abs(totals[k] - v) > Decimal(v) * Decimal('0.10')
        for k,v in CALIBRATION.items()):
  return False
 unit_now = Decimal(sum(totals.values())) / size
 unit_ref = Decimal(sum(CALIBRATION.values())) / CALIBRATION_AREA
 return abs(unit_now - unit_ref) * Decimal('84.7') <= Decimal(10000)

def available_months(now=None):
 today = now or datetime.now(ZoneInfo('Asia/Seoul'))
 # K-apt publications often lag by roughly two months.
 y = today.year * 12 + today.month - 1
 # One published month per run bounds the public-key call budget: ~27 APIs
 # per complex, well below the standard 5,000-call daily developer quota.
 lag = 2 if today.day >= 26 else 3
 return [f'{(y-lag)//12:04d}{(y-lag)%12+1:02d}']

# Some complexes publish on K-apt a month or two later than others (verified
# 2026-11-20: 마스터뷰23·센터니얼 had no 2026-08 rows but complete 2026-07 rows).
# When the newest month is empty, step back, but only to a month newer than what
# is already stored, and only for a bounded number of complexes per run
# (20 x 2 x 27 calls stays well inside the 5,000-call daily quota).
FALLBACK_MONTHS = 2
CALIBRATION_ATTEMPTS = 3
OP_RETRY_SECONDS = 1.5
# A flaky K-apt API (connection failures, HTTP 500, 35 s timeouts) once pushed the
# job past its limit and the cancel also skipped the later fee steps. Stop scanning
# after this budget; verified rows so far are merged, the rest keep prior values.
COLLECT_BUDGET_SECONDS = 15 * 60
CALIBRATION_RETRY_SECONDS = 20
FALLBACK_COMPLEX_LIMIT = 20

def earlier_months(month, count=FALLBACK_MONTHS):
 index = int(month[:4]) * 12 + int(month[4:]) - 1
 return [f'{(index-k)//12:04d}{(index-k)%12+1:02d}' for k in range(1, count + 1)]

def collect(catalog, prior, key, *, get_groups=fetch_groups, get_basic=fetch_basic, months=None, pause=0,
            clock=time.monotonic):
 started = clock()
 prior_records = prior.get('records', [])
 # Verify interpretation of live numeric fields against independent
 # published itemized K-apt totals before using the algorithm on ANY site.
 # One transient HTTP error among the benchmark's 27 calls used to abort the whole
 # run (seen 2026-11-20; an immediate re-run passed). Retry the benchmark a few
 # times; the parser check itself is unchanged and still fails closed.
 for attempt in range(CALIBRATION_ATTEMPTS):
  if clock() - started > COLLECT_BUDGET_SECONDS:
   print('KAPT_OFFICIAL time budget reached during benchmark')
   return None
  benchmark = get_groups(F15, CALIBRATION_MONTH, key)
  try:
   base = get_basic(key, F15)
  except (PublicApiError, RuntimeError, ValueError, KeyError):
   base = {}
  if calibration_passes(benchmark, base.get('privArea')):
   break
  print('KAPT_OFFICIAL benchmark attempt', attempt + 1, 'failed:',
        'no data' if benchmark is None else {k: v for k, v in benchmark.items()},
        'area', base.get('privArea'))
  if pause or attempt + 1 < CALIBRATION_ATTEMPTS:
   time.sleep(CALIBRATION_RETRY_SECONDS if not pause else pause)
 else:
  return None
 dates = months or available_months()
 verified = {}
 tried = 0
 fallback_used = 0
 stored_month = {}
 for row in prior_records:
  if isinstance(row, dict) and row.get('complex_id'):
   stored_month[row['complex_id']] = max(stored_month.get(row['complex_id'], ''), str(row.get('month', '')))
 codes = {str(p.get('kapt_code')) for p in catalog
          if not p.get('aggregate_only') and re.fullmatch(r'A[0-9]{8}', str(p.get('kapt_code', '')))}
 # Missing or oldest data first: with a time budget, a fixed code order would let
 # the same late-listed complexes (e.g. 마스터뷰23) miss every slow run.
 code_month = {}
 for p in catalog:
  c = str(p.get('kapt_code', ''))
  if c in codes:
   code_month[c] = min(code_month.get(c, '999999'), stored_month.get(p.get('id'), ''))
 for code in sorted(codes, key=lambda c: (code_month.get(c, ''), c)):
  if clock() - started > COLLECT_BUDGET_SECONDS:
   print('KAPT_OFFICIAL time budget reached; keeping', len(verified), 'newly verified, others keep prior values')
   break
  basic = None
  try:
   basic = get_basic(key, code)
  except (PublicApiError, RuntimeError, ValueError, KeyError):
   continue
  matches = upsert_complex_targets(catalog, basic)
  if not matches or str(basic.get('kaptCode')) != code:
   continue
  area = number(basic.get('privArea'))
  if area is None:
   continue
  tried += 1
  newest_stored = min((stored_month.get(p['id'], '') for p in matches), default='')
  fallback = [x for x in earlier_months(min(dates)) if x > newest_stored and x not in dates]
  candidates = list(dates) + (fallback if fallback_used < FALLBACK_COMPLEX_LIMIT else [])
  stepped_back = False
  for month in candidates:
   if month not in dates and not stepped_back:
    stepped_back = True
    fallback_used += 1
   totals = get_groups(code, month, key)
   validated = validated_rate(totals, area)
   if not validated:
    continue
   full, rate = validated
   for p in matches:
    verified[p['id']] = {
      'complex_id': p['id'], 'kapt_code': code, 'month': month,
      'won_per_exclusive_m2': rate, 'monthly_total_won': full,
      'source_url': 'https://www.k-apt.go.kr/',
      'method': 'official_kapt_three_group_full_total_per_residential_exclusive_m2',
      'basis': '공식 K-apt 공용관리비·개별사용료·장기수선충당금 합계 / 단지 주거전용면적; 실제 세대 고지액이 아닌 상담 참고액',
      'components_won': totals}
   break
  if pause:
   time.sleep(pause)
 merged = merge_records(prior_records, list(verified.values()))
 return {
  'schema_version': 1, 'state': 'verified_partial' if merged else 'awaiting_verified_source',
  'source': '공식 K-apt 공동주택 공용관리비·개별사용료·장기수선충당금 API',
  'updated_at': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
  'checked_codes': tried, 'success_count': len(verified), 'failed_codes': max(0, tried-len(verified)),
  'records': merged,
  'note': '공식 세 그룹과 검증한 기준 단지의 금액 오차가 허용범위일 때만 참고액 저장. 미검증 단지는 기존 자료 보존. 실제 세대별 고지액 아님.'
 }

def main():
 import os
 key = os.environ.get('DATA_GO_KR_SERVICE_KEY', '')
 if not key:
  print('KAPT_OFFICIAL key unavailable; old snapshot preserved')
  return 0
 catalog = json.loads(CATALOG.read_text(encoding='utf-8'))['records']
 previous = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
 try:
  data = collect(catalog, previous, key)
 except (PublicApiError, RuntimeError, ValueError, KeyError):
  data = None
 if data is None:
  print('KAPT_OFFICIAL calibration incomplete/mismatch; old snapshot preserved')
  return 0
 if data['records'] != previous.get('records', []):
  OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
  print('KAPT_OFFICIAL published verified records', data['success_count'], 'scanned', data['checked_codes'])
 else:
  print('KAPT_OFFICIAL unchanged; verified', data['success_count'], 'scanned', data['checked_codes'])
 return 0

if __name__ == '__main__':
 sys.exit(main())
