#!/usr/bin/env python3
"""Official Schoolinfo base-directory + Korean education facilities SHP zone matcher.

Source: user supplied 2026-09-20 official EPSG:5186 shapefile, compact
EPSG:4326 polygons in data/school_zones_yeonsu.json.
Kakao geocoding and Schoolinfo are independent optional secret-backed steps.
No location means NO assignment; 35m boundary buffer rejects near-edge guesses.
"""
from __future__ import annotations
import json,math,os,re,sys
from datetime import datetime,timezone,timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

ROOT=Path(__file__).resolve().parents[1]
ZONES=ROOT/'data'/'school_zones_yeonsu.json'
CATALOG=ROOT/'data'/'complexes.json'
TARGET=ROOT/'data'/'school_districts.json'
KST=timezone(timedelta(hours=9))
SCHOOLINFO='https://www.schoolinfo.go.kr/openApi.do'
KAKAO='https://dapi.kakao.com/v2/local/search/address.json'
SCHOOLINFO_SOURCE='https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l0.do'
ZONE_SOURCE='https://schoolzone.emac.kr/publicData/publicDataList.do'

def stamp():return datetime.now(KST).isoformat(timespec='seconds')

def get_json(url,headers=None,opener=None):
    req=Request(url,headers={'User-Agent':'FirstHyundai-SchoolDistricts/1.0',
       'Accept':'application/json',**(headers or {})})
    try:
        if opener: raw=opener(req)
        else:
            with urlopen(req,timeout=20) as rsp:raw=rsp.read(2_000_001)
        if len(raw)>2_000_000:raise RuntimeError('공식 API 응답 용량 초과')
        return json.loads(raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw)
    except (HTTPError,URLError,TimeoutError,OSError,ValueError) as exc:
        # URLs contain private auth keys; never print requests, exception str, or response bodies.
        raise RuntimeError('공식 API 연결 또는 응답 검증 실패') from None

def decode_ring(encoded):
    lat=lng=0;items=[];numbers=[];i=0
    while i<len(encoded):
        value=0;shift=0
        while True:
            if i>=len(encoded) or shift>35:raise ValueError('Invalid encoded school zone ring')
            n=ord(encoded[i])-63;i+=1
            if n<0:raise ValueError('Bad school zone character')
            value|=(n&31)<<shift;shift+=5
            if n<32:break
        numbers.append((value>>1)^(-(value&1)))
    if len(numbers)%2:raise ValueError('Odd school zone coordinates')
    for j in range(0,len(numbers),2):
        lat+=numbers[j];lng+=numbers[j+1]
        items.append((lng/1e5,lat/1e5))
    if len(items)<4 or items[0]!=items[-1]:raise ValueError('Unclosed zone polygon')
    return items

def contains(ring,lon,lat):
    inside=False
    for i in range(len(ring)-1):
        x1,y1=ring[i];x2,y2=ring[i+1]
        if (y1>lat)!=(y2>lat) and lon<(x2-x1)*(lat-y1)/(y2-y1)+x1:
            inside=not inside
    return inside

