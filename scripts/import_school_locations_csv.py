#!/usr/bin/env python3
"""Import a user-supplied original K-Education school-location CSV safely.

Usage: python scripts/import_school_locations_csv.py /path/to/한국교육시설안전원_초중등학교위치.csv
Only verified Songdo-dong, Yeonsu-gu school fields are published; the entire
national CSV is NEVER committed, and no classroom/attendance/student data exists.
A validated CSV works without NEIS/standard API credentials or an approved API.
"""
from __future__ import annotations
import csv
from datetime import datetime,timezone,timedelta
import json,re,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'data'/'public_services.json'
SOURCE='https://www.data.go.kr/data/15021148/standard.do'
LEVELS=('초등학교','중학교','고등학교')
NEEDED={'학교ID','학교명','학교급구분','운영상태','소재지지번주소',
        '소재지도로명주소','위도','경도','데이터기준일자'}
KST=timezone(timedelta(hours=9))

def import_records(file_path):
    by_id={}
    with Path(file_path).open(encoding='utf-8-sig',newline='') as f:
        data=csv.DictReader(f)
        if not NEEDED.issubset(set(data.fieldnames or ())):
            raise RuntimeError('CSV 열 이름이 공식 학교위치 표준 형식과 다릅니다')
        for row in data:
            lot=str(row.get('소재지지번주소') or '').strip()
            if not re.search(r'인천광역시\s+연수구\s+송도동(?:\s|$)',lot):
                continue
            if str(row.get('운영상태') or '').strip()!='운영':
                continue
            level=str(row.get('학교급구분') or '').strip()
            if level not in LEVELS:continue
            code=str(row.get('학교ID') or '').strip()
            name=str(row.get('학교명') or '').strip()
            road=str(row.get('소재지도로명주소') or '').strip()
            date=str(row.get('데이터기준일자') or '').strip()
            if not(re.fullmatch(r'B\d{9,12}',code) and
                   2<=len(name)<=100 and
                   re.match(r'^인천광역시\s+연수구\s+\S',road) and
                   re.fullmatch(r'20\d{2}-\d{2}-\d{2}',date)):
                raise RuntimeError('송도 학교 기본자료 불일치: 게시를 중단합니다')
            try:lat=float(row['위도']);lng=float(row['경도'])
            except (TypeError,ValueError):
                raise RuntimeError('학교 좌표가 올바르지 않습니다') from None
            if not (37.2<lat<37.6 and 126.3<lng<127.0):
                raise RuntimeError('송도 학교 좌표 범위 오류')
            if code in by_id:raise RuntimeError('학교ID 중복으로 게시 중단')
            by_id[code]=dict(code=code,name=name,level=level,address=road,
                lat=round(lat,8),lng=round(lng,8),reference_date=date,source_url=SOURCE)
    if not 20<=len(by_id)<=180:
        raise RuntimeError('송도 학교 건수 비정상 또는 일부만 제공된 CSV: 게시 중단')
    records=sorted(by_id.values(),key=lambda x:(x['level'],x['name']))
    ref_dates={x['reference_date'] for x in records}
    if len(ref_dates)!=1:raise RuntimeError('CSV 데이터기준일자가 일치하지 않음')
    return {'state':'verified','updated_at':datetime.now(KST).isoformat(),
        'source_url':SOURCE,'reference_date':ref_dates.pop(),
        'import_method':'official_csv',
        'note':'한국교육시설안전원 학교위치 표준 CSV의 송도동 운영 초·중·고만 검증. 실제 배정학교나 통학구역 정보 아님.',
        'records':records}

def update_snapshot(csv_path,target=TARGET):
    official=import_records(csv_path)
    snap=json.loads(Path(target).read_text(encoding='utf8'))
    if snap.get('schema_version')!=1:raise RuntimeError('공개자료 스키마 불일치')
    snap['school_locations']=official
    snap['updated_at']=official['updated_at']
    tmp=Path(target).with_suffix('.json.tmp')
    tmp.write_text(json.dumps(snap,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    tmp.replace(target)
    return len(official['records'])

if __name__=='__main__':
    try:
        if len(sys.argv)!=2:raise RuntimeError('CSV 원본 경로 하나를 지정하세요')
        print('송도동 공식 학교위치 CSV 검증·게시:',update_snapshot(sys.argv[1]),'개')
    except (OSError,ValueError,RuntimeError,csv.Error) as exc:
        print('학교위치 CSV 가져오기 실패:',str(exc)[:200],file=sys.stderr)
        sys.exit(2)
