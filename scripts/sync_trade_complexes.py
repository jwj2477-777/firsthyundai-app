#!/usr/bin/env python3
"""Promote confirmed Songdo apartment transaction names to persistent catalog entries.

- Preserve K-apt and manually verified profiles.
- Crosswalk vetted trade-name aliases to exact existing complex IDs.
- Trade-only profiles carry NO invented household counts, construction/approval dates,
  heating, parking or drawings. A uniquely observed trade building year is not approval.
- Idempotent; a later K-apt sync must preserve aliases and transaction-only entries.
"""
from __future__ import annotations
import collections
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import re
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'complexes.json'
TRADES=ROOT/'data'/'trades.json'
KST=timezone(timedelta(hours=9))

# Exact crosswalk checked against official K-apt complex names and distinctive blocks.
# Do not use fuzzy matching: "SK VIEW" and "럭스오션 SK VIEW" are NOT the same.
ALIASES={
 "송도더샵센트럴시티":"kapt-a10026038",
 "e편한세상송도":"kapt-a10025886",
 "송도SKVIEW":"kapt-a10025399",
 "랜드마크시티센트럴더샵":"kapt-a10024710",
 "베르디움더퍼스트":"kapt-a10027171",
 "송도에듀포레푸르지오":"kapt-a10027367",
 "글로벌캠퍼스푸르지오":"kapt-a40673921",
 "롯데캐슬캠퍼스타운":"kapt-a10027653",
 "송도아메리칸타운아이파크":"kapt-a10025745",
 "호반써밋송도":"kapt-a10023361",
 "더샵그린스퀘어":"kapt-a40673922",
 "더샵퍼스트월드":"kapt-a40684013",
 "송도풍림아이원2단지":"kapt-a40673510",
 "더샵그린워크1차":"kapt-a40673923",
 "송도풍림아이원1단지":"kapt-a40673412",
 "송도LuxeOceanSKVIEW":"kapt-a10020744",
 "힐스테이트레이크송도1차":"kapt-a10025443",
 "더샵센트럴파크2":"kapt-a40673910",
 "송도더샵하버뷰(D13)":"kapt-a40673912",
 "송도웰카운티1단지":"kapt-a40684011",
 "송도풍림아이원3단지":"kapt-a40673603",
 "더샵송도아크베이":"kapt-a10020712",
 "송도금호어울림":"kapt-a40684004",
 "송도아이비원":"kapt-a10022353",
 "해모로월드뷰":"kapt-a40673916",
 "성지리벨루스":"kapt-a40684007",
 "송도웰카운티2단지":"kapt-a40684009",
 "롯데캐슬":"kapt-a40673917",
 "송도더샵하버뷰(D14)":"kapt-a40673911",
 "송도코오롱더프라우3단지":"kapt-a40673918",
 "송도이안":"kapt-a10022395",
 "송도더샵하버뷰(D15)":"kapt-a40673913",
 "송도더샵그린워크3차(18-1블럭)":"kapt-a10027888",
 "송도더샵그린워크3차(17-1블럭)":"kapt-a10027884",
 "송도풍림아이원6단지":"kapt-a40673101",
 "송도한진해모로":"kapt-a40684008",
}

# These contract labels are distinct units of K-apt aggregated managed estates.
# Linking a parent is NOT permission to copy parent total households onto a child.
SUBCOMPLEX={
 "더샵엑스포6단지":"kapt-a40673901",
 "더샵엑스포9단지":"kapt-a40673901",
 "더샵엑스포10단지":"kapt-a40673901",
 "인천송도힐스테이트3단지":"kapt-a40673905",
 "인천송도힐스테이트4단지":"kapt-a40673905",
 "인천송도힐스테이트5단지":"kapt-a40673905",
 "인천송도힐스테이트6단지":"kapt-a40673905",
}

def normalized(s):
    return re.sub(r'[^0-9A-Z가-힣]','',
      unicodedata.normalize('NFKC',str(s or '')).upper())

def trade_id(name):
    h=2166136261
    # Browser uses UTF-16 code units for JavaScript charCodeAt.
    by=normalized(name).encode('utf-16-le')
    for i in range(0,len(by),2):
        n=by[i]+(by[i+1]<<8)
        h=((h^n)*16777619)&0xffffffff
    return 'trade-'+format(h,'08x')

