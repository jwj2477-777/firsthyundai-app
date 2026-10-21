#!/usr/bin/env python3
"""Safe optional official Songdo public-data collectors.

Secrets are read only from Actions environment; never appear in committed JSON.
Run --schools after NEIS_EDU_KEY is configured; --offices after independent
Officetel-Rent API approval on DATA_GO_KR_SERVICE_KEY. Unapproved services
remain visibly pending, not fabricated as empty/verified results.
"""
from __future__ import annotations
import argparse
from datetime import datetime,timedelta,timezone
import json,os,re,sys
from pathlib import Path
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode,unquote,urlparse
from urllib.request import urlopen,Request
from xml.etree import ElementTree as ET
from collect_registry_maintenance import collect_registry,collect_maintenance,resolve_missing_kapt_codes

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'data'/'public_services.json'
KST=timezone(timedelta(hours=9))
NEIS='https://open.neis.go.kr/hub/schoolInfo'
OFFICE='https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent'
SCHOOL_SOURCE='https://open.neis.go.kr/portal/data/service/selectServicePage.do?infId=OPEN17020190531110010104913&infSeq=2'
OFFICE_SOURCE='https://www.data.go.kr/data/15126475/openapi.do'

def fresh_date():
    return datetime.now(KST).strftime('%Y-%m-%dT%H:%M:%S%z')

def retrieve(url,args,opener=None):
    q=url+'?'+urlencode(args)
    req=Request(q,headers={'User-Agent':'FirstHyundai-PublicData/1.0','Accept':'application/json, application/xml'})
    try:
        if opener:return opener(req)
        with urlopen(req,timeout=35) as response:
            body=response.read(6_000_001)
            if len(body)>6_000_000:raise ValueError('API response exceeds safety limit')
            return body
    except HTTPError as e:raise RuntimeError('API HTTP '+str(e.code)+' (활용승인/파라미터 확인)') from None
    except (URLError,TimeoutError):raise RuntimeError('API 접속 실패 (기존 자료 보존)') from None

def school_rows(payload):
    data=json.loads(payload.decode('utf-8-sig') if isinstance(payload,bytes) else payload)
    if 'RESULT' in data:raise RuntimeError('NEIS API 응답코드 '+str(data['RESULT'].get('CODE','unknown')))
    listing=data.get('schoolInfo')
    if not isinstance(listing,list) or len(listing)<2 or not isinstance(listing[1].get('row'),list):
        raise RuntimeError('NEIS 학교 기본정보 응답 형식 불일치')
    return listing[1]['row']

def parse_schools(payload):
    selected=[]
    for r in school_rows(payload):
        name=str(r.get('SCHUL_NM') or '').strip()
        address=str(r.get('ORG_RDNMA') or '').strip()
        code=str(r.get('SD_SCHUL_CODE') or '').strip()
        level=str(r.get('SCHUL_KND_SC_NM') or '').strip()
        if not(name and code and '연수구' in address and ('송도' in address or '송도' in name)):
            continue
        if level not in ('초등학교','중학교','고등학교'):continue
        homepage=str(r.get('HMPG_ADRES') or '').strip()
        if homepage and not re.fullmatch(r'https?://[^\s"<>]{4,200}',homepage):homepage=''
        selected.append(dict(code=code,name=name,level=level,address=address,
            phone=str(r.get('ORG_TELNO') or '').strip()[:45],
            homepage=homepage,source_url=SCHOOL_SOURCE))
    return list({r['code']:r for r in selected}.values())

