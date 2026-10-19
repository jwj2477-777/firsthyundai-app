"""국토부 송도동 아파트 실거래 원문 XML → 공개 가능한 JSON 스냅샷."""
from __future__ import annotations
import argparse
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'trades.json'
KST = timezone(timedelta(hours=9))
DISTRICT_CODE = '28185'  # 인천광역시 연수구 (송도동은 이 법정동 권역에 속함)
ENDPOINTS = {
    '매매': 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
    '임대': 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
}


def clean(value):
    return (value or '').strip()


def get(item, *names):
    for name in names:
        val = item.get(name)
        if clean(val):
            return clean(val)
    return ''


def amount(value):
    v = re.sub(r'[,\s]', '', clean(value))
    if not v:
        return 0
    if not re.fullmatch(r'\d+', v):
        raise ValueError('금액 해석 불가: '+repr(value))
    return int(v)


def ymd(row):
    try:
        y = int(get(row, '년', 'dealYear'))
        m = int(get(row, '월', 'dealMonth'))
        d = int(get(row, '일', 'dealDay'))
        return f'{y:04d}-{m:02d}-{d:02d}' if datetime(y, m, d) else ''
    except (ValueError, TypeError):
        return ''


def recent_months(n=12, today=None):
    today = today or datetime.now(KST)
    index = today.year * 12 + today.month - 1
    for i in range(n):
        num = index-i
        yield f'{num//12:04d}{num%12+1:02d}'


def parse_response(xml_bytes):
    root = ET.fromstring(xml_bytes)
    code = clean(root.findtext('.//resultCode'))
    if code and code != '00':
        msg = clean(root.findtext('.//resultMsg'))
        raise RuntimeError(f'공공데이터 API 오류 {code}: {msg}')
    count = int(root.findtext('.//totalCount') or '0')
    items = [{child.tag: (child.text or '').strip() for child in item} for item in root.findall('.//items/item')]
    return items, count


def fetch_month(session, category, month, api_key, *, page_size=1000, max_pages=30, pause=0.15):
    result = []
    for page in range(1, max_pages+1):
        query = urlencode({'serviceKey':api_key, 'LAWD_CD':DISTRICT_CODE,
                           'DEAL_YMD':month, 'pageNo':page, 'numOfRows':page_size})
        req = Request(ENDPOINTS[category]+'?'+query, headers={'User-Agent':'FirstHyundai-Research/1.0'})
        # 테스트에서 요청을 주입할 수 있도록 별도 함수 사용
        payload = session(req)
        items, total = parse_response(payload)
        result.extend(items)
        if len(result) >= total:
            return result
        if not items:
            raise RuntimeError(f'{category} {month} 페이지 {page} 응답이 비어 전체 {total}건을 수집하지 못했습니다')
        time.sleep(pause)
    raise RuntimeError(f'{category} {month} 최대 페이지 초과: 잘린 자료를 게시하지 않습니다')


def http_request(req):
    with urlopen(req, timeout=40) as r:
        data = r.read(10_000_001)
        if len(data) > 10_000_000:
            raise RuntimeError('API 응답 용량 상한 초과')
        return data


def normalize(row, category, month):
    # 군구 API에서 송도동만 추출: 다른 연수구 법정동 거래를 섞지 않음.
    if get(row, '법정동', 'umdNm') != '송도동':
        return None
    date = ymd(row)
    building = get(row, '아파트', 'aptNm')
    area_str = get(row, '전용면적', 'excluUseAr')
    floor = get(row, '층', 'floor')
    if not date or not building or not area_str:
        return None
    try:
        area = round(float(area_str.replace(',', '')), 3)
    except ValueError:
        return None
    if area <= 0:
        return None
    base = {
        'contract_date': date,
        'building': building,
        'district': '인천광역시 연수구 송도동',
        'area_m2': area,
        'floor': floor,
        'building_year': get(row, '건축년도', 'buildYear'),
        'source_month': month,
        'source': '국토교통부 실거래가 공개 API',
    }
    if category == '매매':
        try:
            price = amount(get(row, '거래금액', 'dealAmount'))
        except ValueError:
            return None
        if not price: return None
        canceled = get(row, '해제여부', 'cdealType') == 'O' or bool(get(row, '해제사유발생일', 'cdealDay'))
        base.update({
            'type':'매매', 'amount_10k': price, 'deposit_10k':0, 'monthly_10k':0,
            'status':'해제' if canceled else '신고',
            'cancel_date_raw': get(row, '해제사유발생일', 'cdealDay'),
            'register_date_raw': get(row, '등기일자', 'rgstDate'),
            'building_block': get(row, '동', 'aptDong'),
            'dealing_type': get(row, '거래유형', 'dealingGbn'),
        })
    else:
        try:
            deposit = amount(get(row, '보증금액', 'deposit'))
            monthly = amount(get(row, '월세금액', 'monthlyRent'))
        except ValueError:
            return None
        base.update({
            'type': '월세' if monthly > 0 else '전세',
            'amount_10k':0, 'deposit_10k': deposit, 'monthly_10k': monthly,
            'status': '신고(임대차)',
            'contract_term_raw': get(row, '계약기간', 'contractTerm'),
            'renewal_raw': get(row, '갱신요구권사용', 'useRRRight'),
            'contract_type_raw': get(row, '계약구분', 'contractType'),
        })
    return base


