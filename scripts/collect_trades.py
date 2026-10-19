"""국토부 송도동 아파트 실거래 원문 XML → 공개 가능한 JSON 스냅샷."""
from __future__ import annotations
import argparse
from collections import defaultdict, Counter
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode, unquote
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'trades.json'
NEW_OUTPUT = ROOT / 'data' / 'new_trades.json'
KST = timezone(timedelta(hours=9))
DISTRICT_CODE = '28185'  # 인천광역시 연수구 (송도동은 이 법정동 권역에 속함)
ENDPOINTS = {
    '매매': 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
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
    if code and code not in ('00', '000'):
        # 공개 로그에는 응답 코드만 남김 (서버 메시지 등에 토큰이 섞일 가능성 차단).
        safe_code = code if re.fullmatch(r'[0-9A-Z_]{1,48}', code) else 'UNKNOWN'
        raise RuntimeError(f'API XML resultCode={safe_code}')
    count = int(root.findtext('.//totalCount') or '0')
    items = [{child.tag: (child.text or '').strip() for child in item} for item in root.findall('.//items/item')]
    return items, count


def normalized_service_key(key):
    """Encoding 키(%2B 등)와 Decoding 키를 모두 받아 URL에는 정확히 한 번만 인코딩."""
    key = key.strip()
    return unquote(key) if re.search(r'%[0-9a-fA-F]{2}', key) else key


def fetch_month(session, category, month, api_key, *, page_size=1000, max_pages=30, pause=0.15):
    result = []
    for page in range(1, max_pages+1):
        query = urlencode({'serviceKey':normalized_service_key(api_key), 'LAWD_CD':DISTRICT_CODE,
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
    try:
        with urlopen(req, timeout=40) as r:
            data = r.read(10_000_001)
            if len(data) > 10_000_000:
                raise RuntimeError('API 응답 용량 상한 초과')
            return data
    except HTTPError as exc:
        # 인증키 및 요청 URL을 공개 GitHub Actions 로그에 출력하지 않음.
        response = exc.read(8192).decode('utf-8', errors='replace')
        known_codes = (
            'SERVICE_ACCESS_DENIED_ERROR', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
            'SERVICE_KEY_IS_NULL', 'PERMISSION_DENIED', 'BLACKLIST_IP_ACCESS_ERROR',
            'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
            'LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR',
            'DEADLINE_HAS_EXPIRED_ERROR', 'INVALID_REQUEST_PARAMETER_ERROR',
            'NO_OPENAPI_SERVICE_ERROR', 'HTTP_ERROR',
        )
        reason = next((code for code in known_codes if code in response), '상세 코드 확인 불가')
        raise RuntimeError(f'API HTTP {exc.code} ({reason})') from None


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
        'lot_number': get(row, '지번', 'jibun'),
        'apt_seq': get(row, '아파트일련번호', 'aptSeq'),
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



# 국토부 거래 API는 개별 거래의 실제 신고일/공개일을 반환하지 않습니다.
# 첫 관측일은 '이전 수집에는 없지만 이번 수집에는 나타난' 날의 KST 날짜입니다.
# 해제여부/갱신정보/등기일 수정만으로는 신규로 분류하지 않도록 ID와 분리합니다.
IDENTITY_FIELDS = ('contract_date', 'building', 'area_m2', 'floor',
                   'type', 'amount_10k', 'deposit_10k', 'monthly_10k')


def public_identity(record):
    return json.dumps([record.get(field, '') for field in IDENTITY_FIELDS],
                      ensure_ascii=False, separators=(',', ':'))


def newly_detected(previous, current):
    """동일 조건의 중복 신고가 추가되면 추가된 개수만 계산."""
    previous_counts = Counter(public_identity(record) for record in previous)
    current_counts = defaultdict(int)
    result = []
    for record in current:
        key = public_identity(record)
        current_counts[key] += 1
        if current_counts[key] > previous_counts[key]:
            result.append(record)
    return result


def load_new_history():
    try:
        saved = json.loads(NEW_OUTPUT.read_text(encoding='utf-8'))
        return saved.get('records', []) if isinstance(saved.get('records'), list) else []
    except (ValueError, OSError, TypeError, AttributeError):
        return []


def publish_newly_detected(new_records, *, now, failed, missing):
    """최근 31일 동안 처음 발견한 공개 실거래 기록을 일자별 보존."""
    first_seen_date = now.date().isoformat()
    first_seen_at = now.isoformat(timespec='seconds')
    cutoff = (now.date() - timedelta(days=30)).isoformat()
    existing = [record for record in load_new_history()
                if isinstance(record, dict)
                and cutoff <= str(record.get('first_seen_date', '')) <= first_seen_date]
    additions = [{**record, 'first_seen_date': first_seen_date,
                  'first_seen_at': first_seen_at} for record in new_records]
    combined = existing + additions
    combined.sort(key=lambda x: (x.get('first_seen_date', ''),
                                  x.get('contract_date', ''),
                                  x.get('building', '')), reverse=True)
    counts = defaultdict(lambda: {'매매': 0, '전세': 0, '월세': 0})
    for record in combined:
        kind = record.get('type')
        if kind in ('매매', '전세', '월세'):
            counts[record['first_seen_date']][kind] += 1
    payload = {
        'schema_version': 1,
        'area': '인천 연수구 송도동',
        'state': 'partial' if failed or missing else 'ok',
        'checked_at': first_seen_at,
        'date_basis': '신규 공개 확인일(앱 수집에서 처음 발견한 날)',
        'note': '계약일이나 정부의 정확한 공개일이 아닙니다. 이전 조회에는 없었으나 이번 조회에 처음 나타난 거래입니다. 실제 공개 시점보다 늦게 발견될 수 있고, 정정 거래가 신규로 분류될 가능성이 있습니다.',
        'retention_days': 31,
        'count': len(combined),
        'counts_by_day': dict(sorted(counts.items(), reverse=True)),
        'errors': failed[:30],
        'missing_buckets': missing,
        'records': combined,
    }
    NEW_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    NEW_OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')
    return payload


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
    newest = []
    had_previous_snapshot = bool(old.get('checked_at'))
    unavailable_categories = set()
    for month in recent_months(months, today=now):
        for category in ('매매','임대'):
            if category in unavailable_categories:
                continue
            bucket = f'{month}:{category}'
            try:
                raw = fetch_month(request, category, month, key)
                normalized = [result for row in raw if (result := normalize(row, category, month))]
                normalized = unique_ids(normalized)
                # 기존 자료가 없는 처음 조회나 빠져 있던 과거 월은 일일 신규로 오판하지 않음.
                # 매월 1일 새 계약월은 이전 정상 스냅샷이 있으면 관측 시작일부터 신규 인정.
                if had_previous_snapshot and (bucket in snapshots or month == now.strftime('%Y%m')):
                    newest.extend(newly_detected(snapshots.get(bucket, []), normalized))
                snapshots[bucket] = normalized
                successes += 1
                print(f'{bucket}: {len(normalized)}건 (연수구 전체 조회 {len(raw)}건)')
            except Exception as exc:
                label = str(exc) if isinstance(exc, RuntimeError) and str(exc).startswith(('API HTTP ', 'API XML ')) else type(exc).__name__
                print(f'[WARN] {bucket} 수집 실패: {label}', file=sys.stderr)
                failures.append(f'{bucket}: {label}')
                if ('SERVICE_KEY_IS_NOT_REGISTERED_ERROR' in label or
                    'SERVICE_ACCESS_DENIED_ERROR' in label or
                    'PERMISSION_DENIED' in label):
                    unavailable_categories.add(category)
                    print(f'[WARN] {category} API 권한 오류: 나머지 월의 해당 종류 호출을 중단합니다', file=sys.stderr)
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
        'last_success_at': now.isoformat(timespec='seconds'),
        'state': 'ok' if not failures and not missing else 'partial',
        'errors': failures[:30], 'missing_buckets':missing,
        'count':len(all_records), 'records':all_records,
        'note': '신고 기준 공개 자료입니다. 실제 계약일과 공개일은 다르며, 반영 지연·정정·해제가 발생할 수 있습니다.'
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    news = publish_newly_detected(newest, now=now, failed=failures, missing=missing)
    print(f"신규 공개 확인 {len(newest)}건 / 최근 31일 누적 {news['count']}건")
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--months', type=int, default=12)
    args = parser.parse_args()
    if not (1 <= args.months <= 36): parser.error('months는 1~36 사이여야 합니다')
    result = update(months=args.months)
    print(f"완료: {result['count']}건 / 상태: {result['state']}")
