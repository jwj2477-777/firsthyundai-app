#!/usr/bin/env python3
"""Read-only evidence audit: apartment names in 12-month Songdo trade data vs K-apt catalog.

Comparisons are conservative; fuzzy similarities are potential aliases requiring review.
The data in this file MUST NOT be used to invent households or completion years.
"""
import collections
import difflib
import json
from pathlib import Path
import re
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'complexes.json'
TRADES=ROOT/'data'/'trades.json'

def normalize(value):
    return re.sub(r'[^0-9A-Z가-힣]','',unicodedata.normalize('NFKC',str(value or '')).upper())

def canonical_hint(value):
    s=normalize(value)
    for token in ('아파트','주상복합','송도','더샵','단지'):
        s=s.replace(token,'')
    return s

def audit(catalog, trade):
    valid=trade.get('state') not in ('not_started',None)
    if not valid or not isinstance(trade.get('records'),list) or not trade['records']:
        raise ValueError('공식 실거래가 데이터가 비어 있어 신규 아파트 대조 불가')
    records=catalog['records']
    exact={}
    for c in records:
        for alias in [c.get('label'),*(c.get('aliases') or [])]:
            n=normalize(alias)
            if n:exact.setdefault(n,c['id'])
    byname=collections.Counter()
    years={}
    for row in trade['records']:
        if not isinstance(row,dict):continue
        n=normalize(row.get('building'))
        if not n:continue
        byname[str(row['building']).strip()]+=1
        if row.get('building_year') and str(row['building_year']).isdigit():
            years.setdefault(str(row['building']).strip(),set()).add(str(row['building_year']))
    unmatched=[]
    matched=0
    for label,count in byname.most_common():
        if normalize(label) in exact:
            matched+=1
            continue
        hint=canonical_hint(label)
        near=[]
        for c in records:
            for alias in [c.get('label'),*(c.get('aliases') or [])]:
                other=canonical_hint(alias)
                if hint and other and (hint==other or (len(hint)>=5 and len(other)>=5 and
                       (hint in other or other in hint or difflib.SequenceMatcher(None,hint,other).ratio()>=0.85))):
                    near.append((c['id'],c['label']))
                    break
        unmatched.append({'label':label,'count':count,'near':near[:4],'building_years':sorted(years.get(label,set()))[:4]})
    return {'catalog_registered':len(records),'trade_distinct_names':len(byname),'matched_trade_names':matched,
            'unmatched_trade_names':len(unmatched),'possible_aliases':sum(bool(x['near']) for x in unmatched),
            'candidate_new_names':sum(not x['near'] for x in unmatched),'unmatched':unmatched}

def main():
    catalog=json.loads(CATALOG.read_text(encoding='utf8'))
    trades=json.loads(TRADES.read_text(encoding='utf8'))
    info=audit(catalog,trades)
    for key in ('catalog_registered','trade_distinct_names','matched_trade_names','unmatched_trade_names',
                'possible_aliases','candidate_new_names'):
        print(key,info[key])
    print('unmatched_names:')
    for x in info['unmatched']:
        print(json.dumps(x,ensure_ascii=False))
    print('audit finished, no data files changed')

if __name__=='__main__':
    main()