def unique_ids(records):
    # 동일 금액/일자/면적의 별개 신고 거래를 합쳐버리지 않도록 중복 순번을 보존.
    counts = defaultdict(int)
    records.sort(key=lambda x: (x['contract_date'], x['building'], x['area_m2'],
                                x['floor'], x['type'], x['amount_10k'], x['deposit_10k'], x['monthly_10k'],
                                x.get('cancel_date_raw','')))
    for rec in records:
        content = json.dumps(rec, ensure_ascii=False, sort_keys=True)
        sig = hashlib.sha256(content.encode()).hexdigest()[:18]
        counts[sig] += 1
        rec['id'] = f'{sig}-{counts[sig]}'
    return records


def load_existing():
    if not OUTPUT.exists(): return {}
    old = json.loads(OUTPUT.read_text(encoding='utf-8'))
    return old if isinstance(old, dict) else {}


def update(*, months=12, key=None, request=http_request, now=None):
    key = key or os.getenv('DATA_GO_KR_SERVICE_KEY', '').strip()
    if not key:
        raise RuntimeError('DATA_GO_KR_SERVICE_KEY GitHub Secret을 먼저 등록하세요.')
    now = now or datetime.now(KST)
    old = load_existing()
    # 공개 JSON에 월별 자료를 중복 저장하지 않고 records로부터 이전 스냅샷을 복원.
    snapshots = defaultdict(list)
    for record in old.get('records', []):
        month = record.get('source_month', '')
        category = '매매' if record.get('type') == '매매' else '임대'
        if re.fullmatch(r'\d{6}', month):
            snapshots[f'{month}:{category}'].append(record)
    failures = []
    successes = 0
    for month in recent_months(months, today=now):
        for category in ('매매','임대'):
            bucket = f'{month}:{category}'
            try:
                raw = fetch_month(request, category, month, key)
                normalized = [result for row in raw if (result := normalize(row, category, month))]
                snapshots[bucket] = unique_ids(normalized)
                successes += 1
                print(f'{bucket}: {len(normalized)}건 (연수구 전체 조회 {len(raw)}건)')
            except Exception as exc:
                label = f'{type(exc).__name__} (HTTP {exc.code})' if hasattr(exc, 'code') else type(exc).__name__
                print(f'[WARN] {bucket} 수집 실패: {label}', file=sys.stderr)
                failures.append(f'{bucket}: {label}')
    if successes == 0:
        raise RuntimeError('모든 API 요청 실패: 기존 자료를 덮어쓰지 않습니다.')
    # 현재 범위 외 이전 월은 삭제 (계속 무한히 쌓이지 않도록)
    scope = {f'{month}:{cat}' for month in recent_months(months, today=now) for cat in ('매매','임대')}
    snapshots = {k:v for k,v in snapshots.items() if k in scope}
    missing = sorted(scope - set(snapshots))
    all_records = [entry for key in sorted(snapshots, reverse=True) for entry in snapshots[key]]
    all_records.sort(key=lambda x:(x['contract_date'],x['building'],x['id']), reverse=True)
    out = {
        'schema_version':1, 'area':'인천 연수구 송도동', 'lawd_cd':DISTRICT_CODE,
        'source': '국토교통부 아파트 매매·전월세 실거래가 OpenAPI',
        'source_links': ['https://www.data.go.kr/data/15126469/openapi.do',
                         'https://www.data.go.kr/data/15126474/openapi.do'],
        'checked_at': now.isoformat(timespec='seconds'),
        'last_success_at': now.isoformat(timespec='seconds') if not failures else old.get('last_success_at'),
        'state': 'ok' if not failures and not missing else 'partial',
        'errors': failures[:30], 'missing_buckets':missing,
        'count':len(all_records), 'records':all_records,
        'note': '신고 기준 공개 자료입니다. 실제 계약일과 공개일은 다르며, 반영 지연·정정·해제가 발생할 수 있습니다.'
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--months', type=int, default=12)
    args = parser.parse_args()
    if not (1 <= args.months <= 36): parser.error('months는 1~36 사이여야 합니다')
    result = update(months=args.months)
    print(f"완료: {result['count']}건 / 상태: {result['state']}")
