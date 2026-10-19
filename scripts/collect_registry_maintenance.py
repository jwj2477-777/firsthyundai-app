#!/usr/bin/env python3
"""Validated Songdo building-title and public common-fee line items.

Only show verified K-apt codes and legal-lot matches. A common fee *item* is
not an apartment's complete maintenance bill or a household invoice.
No API keys, unverified guesses, or raw provider payloads are published.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from pathlib import Path
import json, re, time
from collect_complexes import call_api,unpack,list_complexes,PublicApiError

ROOT=Path(__file__).resolve().parents[1]
SOURCE_REGISTRY='https://www.data.go.kr/data/15134735/openapi.do'
SOURCE_MAINTENANCE='https://www.data.go.kr/data/15057937/openapi.do'
REGISTRY_URL='https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo'
COST_URL='https://apis.data.go.kr/1613000/AptCmnuseManageCostServiceV3/'
FIELDS=(
 ('getHsmpLaborCostInfoV3','인건비',('pay','bonus','pension','accidentPremium',
    'employPremium','healthPremium','nationalPension','sundryCost','welfareBenefit')),
 ('getHsmpGuardCostInfoV3','경비비',('guardCost',)),
 ('getHsmpCleaningCostInfoV3','청소비',('cleanCost',)),
)

def norm(value):
    return re.sub(r'[^0-9가-힣A-Z]','',str(value or '').upper())
def address_key(value):
    # Road name + building number; no fuzzy matching or location guesses.
    return norm(value)
def match_lot(address):
    s=str(address or '')
    m=re.search(r'연수구\s+송도동\s+([0-9]{1,4})(?:-([0-9]{1,4}))?(?:\s|$)',s)
    if not m:return None
    return m.group(1).zfill(4),(m.group(2) or '0').zfill(4)
def won(value):
    raw=str(value).strip().replace(',','') if value is not None else ''
    if not re.fullmatch(r'(?:0|[1-9]\d*)(?:\.0+)?',raw):return None
    number=int(raw.split('.',1)[0])
    return number if 0<=number<=100_000_000_000 else None
def date8(value):
    raw=str(value or '').replace('-','')
    if not re.fullmatch(r'\d{8}',raw):return ''
    try:return datetime.strptime(raw,'%Y%m%d').strftime('%Y-%m-%d')
    except ValueError:return ''
def upsert_complex_targets(catalog,basic):
    code=str(basic.get('kaptCode') or '')
    if not re.fullmatch(r'A\d{8}',code) or str(basic.get('bjdCode'))!='2818510600':
        return []
    road=address_key(basic.get('doroJuso'))
    if not road or '연수구' not in str(basic.get('doroJuso','')):return []
    official_name=norm(basic.get('kaptName'))
    # A K-apt catalog row always wins. For manually verified apartment entries,
    # allow a *unique exact* road-address match only.
    matches=[p for p in catalog if not p.get('aggregate_only') and
        p.get('kapt_code')==code and p.get('id') and
        address_key(p.get('address'))==road]
    if matches:return matches[:1]
    matches=[p for p in catalog if not p.get('aggregate_only') and
        p.get('id') and not p.get('kapt_code') and address_key(p.get('address'))==road]
    return matches if len(matches)==1 and official_name else []

def resolve_missing_kapt_codes(catalog,key,*,session=None,delay=0.04):
    """Attach verified public K-apt codes to legacy manually curated blocks in memory.

    Uses official K-apt listing/name shortlist; a single exact road-address and
    legal-dong match is mandatory before linking. Never overwrites source JSON.
    """
    missing=[p for p in catalog if p.get('id') and not p.get('aggregate_only') and
        not p.get('kapt_code') and p.get('address') and '연수구' in p['address']]
    if not missing:return list(catalog)
    stems=set()
    for p in missing:
        for raw in [p.get('label',''),*(p.get('aliases') or [])]:
            s=norm(raw)
            s=re.sub(r'^(인천|송도|더샵)', '',s)
            s=re.sub(r'(아파트|블럭|단지|블록|BL|F\d{1,2}BL)
    resp=call_api('https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5',
      {'kaptCode':code,'dataType':'JSON'},key,session=session)
    rows,_=unpack(resp)
    if len(rows)!=1 or str(rows[0].get('kaptCode',''))!=code:raise PublicApiError('K-apt 기본정보 불일치')
    return rows[0]

def verify_building_rows(rows,basic):
    lot=match_lot(basic.get('kaptAddr'))
    if not lot:return None
    validated=[]
    for r in rows:
        if str(r.get('sigunguCd'))!='28185' or str(r.get('bjdongCd'))!='10600':continue
        if str(r.get('bun')).zfill(4)!=lot[0] or str(r.get('ji')).zfill(4)!=lot[1]:continue
        purpose=str(r.get('mainPurpsCdNm') or '')
        if not ('공동주택' in purpose or '아파트' in purpose):continue
        # Official road address, when present, must not identify a different road.
        bldroad=str(r.get('newPlatPlc') or '')
        if bldroad and norm(str(basic.get('doroJuso') or '')) not in norm(bldroad):
            # Some building ledgers add Dong/Ho to road address; require exact core road text.
            # Don't silently choose the first unrelated building.
            continue
        validated.append(r)
    if not validated:return None
    # Multiple title records at a complex may represent individual buildings;
    # report their count only, and *do not sum* without complete pagination.
    dates=sorted({date8(r.get('useAprDay')) for r in validated if date8(r.get('useAprDay'))})
    purposes=sorted({str(r.get('mainPurpsCdNm','')).strip() for r in validated if r.get('mainPurpsCdNm')})
    floors=[won(r.get('grndFlrCnt')) for r in validated]
    floors=[x for x in floors if x is not None and x<=300]
    summary=('건축물대장 표제부 '+str(len(validated))+'건 확인'+
       (' · 주용도 '+purposes[0] if len(purposes)==1 else '')+
       (' · 사용승인 '+dates[-1] if dates else '')+
       (' · 확인 건물 최고 지상 '+str(max(floors))+'층' if floors else ''))
    return dict(summary=summary[:290],title_count=len(validated),
        approval_date=dates[-1] if dates else None,
        top_ground_floor=max(floors) if floors else None)

def collect_registry(catalog,key,*,session=None,delay=0.06,max_codes=130):
    result=[];failures=0;matched=0
    codes=sorted({p['kapt_code'] for p in catalog if
         re.fullmatch(r'A\d{8}',str(p.get('kapt_code') or ''))})[:max_codes]
    if not codes:raise RuntimeError('송도 K-apt 단지코드가 없습니다')
    for code in codes:
        try:
            basic=fetch_basic(key,code,session)
            matches=upsert_complex_targets(catalog,basic)
            lot=match_lot(basic.get('kaptAddr'))
            if not matches or not lot:continue
            matched+=1
            data=call_api(REGISTRY_URL,{'sigunguCd':'28185','bjdongCd':'10600',
                'platGbCd':'0','bun':lot[0],'ji':lot[1],
                'pageNo':1,'numOfRows':100,'_type':'json'},key,session=session)
            rows,total=unpack(data)
            if total is not None and total>len(rows):
                # Avoid publishing a partial building-list as a complete title count.
                continue
            verified=verify_building_rows(rows,basic)
            if not verified:continue
            for p in matches:
                result.append(dict(complex_id=p['id'],kapt_code=code,**verified))
        except PublicApiError:
            failures+=1
        time.sleep(delay)
    if failures==len(codes):raise RuntimeError('건축물대장 서비스 전체 요청 실패, 이전 자료 보존')
    return dict(state='verified',updated_at=datetime.now().astimezone().isoformat(),
        source_url=SOURCE_REGISTRY,
        note='송도동 법정동/지번과 K-apt 공식 단지코드, 건축물대장 표제부 주용도·주소 검증을 통과한 건물 정보만 표시. 단지 내 미일치 동은 표시하지 않음.',
        scanned=len(codes),eligible=matched,failures=failures,records=result)

def fee_month(today=None,months_back=2):
    d=today or datetime.now()
    y=d.year*12+d.month-1-months_back
    return f'{y//12:04d}{y%12+1:02d}'

def normalize_cost_response(rows,code,name,fields):
    if len(rows)!=1:return None
    row=rows[0]
    if str(row.get('kaptCode'))!=code or norm(row.get('kaptName'))!=norm(name):
        return None
    values=[won(row.get(field)) for field in fields]
    if all(v is None for v in values):return None
    # A 0 that was provided by the official API is valid, but missing isn't 0.
    return sum(v for v in values if v is not None)

def collect_maintenance(catalog,key,*,session=None,delay=0.06,max_codes=130,today=None):
    result=[];failures=0;matched=0
    month=fee_month(today)
    codes=sorted({p['kapt_code'] for p in catalog if
        re.fullmatch(r'A\d{8}',str(p.get('kapt_code') or ''))})[:max_codes]
    if not codes:raise RuntimeError('송도 K-apt 단지코드가 없습니다')
    for code in codes:
        try:
            basic=fetch_basic(key,code,session)
            matches=upsert_complex_targets(catalog,basic)
            if not matches:continue
            matched+=1
            items={}
            for endpoint,label,fields in FIELDS:
                response=call_api(COST_URL+endpoint,
                    {'kaptCode':code,'searchDate':month,'dataType':'JSON'},key,session=session)
                rows,_=unpack(response)
                amount=normalize_cost_response(rows,code,basic['kaptName'],fields)
                if amount is not None:items[label]=amount
                time.sleep(delay)
            if not items:continue
            summary=month[:4]+'년 '+str(int(month[4:]))+'월 공용관리비 공개항목 · '+\
                ' · '.join(k+' '+format(v,',')+'원' for k,v in items.items())+\
                ' · 전체 관리비 또는 세대별 청구액이 아닙니다.'
            for p in matches:
                result.append(dict(complex_id=p['id'],kapt_code=code,month=month,
                    summary=summary[:380],breakdown_won=items,
                    note='국토부 K-apt 단지 전체 공용관리비 일부 항목; 개별 세대 관리비 및 관리비 전체 합계 아님.'))
        except PublicApiError:
            failures+=1
        time.sleep(delay)
    if failures==len(codes):raise RuntimeError('K-apt 공용관리비 서비스 전체 요청 실패, 이전 자료 보존')
    return dict(state='verified',updated_at=datetime.now().astimezone().isoformat(),
       source_url=SOURCE_MAINTENANCE,month=month,scanned=len(codes),
       eligible=matched,failures=failures,
       note='국토교통부 K-apt 공용관리비 API의 인건비·경비비·청소비 공개항목만 표시. 전체 관리비와 별개이며 실제 세대 청구액이 아님.',
       records=result)

if __name__=='__main__':
    from os import environ
    doc=json.loads((ROOT/'data/complexes.json').read_text(encoding='utf8'))
    token=environ.get('DATA_GO_KR_SERVICE_KEY','')
    if not token:raise SystemExit('GitHub Secret DATA_GO_KR_SERVICE_KEY 설정 필요')
    for label,fn in [('building_registry',collect_registry),('maintenance',collect_maintenance)]:
        try:
            section=fn(doc['records'],token)
            print(label,'공식 검증 단지',len(section['records']),'/',section['scanned'])
        except RuntimeError as e:
            print(label,'수집 실패 · 기존 자료 보존:',str(e)[:100])
,'',s)
            name=re.sub(r'[0-9]','',s)
            if len(name)>=3:stems.add(name[:12])
    listing=list_complexes(key,session=session,wait=delay)
    candidates=[]
    for row in listing:
        code=str(row.get('kaptCode') or '')
        name=norm(row.get('kaptName'))
        if not re.fullmatch(r'A\d{8}',code) or not name:continue
        if row.get('bjdCode') and str(row.get('bjdCode'))!='2818510600':continue
        if any(stem in name for stem in stems):candidates.append(code)
    # Fail safely if a naming rule is too broad.
    if len(candidates)>160:raise RuntimeError('단지명 후보가 너무 많아 공식 코드 매칭을 보류합니다')
    verified={}
    for code in sorted(set(candidates)):
        try:
            basic=fetch_basic(key,code,session)
        except PublicApiError:continue
        if str(basic.get('bjdCode'))!='2818510600':continue
        road=address_key(basic.get('doroJuso'))
        hits=[p for p in missing if address_key(p['address'])==road]
        if len(hits)==1:
            verified.setdefault(hits[0]['id'],set()).add(code)
        time.sleep(delay)
    mapping={id:next(iter(codes)) for id,codes in verified.items() if len(codes)==1}
    print('공식 도로명주소로 검증한 기존 단지 K-apt 연결',len(mapping),'건')
    return [dict(p,kapt_code=mapping[p['id']]) if p.get('id') in mapping else p for p in catalog]

def fetch_basic(key,code,session=None):
    resp=call_api('https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5',
      {'kaptCode':code,'dataType':'JSON'},key,session=session)
    rows,_=unpack(resp)
    if len(rows)!=1 or str(rows[0].get('kaptCode',''))!=code:raise PublicApiError('K-apt 기본정보 불일치')
    return rows[0]

def verify_building_rows(rows,basic):
    lot=match_lot(basic.get('kaptAddr'))
    if not lot:return None
    validated=[]
    for r in rows:
        if str(r.get('sigunguCd'))!='28185' or str(r.get('bjdongCd'))!='10600':continue
        if str(r.get('bun')).zfill(4)!=lot[0] or str(r.get('ji')).zfill(4)!=lot[1]:continue
        purpose=str(r.get('mainPurpsCdNm') or '')
        if not ('공동주택' in purpose or '아파트' in purpose):continue
        # Official road address, when present, must not identify a different road.
        bldroad=str(r.get('newPlatPlc') or '')
        if bldroad and norm(str(basic.get('doroJuso') or '')) not in norm(bldroad):
            # Some building ledgers add Dong/Ho to road address; require exact core road text.
            # Don't silently choose the first unrelated building.
            continue
        validated.append(r)
    if not validated:return None
    # Multiple title records at a complex may represent individual buildings;
    # report their count only, and *do not sum* without complete pagination.
    dates=sorted({date8(r.get('useAprDay')) for r in validated if date8(r.get('useAprDay'))})
    purposes=sorted({str(r.get('mainPurpsCdNm','')).strip() for r in validated if r.get('mainPurpsCdNm')})
    floors=[won(r.get('grndFlrCnt')) for r in validated]
    floors=[x for x in floors if x is not None and x<=300]
    summary=('건축물대장 표제부 '+str(len(validated))+'건 확인'+
       (' · 주용도 '+purposes[0] if len(purposes)==1 else '')+
       (' · 사용승인 '+dates[-1] if dates else '')+
       (' · 확인 건물 최고 지상 '+str(max(floors))+'층' if floors else ''))
    return dict(summary=summary[:290],title_count=len(validated),
        approval_date=dates[-1] if dates else None,
        top_ground_floor=max(floors) if floors else None)

def collect_registry(catalog,key,*,session=None,delay=0.06,max_codes=130):
    result=[];failures=0;matched=0
    codes=sorted({p['kapt_code'] for p in catalog if
         re.fullmatch(r'A\d{8}',str(p.get('kapt_code') or ''))})[:max_codes]
    if not codes:raise RuntimeError('송도 K-apt 단지코드가 없습니다')
    for code in codes:
        try:
            basic=fetch_basic(key,code,session)
            matches=upsert_complex_targets(catalog,basic)
            lot=match_lot(basic.get('kaptAddr'))
            if not matches or not lot:continue
            matched+=1
            data=call_api(REGISTRY_URL,{'sigunguCd':'28185','bjdongCd':'10600',
                'platGbCd':'0','bun':lot[0],'ji':lot[1],
                'pageNo':1,'numOfRows':100,'_type':'json'},key,session=session)
            rows,total=unpack(data)
            if total is not None and total>len(rows):
                # Avoid publishing a partial building-list as a complete title count.
                continue
            verified=verify_building_rows(rows,basic)
            if not verified:continue
            for p in matches:
                result.append(dict(complex_id=p['id'],kapt_code=code,**verified))
        except PublicApiError:
            failures+=1
        time.sleep(delay)
    if failures==len(codes):raise RuntimeError('건축물대장 서비스 전체 요청 실패, 이전 자료 보존')
    return dict(state='verified',updated_at=datetime.now().astimezone().isoformat(),
        source_url=SOURCE_REGISTRY,
        note='송도동 법정동/지번과 K-apt 공식 단지코드, 건축물대장 표제부 주용도·주소 검증을 통과한 건물 정보만 표시. 단지 내 미일치 동은 표시하지 않음.',
        scanned=len(codes),eligible=matched,failures=failures,records=result)

def fee_month(today=None,months_back=2):
    d=today or datetime.now()
    y=d.year*12+d.month-1-months_back
    return f'{y//12:04d}{y%12+1:02d}'

def normalize_cost_response(rows,code,name,fields):
    if len(rows)!=1:return None
    row=rows[0]
    if str(row.get('kaptCode'))!=code or norm(row.get('kaptName'))!=norm(name):
        return None
    values=[won(row.get(field)) for field in fields]
    if all(v is None for v in values):return None
    # A 0 that was provided by the official API is valid, but missing isn't 0.
    return sum(v for v in values if v is not None)

def collect_maintenance(catalog,key,*,session=None,delay=0.06,max_codes=130,today=None):
    result=[];failures=0;matched=0
    month=fee_month(today)
    codes=sorted({p['kapt_code'] for p in catalog if
        re.fullmatch(r'A\d{8}',str(p.get('kapt_code') or ''))})[:max_codes]
    if not codes:raise RuntimeError('송도 K-apt 단지코드가 없습니다')
    for code in codes:
        try:
            basic=fetch_basic(key,code,session)
            matches=upsert_complex_targets(catalog,basic)
            if not matches:continue
            matched+=1
            items={}
            for endpoint,label,fields in FIELDS:
                response=call_api(COST_URL+endpoint,
                    {'kaptCode':code,'searchDate':month,'dataType':'JSON'},key,session=session)
                rows,_=unpack(response)
                amount=normalize_cost_response(rows,code,basic['kaptName'],fields)
                if amount is not None:items[label]=amount
                time.sleep(delay)
            if not items:continue
            summary=month[:4]+'년 '+str(int(month[4:]))+'월 공용관리비 공개항목 · '+\
                ' · '.join(k+' '+format(v,',')+'원' for k,v in items.items())+\
                ' · 전체 관리비 또는 세대별 청구액이 아닙니다.'
            for p in matches:
                result.append(dict(complex_id=p['id'],kapt_code=code,month=month,
                    summary=summary[:380],breakdown_won=items,
                    note='국토부 K-apt 단지 전체 공용관리비 일부 항목; 개별 세대 관리비 및 관리비 전체 합계 아님.'))
        except PublicApiError:
            failures+=1
        time.sleep(delay)
    if failures==len(codes):raise RuntimeError('K-apt 공용관리비 서비스 전체 요청 실패, 이전 자료 보존')
    return dict(state='verified',updated_at=datetime.now().astimezone().isoformat(),
       source_url=SOURCE_MAINTENANCE,month=month,scanned=len(codes),
       eligible=matched,failures=failures,
       note='국토교통부 K-apt 공용관리비 API의 인건비·경비비·청소비 공개항목만 표시. 전체 관리비와 별개이며 실제 세대 청구액이 아님.',
       records=result)

if __name__=='__main__':
    from os import environ
    doc=json.loads((ROOT/'data/complexes.json').read_text(encoding='utf8'))
    token=environ.get('DATA_GO_KR_SERVICE_KEY','')
    if not token:raise SystemExit('GitHub Secret DATA_GO_KR_SERVICE_KEY 설정 필요')
    for label,fn in [('building_registry',collect_registry),('maintenance',collect_maintenance)]:
        try:
            section=fn(doc['records'],token)
            print(label,'공식 검증 단지',len(section['records']),'/',section['scanned'])
        except RuntimeError as e:
            print(label,'수집 실패 · 기존 자료 보존:',str(e)[:100])
