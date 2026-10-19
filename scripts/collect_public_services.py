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
from urllib.parse import urlencode,unquote
from urllib.request import urlopen,Request
from xml.etree import ElementTree as ET

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

def collect_schools(key,opener=None):
    if not key:raise RuntimeError('GitHub secret NEIS_EDU_KEY 미설정')
    # API must be paginated; 1000 items/page for E10; no guessing assigned schools.
    selected={};total=0
    for page in range(1,8):
        raw=retrieve(NEIS,{'KEY':key,'Type':'json','pIndex':page,'pSize':1000,
            'ATPT_OFCDC_SC_CODE':'E10'},opener)
        data=json.loads(raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw)
        info=data.get('schoolInfo')
        if not isinstance(info,list) or not info:raise RuntimeError('학교 목록을 찾을 수 없음. 인증키·응답 확인')
        if page==1:
            for heading in info[0].get('head',[]):
                if isinstance(heading,dict) and 'list_total_count' in heading:
                    total=int(heading['list_total_count'])
            if total<1 or total>7000:raise RuntimeError('NEIS 결과 건수 비정상')
        for row in parse_schools(raw):selected[row['code']]=row
        if page*1000>=total:break
    else:raise RuntimeError('NEIS pagination incomplete; no partial publication')
    return dict(state='verified',updated_at=fresh_date(),source_url=SCHOOL_SOURCE,
       note='인천시교육청 학교 기본정보 중 송도 주소 학교. 아파트 배정학교·통학구역은 이 자료로 판정하지 않음.',
       records=sorted(selected.values(),key=lambda x:(x['level'],x['name'])))

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

def update_snapshot(path,school=None,office=None):
    current=json.loads(path.read_text(encoding='utf-8'))
    if current.get('schema_version')!=1:raise RuntimeError('Snapshot schema mismatch')
    if school is not None:current['schools']=school
    if office is not None:current['office_rents']=office
    current['updated_at']=fresh_date()
    temp=path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp.replace(path)

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--mode',choices=['schools','offices','all'],default='all')
    a.add_argument('--months',type=int,default=6)
    args=a.parse_args()
    if not 1<=args.months<=12:raise ValueError('months must be 1..12')
    school=office=None
    if args.mode in ('schools','all') and os.environ.get('NEIS_EDU_KEY'):
        school=collect_schools(os.environ['NEIS_EDU_KEY'])
        print('NEIS 송도 학교 기본정보',len(school['records']),'곳')
    elif args.mode in ('schools','all'):print('NEIS 인증키 미설정: 기존 상태 유지')
    if args.mode in ('offices','all') and os.environ.get('DATA_GO_KR_SERVICE_KEY'):
        # This service requires separate approval despite sharing service key.
        office=collect_offices(os.environ['DATA_GO_KR_SERVICE_KEY'],months=args.months)
        print('송도 오피스텔 전월세',len(office['records']),'건')
    elif args.mode in ('offices','all'):print('오피스텔 API 인증키 미설정: 기존 상태 유지')
    if school is None and office is None:
        print('실행 가능한 신규 서비스 없음: 파일 변경 안 함')
        return
    update_snapshot(TARGET,school,office)
    print('기존 미승인 서비스·검증값 보존; 새 인증키는 출력하지 않음')

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,json.JSONDecodeError,ET.ParseError) as e:
        print('선택 수집 중단: '+str(e),file=sys.stderr)
        sys.exit(2)