def _collect_schools_with_page_size(key, page_size, opener=None):
    """Read every page or raise; partial school data must never be published."""
    selected={}
    total=None
    max_pages=(7000+page_size-1)//page_size
    for page in range(1,max_pages+1):
        try:
            raw=retrieve(NEIS,{'KEY':key,'Type':'json','pIndex':page,'pSize':page_size,
                'ATPT_OFCDC_SC_CODE':'E10'},opener)
            data=json.loads(raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw)
            info=data.get('schoolInfo')
            if not isinstance(info,list) or len(info)<2:
                # Preserve the provider error code, not the key or raw request.
                school_rows(raw)
                raise RuntimeError('NEIS 학교 기본정보 응답 형식 불일치')
            if page==1:
                for heading in info[0].get('head',[]):
                    if isinstance(heading,dict) and 'list_total_count' in heading:
                        total=int(heading['list_total_count'])
                if total is None or not 1<=total<=7000:
                    raise RuntimeError('NEIS 결과 건수 비정상')
            for row in parse_schools(raw):selected[row['code']]=row
        except (RuntimeError,ValueError,KeyError,json.JSONDecodeError) as exc:
            raise RuntimeError('NEIS 학교정보 요청 실패 (페이지 '+str(page)+
                ', 요청건수 '+str(page_size)+'): '+str(exc)) from None
        if page*page_size>=total:break
    else:
        raise RuntimeError('NEIS pagination incomplete; no partial publication')
    if not selected:
        raise RuntimeError('NEIS 학교자료에서 송도 학교 0건: 빈 결과를 정상 수집으로 저장하지 않습니다.')
    return sorted(selected.values(),key=lambda x:(x['level'],x['name']))

def collect_schools(key,opener=None):
    key=str(key or '').strip()
    if not key:raise RuntimeError('GitHub secret NEIS_EDU_KEY 미설정')
    # The NEIS guide documents 100 records as the baseline. The former
    # 1000-record request returned HTTP 500; smaller pages are more resilient.
    transient=('API HTTP 500','API HTTP 502','API HTTP 503','API HTTP 504','API HTTP 429')
    failures=[]
    for page_size in (100,25,5):
        try:
            selected=_collect_schools_with_page_size(key,page_size,opener)
            if failures:
                print('NEIS 이전 페이지 크기의 일시적 오류를 피해 '+str(page_size)+
                      '건 단위 전체 페이지 수집 성공 (수집 결과는 공식 키 기준)')
            return dict(state='verified',updated_at=fresh_date(),source_url=SCHOOL_SOURCE,
                note='인천시교육청 학교 기본정보 중 송도 주소 학교. 아파트 배정학교·통학구역은 이 자료로 판정하지 않음.',
                records=selected)
        except RuntimeError as exc:
            reason=str(exc)
            if not any(err in reason for err in transient):raise
            failures.append(str(page_size)+'건 단위 '+reason.split(':')[-1].strip())
            print('NEIS 서버 오류: '+str(page_size)+'건 단위 호출 실패 · 작은 페이지로 재시도',
                  file=sys.stderr)
    # Diagnostic probe with the public sample key; its rows are NEVER saved.
    # This distinguishes a provider outage from errors specific to the user's key.
    try:
        probe=retrieve(NEIS,{'KEY':'sample','Type':'json','pIndex':1,'pSize':5,
            'ATPT_OFCDC_SC_CODE':'E10'},opener)
        school_rows(probe)
        context='공개 sample 조회는 정상: GitHub에 등록한 키가 나이스 전용 인증키인지, 유효기간과 사용 권한을 확인하세요.'
    except (RuntimeError,ValueError,json.JSONDecodeError):
        context='공개 sample 조회도 실패: 나이스 API 서버 상태 또는 호출 제한을 확인하세요.'
    raise RuntimeError('NEIS 학교정보 전체 수집 실패 (HTTP 500 등, 기존 자료 보존). '+context)


def office_items(payload):
    root=ET.fromstring(payload)
    code=root.findtext('.//header/resultCode','')
    if code not in ('00','000','0'):raise RuntimeError('오피스텔 API 응답코드 '+re.sub('[^A-Z0-9]','',code)[:32])
    count=int(root.findtext('.//body/totalCount','0'))
    rows=[]
    for item in root.findall('.//items/item'):
        rows.append({x.tag:(x.text or '').strip() for x in item})
    return rows,count

def as_int(value):
    t=str(value or '').replace(',','').strip()
    return int(t) if re.fullmatch(r'\d+',t) else None

