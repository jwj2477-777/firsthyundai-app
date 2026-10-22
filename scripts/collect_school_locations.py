"""Optional, source-specific official nationwide school-location fallback.

The standard location dataset is NOT a school-assignment zone. It uses a
separately-approved DATA_GO_KR_SERVICE_KEY on GitHub, never on user devices.
An HTTP or pagination error must not replace an older verified snapshot.
"""
from __future__ import annotations
import json, re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone, timedelta

BASE='https://api.data.go.kr/openapi/tn_pubr_public_elesch_mskul_lc_api'
SOURCE='https://www.data.go.kr/data/15021148/standard.do'
KST=timezone(timedelta(hours=9))
LEVELS={'초등학교','중학교','고등학교'}

def parse_page(raw):
    try:
        data=json.loads(raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw)
        packet=data.get('response',data)
        header=packet.get('header',{})
        code=str(header.get('resultCode','')).strip()
        if code not in ('00','000','0'):
            raise RuntimeError('학교위치 API 응답코드 '+re.sub('[^A-Z0-9_]','',code)[:48])
        body=packet['body']
        total=int(body['totalCount'])
        listing=body.get('items',[])
        rows=listing.get('item',[]) if isinstance(listing,dict) else listing
        if isinstance(rows,dict):rows=[rows]
        if not isinstance(rows,list) or total<1 or total>50000:
            raise RuntimeError('학교위치 API 총건수 또는 목록이 비정상')
        return rows,total
    except (KeyError,TypeError,ValueError,AttributeError):
        raise RuntimeError('학교위치 API 응답 형식을 확인할 수 없음') from None

def normalize(rows):
    chosen={}
    for r in rows:
        if not isinstance(r,dict):continue
        name=str(r.get('schoolNm') or '').strip()
        code=str(r.get('schoolId') or '').strip()
        level=str(r.get('schoolSe') or '').strip()
        lot=str(r.get('lnmadr') or '').strip()
        road=str(r.get('rdnmadr') or '').strip()
        status=str(r.get('operSttus') or '').strip()
        # Require authoritative Yeonsu+Songdo street/lot data, never guess from
        # a school name or by geographical proximity to a condo.
        in_songdo=('연수구' in lot and '송도동' in lot)
        if not in_songdo and not lot:
            in_songdo=('연수구' in road and '송도' in name)
        if not in_songdo or status!='운영' or level not in LEVELS:continue
        if not re.fullmatch(r'B\d{9,12}',code) or not name or len(name)>100:continue
        try:
            lat=float(r['latitude']);lng=float(r['longitude'])
        except (ValueError,KeyError,TypeError):continue
        if not 37.2<lat<37.6 or not 126.3<lng<127.0:continue
        reference=str(r.get('referenceDate') or '').strip()
        chosen[code]={'code':code,'name':name,'level':level,'address':road or lot,
                      'lat':round(lat,7),'lng':round(lng,7),'reference_date':reference,
                      'source_url':SOURCE}
    return list(chosen.values())

def collect(key, opener=None, page_size=1000):
    if not str(key or '').strip():raise RuntimeError('공공데이터 인증키 미설정')
    if not 1<=page_size<=1000:raise ValueError('페이지 크기 오류')
    found={};total=None;pages=0
    for page in range(1,52):
        args={'serviceKey':str(key).strip(),'pageNo':page,'numOfRows':page_size,'type':'json'}
        # No auth key, raw URL or provider body may reach stdout or errors.
        request=Request(BASE+'?'+urlencode(args),
                        headers={'User-Agent':'FirstHyundai-SchoolLocation/1.0',
                                 'Accept':'application/json'})
        try:
            if opener:
                raw=opener(request)
            else:
                with urlopen(request,timeout=30) as response:raw=response.read(3_000_001)
        except HTTPError as exc:
            raise RuntimeError('학교위치 API HTTP '+str(exc.code)+' · 서비스별 활용승인/서버상태 점검') from None
        except (URLError,TimeoutError,OSError):
            raise RuntimeError('학교위치 API 연결 실패 · 기존 자료 유지') from None
        rows,n=parse_page(raw)
        if total is None:total=n
        if n!=total:raise RuntimeError('학교위치 API 페이지 간 총건수 불일치')
        if len(rows)!=min(page_size,total-(page-1)*page_size):
            raise RuntimeError('학교위치 API 페이지 건수 불일치 · 부분 자료 게시 중지')
        pages+=1
        for record in normalize(rows):found[record['code']]=record
        if page*page_size>=total:break
    else:raise RuntimeError('학교위치 API 전체 페이지 수집 범위 초과')
    if not found:raise RuntimeError('공식 학교위치 데이터의 송도 학교 0건 · 빈 목록 게시 금지')
    if len(found)>180:raise RuntimeError('송도 학교 수 비정상 · 원본 필터 확인')
    records=sorted(found.values(),key=lambda x:(x['level'],x['name']))
    return {'state':'verified','updated_at':datetime.now(KST).isoformat(),
      'source_url':SOURCE,'reference_date':max((r['reference_date'] for r in records),default=''),
      'note':'교육부/한국교육시설안전원 공식 학교위치 표준데이터. 송도동 소재 운영 중 학교. 아파트 배정학교/통학구역이 아님.',
      'records':records}