def edge_distance(ring,lon,lat):
    # Distance from each boundary segment in meters. Approximation within Yeonsu-gu.
    scale_x=111320*math.cos(math.radians(lat));scale_y=111320
    shortest=float('inf')
    for i in range(len(ring)-1):
        ax=(ring[i][0]-lon)*scale_x;ay=(ring[i][1]-lat)*scale_y
        bx=(ring[i+1][0]-lon)*scale_x;by=(ring[i+1][1]-lat)*scale_y
        dx=bx-ax;dy=by-ay
        t=max(0,min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
        shortest=min(shortest,math.hypot(ax+t*dx,ay+t*dy))
    return shortest

def zone_matches(zones,lon,lat):
    out=[]
    for z in zones:
        for polygon in z['rings']:
            rings=[decode_ring(v) for v in polygon]
            if contains(rings[0],lon,lat) and not any(contains(h,lon,lat) for h in rings[1:]):
                distance=min(edge_distance(r,lon,lat) for r in rings)
                out.append((z,distance))
                break
    return out

def normalized_address(v):
    return re.sub(r'\s+','',str(v or '')).replace('인천광역시','인천')

def collect_kakao_coordinates(catalog,key,opener=None):
    by_address={};points=[]
    if not key:return []
    for p in catalog:
        addr=str(p.get('address') or '').strip()
        if not (p.get('id') and addr.startswith('인천광역시 연수구 ') and not p.get('aggregate_only')):
            continue
        if addr not in by_address:
            url=KAKAO+'?'+urlencode({'query':addr,'analyze_type':'exact','page':1,'size':5})
            try:
                response=get_json(url,{'Authorization':'KakaoAK '+key},opener)
                docs=response.get('documents',[])
                matches=[]
                for d in docs if isinstance(docs,list) else []:
                    road=d.get('road_address') or {}
                    actual=road.get('address_name')
                    if not actual or normalized_address(actual)!=normalized_address(addr):continue
                    try:x=float(road['x']);y=float(road['y'])
                    except (KeyError,TypeError,ValueError):continue
                    if 126.5<x<126.8 and 37.3<y<37.5:
                        lot=str((d.get('address') or {}).get('address_name') or '').strip()
                        if lot.startswith('인천 '):lot='인천광역시 '+lot[len('인천 '):]
                        if not re.fullmatch(r'인천광역시 연수구 송도동 [0-9]{1,4}(?:-[0-9]{1,4})?',lot):lot=''
                        matches.append((x,y,lot))
                # More than one distinct exact-address coordinate is ambiguous.
                unique=set((round(x,6),round(y,6)) for x,y,_ in matches)
                if len(unique)==1:
                    xy=next(iter(unique))
                    lots={lot for x,y,lot in matches if lot}
                    # Ambiguous cadastral addresses must not be published as facts.
                    lot=next(iter(lots)) if len(lots)==1 else ''
                    by_address[addr]=(xy[0],xy[1],lot)
                else:by_address[addr]=None
            except RuntimeError:
                by_address[addr]=None
        coord=by_address[addr]
        if coord:points.append({'id':p['id'],'label':p['label'],'address':addr,
            'lng':coord[0],'lat':coord[1],**({'lot_address':coord[2]} if coord[2] else {})})
    return points

def collect_schoolinfo(key,opener=None):
    if not key:raise RuntimeError('Schoolinfo secret missing')
    chosen={}
    for level,category in [('02','초등학교'),('03','중학교'),('04','고등학교')]:
        # All keys issued in 2026 require municipality (28185 = Incheon Yeonsu).
        url=SCHOOLINFO+'?'+urlencode({'apiKey':key,'apiType':'0','sidoCode':'28',
                      'sggCode':'28185','schulKndCode':level})
        data=get_json(url,opener=opener)
        if str(data.get('resultCode','')).lower()!='success' or not isinstance(data.get('list'),list):
            raise RuntimeError('Schoolinfo did not return confirmed success for school level '+level)
        if len(data['list'])>300:raise RuntimeError('Schoolinfo abnormal response size')
        for r in data['list']:
            if not isinstance(r,dict):continue
            code=str(r.get('SCHUL_CODE') or '').strip()
            name=str(r.get('SCHUL_NM') or r.get('SCHUL_NAME') or '').strip()
            name=name or str(r.get('SCHUL_NM_KOR') or '').strip()
            if not re.fullmatch(r'S\d{9}',code) or not 2<=len(name)<=80:continue
            if str(r.get('CLOSE_YN','N')).upper()!='N':continue
            # 28185 is the mandatory governmental server filter; don't fabricate numbers.
            chosen[code]={'code':code,'name':name,'level':category,
              'source_url':SCHOOLINFO_SOURCE}
    if not chosen:raise RuntimeError('Schoolinfo returned no validated Yeonsu schools')
    return sorted(chosen.values(),key=lambda x:(x['level'],x['name']))

def build_assignments(zones,points):
    rows=[]
    for p in points:
        matches=zone_matches(zones,p['lng'],p['lat'])
        # Only a single ordinary polygon with >=35m clearance can be shown.
        # The simplified original polygon has ~10m resolution; farther points are reliable.
        if len(matches)!=1 or matches[0][0]['kind']!='0' or matches[0][1]<35:
            continue
        zone,distance=matches[0]
        rows.append({'complex_id':p['id'],'zone_id':zone['id'],'zone_name':zone['name'],
              'kind':'elementary_zone_reference','method':'verified_exact_kakao_road_address',
              'boundary_clearance_m':int(distance),'reference_date':'2026-09-20'})
    return rows

def review_unmatched_zones(zones, points, catalog, confirmed):
    """Give each missing site a precise verification *reason*, not an invented school."""
    by_id={p['id']:p for p in points}
    confirmed_ids={row['complex_id'] for row in confirmed}
    reasons=[]
    for complex_ in catalog:
        ident=complex_.get('id')
        if not ident or complex_.get('aggregate_only') or ident in confirmed_ids:
            continue
        p=by_id.get(ident)
        if not p:
            reason='address_unverified'
        else:
            matches=zone_matches(zones,p['lng'],p['lat'])
            if not matches:reason='outside_official_polygon'
            elif len(matches)>1:reason='overlapping_zones'
            elif matches[0][0].get('kind')!='0':reason='joint_zone'
            elif matches[0][1]<35:reason='near_boundary'
            else:
                # A verified normal polygon should have entered confirmed.
                reason='requires_manual_review'
        reasons.append({'complex_id':ident,'reason':reason,
                        'reference_date':'2026-09-20'})
    return reasons


def main():
    zones=json.loads(ZONES.read_text(encoding='utf-8'))
    if len(zones.get('zones',[]))!=34 or zones.get('reference_date')!='2026-09-20':
        raise RuntimeError('Invalid official 2026-09 school zone source')
    current=json.loads(TARGET.read_text(encoding='utf-8'))
    if current.get('schema_version')!=1:raise RuntimeError('Invalid cached school snapshot')
    updated=False
    key=os.environ.get('SCHOOLINFO_API_KEY','').strip()
    if key:
        try:
            schools=collect_schoolinfo(key)
            current['schoolinfo']={'state':'verified','updated_at':stamp(),
                'source_url':SCHOOLINFO_SOURCE,'records':schools,
                'note':'학교알리미 공식 학교기본정보(연수구 시군구코드 28185). 아파트 배정과 무관.'}
            updated=True
            print('학교알리미 기본정보 수집·검증',len(schools),'학교')
        except RuntimeError as e:print('학교알리미 연동 확인 전 · 기존 데이터 유지:',str(e))
    else:print('학교알리미 GitHub Secret SCHOOLINFO_API_KEY 미설정 · 기존 자료 보존')
    kakao=os.environ.get('KAKAO_REST_API_KEY','').strip()
    if kakao:
        catalog=json.loads(CATALOG.read_text(encoding='utf-8')).get('records',[])
        points=collect_kakao_coordinates(catalog,kakao)
        if points:
            cadastral=[{'complex_id':p['id'],'road_address':p['address'],
                        'lot_address':p['lot_address'],'source':'exact_kakao_address_search'}
                       for p in points if p.get('lot_address')]
            if cadastral:
                current['lot_addresses']={'state':'verified_partial','updated_at':stamp(),
                  'records':cadastral,'source_url':'https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord',
                  'note':'도로명주소 완전 일치 후 카카오 주소검색이 같은 건물의 지번을 반환한 경우만 기록.'}
                updated=True
                print('공식 도로명주소와 일치 확인된 지번',len(cadastral),'단지')
            assigns=build_assignments(zones['zones'],points)
            reasons=review_unmatched_zones(zones['zones'],points,catalog,assigns)
            current['zone_review']={
              'state':'verification_pending','updated_at':stamp(),
              'reference_date':zones['reference_date'],
              'source_url':ZONE_SOURCE,'records':reasons,
              'note':'아파트 배정학교 정보가 아닙니다. 원본 경계와 주소 검증이 부족한 이유만 나타냅니다.'}
            updated=True
            print('초등 통학구역 보류 사유 분류',len(reasons),'단지')
            if assigns:
                current['elementary_zones']={'state':'verified_partial','updated_at':stamp(),
                  'reference_date':zones['reference_date'],'source_url':ZONE_SOURCE,
                  'geocoded_complex_count':len(points),'records':assigns,
                  'note':'정확한 도로명주소 지오코딩 + 공식 통학구역 도형 내부 35m 이상 단지만 표시. 배정 보장 아님.'}
                updated=True
                print('좌표 검증 단지',len(points),'· 통학구역 내부 충분히 이격된 단지',len(assigns))
            else:print('통학구역 경계와 충분히 이격된 단지 없음 · 기존 데이터 유지')
        else:print('카카오 도로명좌표 검증 실패 · 기존 데이터 보존')
    else:print('KAKAO_REST_API_KEY 미설정 · 단지별 통학구역은 검증 대기')
    if updated:
        current['state']=('verified_partial' if
            current.get('schoolinfo',{}).get('state')=='verified' and
            current.get('elementary_zones',{}).get('state')=='verified_partial' else
            'awaiting_verified_sources')
        current['updated_at']=stamp()
        tmp=TARGET.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        tmp.replace(TARGET)
    else:print('새 검증결과 없음 · 기존 파일 유지')

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,RuntimeError,TypeError) as exc:
        print('학교자료 게시 중지: '+str(exc)[:130],file=sys.stderr)
        sys.exit(2)