def normalize_office(rows,month):
    out=[]
    for r in rows:
        if r.get('umdNm')!='송도동' or (r.get('sggNm') and r.get('sggNm')!='연수구'):continue
        y=as_int(r.get('dealYear'));m=as_int(r.get('dealMonth'));d=as_int(r.get('dealDay'))
        dep=as_int(r.get('deposit'));rent=as_int(r.get('monthlyRent'))
        name=(r.get('offiNm') or '').strip()
        try:day=datetime(y,m,d).strftime('%Y-%m-%d')
        except (ValueError,TypeError):continue
        if not name or dep is None or rent is None:continue
        try:area=round(float(r.get('excluUseAr','')),2)
        except (ValueError,TypeError):continue
        if not 4<=area<=3000:continue
        out.append(dict(building=name,contract_date=day,area_m2=area,floor=(r.get('floor') or ''),
            lot_number=(r.get('jibun') or ''),type='전세' if rent==0 else '월세',
            deposit_10k=dep,monthly_10k=rent,source_month=month))
    return out

def months_back(number,today=None):
    d=today or datetime.now(KST)
    return [f'{(d.year*12+d.month-1-i)//12:04d}{(d.year*12+d.month-1-i)%12+1:02d}' for i in range(number)]

def collect_offices(key,opener=None,months=6):
    if not key:raise RuntimeError('GitHub secret DATA_GO_KR_SERVICE_KEY 미설정')
    key=unquote(key.strip())
    allrows=[]
    for ym in months_back(months):
        for page in range(1,9):
            raw=retrieve(OFFICE,{'serviceKey':key,'LAWD_CD':'28185','DEAL_YMD':ym,
                  'pageNo':page,'numOfRows':1000},opener)
            rows,total=office_items(raw)
            allrows+=normalize_office(rows,ym)
            if page*1000>=total:break
        else:raise RuntimeError('오피스텔 전체 페이지 수집 한도 초과, 부분결과 게시 금지')
    # Same-looking contracts may be distinct: preserve original occurrences.
    allrows.sort(key=lambda r:r['contract_date'],reverse=True)
    return dict(state='verified',updated_at=fresh_date(),source_url=OFFICE_SOURCE,
       note='연수구 송도동의 오피스텔 전월세, 국토부 신고·확정일자 자료. 아파트와 별개. 개인정보 및 호수 없음.',
       months=months,records=allrows[:10000])


# 한국부동산원 청약홈 분양정보 OpenAPI. Uses the SAME approved data.go.kr key
# as the trade collectors, but separate API approval is required.
# Never publish the service key or unverified partial responses.
APPLYHOME_BASE='https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/'
APPLYHOME_SOURCE='https://www.data.go.kr/data/15098547/openapi.do'
APPLYHOME_SERVICES=(
    ('getAPTLttotPblancDetail','아파트'),
    ('getRemndrLttotPblancDetail','무순위·잔여세대'),
    ('getUrbtyOfctlLttotPblancDetail','오피스텔·도시형 등'),
)

def subscription_date(value):
    raw=str(value or '').strip()
    if not raw:return ''
    s=raw.replace('.','-').replace('/','-').rstrip('-')
    if re.fullmatch(r'\d{8}',s):s=s[:4]+'-'+s[4:6]+'-'+s[6:]
    try:
        d=datetime.strptime(s,'%Y-%m-%d')
        return d.strftime('%Y-%m-%d') if 2000<=d.year<=2100 else ''
    except ValueError:return ''

def official_notice_link(value):
    s=str(value or '').strip()
    if not 1<=len(s)<=500:return ''
    try:
        u=urlparse(s)
        host=(u.hostname or '').lower()
        if u.scheme!='https' or u.username or u.password:return ''
        if host not in ('www.applyhome.co.kr','applyhome.co.kr','www.applyhome.kr','applyhome.kr'):
            return ''
        return s
    except ValueError:return ''

def subscription_rows(payload):
    try:
        obj=json.loads(payload.decode('utf-8-sig') if isinstance(payload,bytes) else payload)
    except (UnicodeDecodeError,ValueError,TypeError):
        raise RuntimeError('청약홈 API 응답 JSON 형식 오류') from None
    if not isinstance(obj,dict) or not isinstance(obj.get('data'),list):
        raise RuntimeError('청약홈 API 미승인 또는 예상하지 못한 응답 형식')
    try:
        # odcloud totalCount is the unfiltered global total; matchCount is the
        # number matching cond[...] filters and is what pagination must use.
        global_count=int(obj['totalCount'])
        count=int(obj.get('matchCount',global_count))
        page=int(obj['page'])
    except (KeyError,ValueError,TypeError):
        raise RuntimeError('청약홈 API 페이지 정보 누락') from None
    if count<0 or count>global_count or global_count>100000 or page<1:
        raise RuntimeError('청약홈 API 검색 건수 비정상')
    return obj['data'],count,page