def build(catalog, trades):
    existing=catalog['records']
    if len(existing)<13:raise ValueError('Cannot replace validated first 13 profiles')
    if trades.get('state') in ('not_started',None) or not isinstance(trades.get('records'),list) or not trades['records']:
        raise ValueError('Official Songdo transaction snapshot unavailable; refuse publication')
    by_id={r['id']:r for r in existing}
    fixed_aliases={normalized(alias):dest for alias,dest in ALIASES.items()}
    for dest in ALIASES.values():
        if dest not in by_id:raise ValueError('Missing alias target '+dest)
    # Map all existing labels and aliases first, even if an alias was introduced earlier.
    by_alias={}
    for row in existing:
        for name in [row['label'],*(row.get('aliases') or [])]:
            alias=normalized(name)
            if alias:
                if alias in by_alias and by_alias[alias]!=row['id']:
                    raise ValueError('Conflicting aliases among two recorded complexes: '+name)
                by_alias[alias]=row['id']
    groups=collections.defaultdict(list)
    for row in trades['records']:
        if isinstance(row,dict) and str(row.get('building','')).strip():
            groups[normalized(row['building'])].append(row)
    appended,linked=0,0
    date=trades.get('checked_at','')[:10]
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date):
        date=datetime.now(KST).strftime('%Y-%m-%d')
    for key,records in sorted(groups.items()):
        label=str(records[0]['building']).strip()
        if key in fixed_aliases:
            target=by_id[fixed_aliases[key]]
            if key not in by_alias:
                if len(target.get('aliases') or [])>=10:raise ValueError('Too many aliases for '+target['id'])
                target['aliases'].append(label)
                by_alias[key]=target['id']
                linked+=1
            continue
        if key in by_alias:continue
        record_id=trade_id(label)
        if record_id in by_id:
            # Only reuse when a JS-generated transaction ID agrees with its label.
            if normalized(by_id[record_id]['label'])!=key:raise ValueError('Transaction id collision '+label)
            continue
        years=sorted({str(r.get('building_year','')).strip() for r in records
                      if re.fullmatch(r'\d{4}',str(r.get('building_year','')).strip())})
        item={
            'id':record_id,'label':label,'aliases':[label],
            'catalog_source':'trades',
            'households':None,'buildings':None,'approved_date':None,
            'heating':None,'parking_total':None,'ev_chargers':None,
            'management_phone':None,'builder':None,'floors':None,
            'floor_area_ratio':None,'building_coverage_ratio':None,
            'area_types_m2':[],'supply_type_labels':[],'floorplans':[],
            'schools':[],
            'source_url':'https://rt.molit.go.kr/',
            'detail_source':'국토교통부 송도동 아파트 실거래명 (건축년도는 별도 확인)',
            'last_verified':date,
            'observed_trade_count':len(records),
            'observed_building_year':years[0] if len(years)==1 else None,
            'detail_note':'국토부 실거래에 등장한 단지명입니다. K-apt 세대수·동수·준공일 등 단지 기본정보는 확인 전입니다.'
        }
        if label in SUBCOMPLEX:
            parent=SUBCOMPLEX[label]
            if parent not in by_id:raise ValueError('Missing aggregated parent '+parent)
            item['parent_catalog_id']=parent
            item['detail_note']+=' K-apt에는 상위 묶음 단지로 등록되어 있으므로 총세대수 등을 이 구분 단지에 그대로 적용하지 않습니다.'
        existing.append(item)
        by_id[record_id]=item
        by_alias[key]=record_id
        appended+=1
    return catalog,appended,linked

def main():
    catalog=json.loads(CATALOG.read_text(encoding='utf8'))
    trades=json.loads(TRADES.read_text(encoding='utf8'))
    result,n,aliases=build(catalog,trades)
    print('Additional transaction-based apartment entries:',n)
    print('Registered exact trade-name aliases:',aliases)
    print('Final persistent catalog entries:',len(result['records']))
    print('Trade-only profiles:',sum(x.get('catalog_source')=='trades' for x in result['records']))
    result['updated_at']=datetime.now(KST).strftime('%Y-%m-%d')
    result['note']='K-apt 공식 단지정보 + 기존 13개 검증 단지 + 송도동 아파트 실거래에만 등장한 별도 단지명. 실거래 확인 단지의 세대수·동수·주차·사용승인일 등은 검증 전이며 K-apt 묶음 단지와 중복될 수 있습니다. 동일 단지의 실거래 명칭 차이는 aliases로 통합.'
    tmp=CATALOG.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    tmp.replace(CATALOG)

if __name__=='__main__':
    main()
