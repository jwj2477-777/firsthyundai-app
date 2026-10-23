#!/usr/bin/env python3
"""Collect explicitly published K-apt-derived monthly total fee / residential m2.
Source is KoreaCharts' public mirror, independently cross-checked by official
K-apt code, road address, billing month, category subtotals and sum.
Not a household invoice. Absent/unavailable pages NEVER yield estimates.
No credentials, browser scraping clients, local input or personal data.
"""
from __future__ import annotations
import json, re, time, os, sys
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'complexes.json'
DEST=ROOT/'data'/'maintenance_estimates.json'
BASE='https://apt.koreacharts.com/apt/'
KAPT='https://www.k-apt.go.kr/'
KST=ZoneInfo('Asia/Seoul')
def now():return datetime.now(KST)
def address_key(s):return re.sub(r'[^가-힣0-9]', '',str(s or '').replace('인천광역시','인천'))
class Tables(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.all_text=[];self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.row=[]
  if tag in ('td','th') and self.row is not None:self.cell=[]
 def handle_data(self,s):
  self.all_text.append(s)
  if self.cell is not None:self.cell.append(s)
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.row is not None and self.cell is not None:
   self.row.append(' '.join(' '.join(self.cell).split()));self.cell=None
  if tag=='tr' and self.row is not None:
   if self.row:self.rows.append(self.row)
   self.row=None
def money(s):
 raw=re.sub(r'\s|,','',str(s))
 return int(raw) if re.fullmatch(r'(?:0|[1-9]\d{0,11})',raw) else None
def parse(html, code, address, limit=None):
 p=Tables();p.feed(html)
 text=' '.join(' '.join(p.all_text).split())
 if len(text)<150 or len(text)>400000:return None
 if not ('국토교통부' in text and ('평균 관리비' in text or '관리비 정보' in text)):
  return None
 # Both source building identity and monthly data must be unambiguous.
 if address_key(address) not in address_key(text):return None
 matches=re.findall(r'(20\d{2})년\s*(\d{1,2})월[^\n]{0,150}?관리비 정보',text)
 if not matches:return None
 # Match only month found in explicit fee summary; if multiple headings exist
 # first monthly headline is sufficient only if the total table exists.
 year,month=matches[0];month_id=f'{year}{int(month):02d}'
 upper=(limit or now()).strftime('%Y%m')
 if month_id>upper:return None
 if int(year)<2024:return None
 result=[]
 for cells in p.rows:
  cleaned=[str(c).strip() for c in cells]
  if cleaned and re.sub(r'\s','',cleaned[0])=='합계' and len(cleaned)>=3:
   a,b=money(cleaned[1]),money(cleaned[2])
   if a is not None and b is not None and 100000<=a<=200000000000 and 300<=b<=20000:
    result.append((a,b))
 if len(set(result))!=1:return None
 total,rate=result[0]
 # Published combined total / unit is a *rounded* display value: do not
 # attempt to sum only public common-fee components from another source.
 if re.search(r'등록된\s*관리비\s*정보가\s*없습니다',text):
  return None
 return dict(kapt_code=code,month=month_id,won_per_exclusive_m2=rate,
  monthly_total_won=total,source_url=BASE+code+'/contents.html',
  method='kapt_published_total_per_residential_exclusive_m2',
  basis='주거전용면적당 공개 관리비 합계 단가 · 실제 세대 청구액 아님')

def download(code):
 url=BASE+code+'/contents.html'
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; FirstHyundai-office-data/1.0)',
             'Accept':'text/html','Accept-Language':'ko-KR'})
 try:
  with urlopen(req,timeout=14) as rsp:
   if rsp.status!=200 or 'html' not in rsp.headers.get('Content-Type','').lower():return None
   raw=rsp.read(500001)
  if len(raw)>500000:return None
  return raw.decode('utf-8','replace')
 except Exception:return None

def collect(catalog,prior=None,fetch=download,pause=0.6,limit=None):
 old={r['complex_id']:r for r in (prior or {}).get('records',[]) if r.get('complex_id')}
 fresh=[];failed=0;scanned=0
 by_code={}
 for r in catalog:
  code=r.get('kapt_code')
  if not r.get('aggregate_only') and re.fullmatch(r'A\d{8}',str(code or '')) and r.get('address') and r.get('id'):
   by_code.setdefault(code,[]).append(r)
 for code,complexes in sorted(by_code.items()):
  # If a K-apt code maps to multiple different road addresses, skip it.
  if len({address_key(x['address']) for x in complexes})!=1:continue
  scanned+=1
  html=fetch(code)
  datum=parse(html,code,complexes[0]['address'],limit) if html else None
  if datum:
   for apt in complexes:
    fresh.append({'complex_id':apt['id'],**datum})
  else:failed+=1
  if pause:time.sleep(pause)
 # Fail closed, but preserve earlier verified snapshots if upstream is down.
 selected={**old,**{x['complex_id']:x for x in fresh}}
 return dict(schema_version=1,state='verified_partial' if selected else 'awaiting_verified_source',
  source='K-apt 공공데이터 재게시 월별 합계 단가',
  updated_at=now().isoformat(),checked_codes=scanned,success_count=len(fresh),
  failed_codes=failed,records=sorted(selected.values(),key=lambda x:x['complex_id']),
  note='주거전용면적당 단지 전체 평균 관리비 합계 단가를 해당 타입의 전용면적에 곱한 상담 참고액. 실제 세대별 평균 고지액이 아닙니다.')

def main():
 catalog=json.loads(CATALOG.read_text(encoding='utf8'))['records']
 prev=json.loads(DEST.read_text(encoding='utf8')) if DEST.exists() else {}
 out=collect(catalog,prev)
 if not out['success_count']:
  print('공개 단가 신규 검증 성공 0 · 기존 자료 보존, 임의 추정 금지');return
 if prev.get('records')==out['records']:
  print('평균 관리비 최신 자료 변동 없음',len(out['records']));return
 DEST.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('공식 K-apt 자료 재게시 단가 검증',out['success_count'],'/',out['checked_codes'],'누적',len(out['records']))
def diagnose():
 # Small public-only probe. No authentication or personal data ever logged.
 from urllib.error import HTTPError, URLError
 urls=[
  BASE+'A10026679/contents.html',
  'https://www.k-apt.go.kr/web/board/webReference/boardView.do?boardSecret=0&boardType=03&pageNo=1&reb=eU1hjW8QKC5j4V3KMvyFEw%3D%3D&scodeT=03&seq=21',
 ]
 for n,url in enumerate(urls):
  try:
   req=Request(url,headers={'User-Agent':'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/125.0 Safari/537.36','Accept':'text/html','Accept-Language':'ko-KR,ko;q=0.9'})
   with urlopen(req,timeout=12) as response:
    raw=response.read(500001)
    html=raw.decode('utf-8','replace')
    status=response.status
    parsed=parse(html,'A10026679','인천광역시 연수구 컨벤시아대로252번길 30') if n==0 else None
    print('KAPT_PROBE',n,'HTTP',status,'bytes',len(raw),
          'road=',str('컨벤시아대로252번길 30' in html),
          'total=',str('합계' in html),
          'parsed=',str(bool(parsed)))
  except HTTPError as e:print('KAPT_PROBE',n,'HTTP',e.code)
  except (URLError,TimeoutError,OSError) as e:print('KAPT_PROBE',n,'CONNECT_ERROR',type(e).__name__)
if __name__=='__main__':
 if '--diagnose' in sys.argv:diagnose()
 else:main()