def normalize_subscriptions(rows,kind):
    out=[]
    for item in rows:
        if not isinstance(item,dict):continue
        name=str(item.get('HOUSE_NM') or '').strip()
        address=str(item.get('HSSPLY_ADRES') or '').strip()
        # Incheon-wide: use authoritative supply address, never just a project
        # name containing '인천' or an untrusted administrative label.
        if not (name and re.match(r'^인천(?:광역시|시)?\s',address)):continue
        notice=subscription_date(item.get('RCRIT_PBLANC_DE'))
        if not notice:continue
        house_no=str(item.get('HOUSE_MANAGE_NO') or '').strip()
        notice_no=str(item.get('PBLANC_NO') or '').strip()
        if not (re.fullmatch(r'[0-9]{1,30}',house_no) and
                re.fullmatch(r'[0-9A-Za-z_-]{1,40}',notice_no)):continue
        start=subscription_date(item.get('SUBSCRPT_RCEPT_BGNDE') or
              item.get('GNRL_RCEPT_BGNDE') or item.get('SPSPLY_RCEPT_BGNDE'))
        end=subscription_date(item.get('SUBSCRPT_RCEPT_ENDDE') or
              item.get('GNRL_RCEPT_ENDDE') or item.get('SPSPLY_RCEPT_ENDDE'))
        # Never mistake missing dates for a scheduled application period.
        if start and end and start>end:start=end=''
        supply=as_int(item.get('TOT_SUPLY_HSHLDCO'))
        if supply is not None and supply>100000:supply=None
        out.append(dict(kind=kind,house_manage_no=house_no,notice_no=notice_no,
            name=name[:120],address=address[:220],notice_date=notice,
            apply_start=start,apply_end=end,
            announcement_date=subscription_date(item.get('PRZWNER_PRESNATN_DE')),
            move_in=str(item.get('MVN_PREARNGE_YM') or '').strip()[:20],
            households=supply,notice_url=official_notice_link(item.get('PBLANC_URL'))))
    return out

def collect_subscriptions(key,opener=None,today=None,days_back=420):
    if not key:raise RuntimeError('GitHub secret DATA_GO_KR_SERVICE_KEY 미설정')
    if not 30<=days_back<=730:raise ValueError('청약홈 기간 30~730일 필요')
    key=unquote(key.strip())
    now=today or datetime.now(KST).date()
    if isinstance(now,datetime):now=now.date()
    start=(now-timedelta(days=days_back)).isoformat()
    end=(now+timedelta(days=60)).isoformat()
    all_rows={}
    # 3 official endpoints; every page must be fetched before publishing data.
    for endpoint,kind in APPLYHOME_SERVICES:
        for page in range(1,31):
            args={
                'page':page,'perPage':100,'returnType':'JSON',
                'cond[SUBSCRPT_AREA_CODE_NM::EQ]':'인천',
                'cond[RCRIT_PBLANC_DE::GTE]':start,
                'cond[RCRIT_PBLANC_DE::LTE]':end,
                'serviceKey':key
            }
            raw=retrieve(APPLYHOME_BASE+endpoint,args,opener)
            rows,total,pageno=subscription_rows(raw)
            if pageno!=page or len(rows)>100:
                raise RuntimeError('청약홈 API 페이지 일치 검증 실패')
            for row in normalize_subscriptions(rows,kind):
                unique=(kind,row['house_manage_no'],row['notice_no'])
                all_rows[unique]=row
            if page*100>=total:break
            if not rows:raise RuntimeError('청약홈 API 중간 페이지 누락')
        else:raise RuntimeError('청약홈 API 페이지 최대치 초과, 부분결과 게시 금지')
    records=sorted(all_rows.values(),key=lambda r:(r['notice_date'],r['name']),reverse=True)
    return dict(state='verified',updated_at=fresh_date(),source_url=APPLYHOME_SOURCE,
        note='한국부동산원 청약홈 공식 모집공고일 기준 인천광역시 전체 소재 공고. 접수일 미기재는 별도 확인 필요. 접수 마감 공고도 지난 공고 탭에서 조회 가능.',
        window_start=start,window_end=end,records=records)

def update_snapshot(path,school=None,office=None,subscriptions=None,registry=None,maintenance=None):
    current=json.loads(path.read_text(encoding='utf-8'))
    if current.get('schema_version')!=1:raise RuntimeError('Snapshot schema mismatch')
    if school is not None:current['schools']=school
    if office is not None:current['office_rents']=office
    if subscriptions is not None:current['subscriptions']=subscriptions
    if registry is not None:current['building_registry']=registry
    if maintenance is not None:current['maintenance']=maintenance
    current['updated_at']=fresh_date()
    temp=path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp.replace(path)

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--mode',choices=['schools','offices','subscriptions','buildings','maintenance','complexinfo','all'],default='all')
    a.add_argument('--months',type=int,default=6)
    args=a.parse_args()
    if not 1<=args.months<=12:raise ValueError('months must be 1..12')
    school=office=subscriptions=registry=maintenance=None
    if args.mode in ('schools','all') and os.environ.get('NEIS_EDU_KEY'):
        school=collect_schools(os.environ['NEIS_EDU_KEY'])
        print('NEIS 송도 학교 기본정보',len(school['records']),'곳')
    elif args.mode in ('schools','all'):print('NEIS 인증키 미설정: 기존 상태 유지')
    if args.mode in ('offices','all') and os.environ.get('DATA_GO_KR_SERVICE_KEY'):
        # This service requires separate approval despite sharing service key.
        office=collect_offices(os.environ['DATA_GO_KR_SERVICE_KEY'],months=args.months)
        print('송도 오피스텔 전월세',len(office['records']),'건')
    elif args.mode in ('offices','all'):print('오피스텔 API 인증키 미설정: 기존 상태 유지')
    if args.mode in ('subscriptions','all') and os.environ.get('DATA_GO_KR_SERVICE_KEY'):
        subscriptions=collect_subscriptions(os.environ['DATA_GO_KR_SERVICE_KEY'])
        print('청약홈 인천 분양공고',len(subscriptions['records']),'건')
    elif args.mode in ('subscriptions','all'):
        print('청약홈 API 인증키 미설정: 기존 상태 유지')
    if args.mode in ('buildings','maintenance','complexinfo','all'):
        key=os.environ.get('DATA_GO_KR_SERVICE_KEY','')
        if key:
            catalog=json.loads((ROOT/'data'/'complexes.json').read_text(encoding='utf8'))
            complexes=catalog.get('records',[])
            try:complexes=resolve_missing_kapt_codes(complexes,key)
            except RuntimeError as e:print('기존 단지 K-apt 코드 매핑 보류 · 기존 단지코드 사용:',str(e)[:90])
            if args.mode in ('buildings','complexinfo','all'):
                try:
                    registry=collect_registry(complexes,key)
                    print('건축물대장 확인 단지',len(registry['records']),'건; 대상',registry['scanned'])
                except RuntimeError as e:print('건축물대장 별도 수집 실패 · 기존 자료 유지: '+str(e)[:90])
            if args.mode in ('maintenance','complexinfo','all'):
                try:
                    maintenance=collect_maintenance(complexes,key)
                    print('K-apt 공용관리비 항목 확인 단지',len(maintenance['records']),'건; 대상',maintenance['scanned'])
                except RuntimeError as e:print('공동주택 관리비 별도 수집 실패 · 기존 자료 유지: '+str(e)[:90])
        else:print('공공데이터 API 인증키 미설정: 기존 자료 유지')
    if all(x is None for x in (school,office,subscriptions,registry,maintenance)):
        print('실행 가능한 신규 서비스 없음: 파일 변경 안 함')
        return
    update_snapshot(TARGET,school,office,subscriptions,registry,maintenance)
    print('기존 미승인 서비스·검증값 보존; 새 인증키는 출력하지 않음')

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,json.JSONDecodeError,ET.ParseError) as e:
        print('선택 수집 중단: '+str(e),file=sys.stderr)
        sys.exit(2)
