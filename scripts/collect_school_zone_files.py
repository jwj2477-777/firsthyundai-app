#!/usr/bin/env python3
"""Official school-district (학구도) geometry for Yeonsu-gu at ORIGINAL precision.

Source: data.go.kr 한국교육시설안전원 학구도 파일데이터 (배포 3월·9월, 이용허락 제한 없음)
 - 15159265 초등학교통학구역 (SHP, EPSG:5186)
 - 15159264 중학교학교군      (SHP, EPSG:5186)
 - 15159266 학교학구도연계정보 (CSV, 학구ID ↔ 학교명)

The earlier zone file was simplified to ~10 m, which forced a 35 m safety margin
and left complexes near a boundary unresolved. This keeps the published vertices
(polyline 1e-5 deg ≈ 1 m rounding). Requires: pip install pyshp pyproj.
No keys are used; nothing personal is read or written. On any validation failure
the previous files are left untouched.
"""
from __future__ import annotations
import csv, io, json, re, sys, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ZONES = ROOT / 'data' / 'school_zones_yeonsu.json'
MIDDLE = ROOT / 'data' / 'school_middle_groups_yeonsu.json'
KST = timezone(timedelta(hours=9))
UA = {'User-Agent': 'Mozilla/5.0 FirstHyundai-SchoolZones/1.0', 'Referer': 'https://www.data.go.kr/'}
DATASETS = {
    'elementary': ('15159265', 'uddi:fe8b71fa-5321-4d89-b6bb-a9a6ddd2fa8c'),
    'middle': ('15159264', 'uddi:0dae54bb-7464-4e01-9d82-c4b901686200'),
    'link': ('15159266', 'uddi:0765351b-d4d6-4ca3-85fa-e4e01dbb7963'),
}
LANDING = 'https://www.data.go.kr/data/{}/fileData.do'
INCHEON, YEONSU = '28', '185'
# Middle-school groups that can contain a Songdo/Yeonsu complex (lon/lat box).
YEONSU_BOX = (126.58, 37.34, 126.73, 37.45)
REQUIRED_ELEMENTARY = ('인천예송초통학구역', '인천송일초통학구역', '인천신정초통학구역')


def fetch(url, limit=300_000_000):
    with urlopen(Request(url, headers=UA), timeout=180) as rsp:
        data = rsp.read(limit + 1)
    if len(data) > limit:
        raise RuntimeError('download too large')
    return data


def download(pk, uddi):
    meta = json.loads(fetch('https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?' + urlencode(
        {'recommendDataYn': '', 'publicDataPk': pk, 'publicDataDetailPk': uddi, 'fileDetailSn': '1'}), 2_000_000))
    reg = meta.get('fileDataRegistVO') or {}
    atch = meta.get('atchFileId') or reg.get('atchFileId')
    sn = str(meta.get('fileDetailSn') or reg.get('fileDetailSn') or '1')
    if not atch or not re.fullmatch(r'[A-Za-z0-9_]{6,80}', str(atch)):
        raise RuntimeError('download id missing')
    return fetch('https://www.data.go.kr/cmm/cmm/fileDownload.do?' + urlencode({'atchFileId': atch, 'fileDetailSn': sn}))


def encode(points):
    """Google polyline (lat, lng) at 1e-5 degrees, matching collect_schoolinfo.decode_ring."""
    out, plat, plng = [], 0, 0
    for lng, lat in points:
        ilat, ilng = round(lat * 1e5), round(lng * 1e5)
        for value in (ilat - plat, ilng - plng):
            value = ~(value << 1) if value < 0 else value << 1
            while value >= 0x20:
                out.append(chr((0x20 | (value & 0x1f)) + 63))
                value >>= 5
            out.append(chr(value + 63))
        plat, plng = ilat, ilng
    return ''.join(out)


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:]))


def polygons(shape, transform):
    """Shapefile parts → [[outer, hole, ...], ...]. Outer rings are clockwise in SHP."""
    parts = list(shape.parts) + [len(shape.points)]
    result = []
    for a, b in zip(parts, parts[1:]):
        projected = [transform(x, y) for x, y in shape.points[a:b]]
        ring = [(round(x, 6), round(y, 6)) for x, y in projected]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        if len(ring) < 4:
            continue
        if signed_area(ring) < 0 or not result:   # clockwise → new outer ring
            result.append([ring])
        else:
            result[-1].append(ring)
    return result


def read_shp(raw):
    import shapefile
    from pyproj import Transformer
    z = zipfile.ZipFile(io.BytesIO(raw))
    names = {n.rsplit('.', 1)[-1].lower(): n for n in z.namelist()}
    for part in ('shp', 'shx', 'dbf', 'prj'):
        if part not in names:
            raise RuntimeError('incomplete shapefile')
    encoding = (z.read(names['cpg']).decode('ascii', 'replace').strip() if 'cpg' in names else '') or 'cp949'
    reader = shapefile.Reader(shp=io.BytesIO(z.read(names['shp'])), shx=io.BytesIO(z.read(names['shx'])),
                              dbf=io.BytesIO(z.read(names['dbf'])), encoding=encoding)
    tf = Transformer.from_crs(z.read(names['prj']).decode('utf-8', 'replace'), 'EPSG:4326', always_xy=True)
    fields = [f[0] for f in reader.fields[1:]]
    for item in reader.iterShapeRecords():
        yield dict(zip(fields, item.record)), item.shape, tf.transform


def school_links(raw):
    text = raw.decode('cp949', 'replace')
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or rows[0][:3] != ['학구ID', '학교ID', '학교명']:
        raise RuntimeError('unexpected link header')
    links = {}
    for row in rows[1:]:
        if len(row) >= 4 and re.fullmatch(r'Z[0-9]{9}', row[0]) and row[2]:
            links.setdefault(row[0], set()).add((row[2].strip(), row[3].strip()))
    return links


def in_box(bbox):
    lon0, lat0, lon1, lat1 = bbox
    return not (lon1 < YEONSU_BOX[0] or lon0 > YEONSU_BOX[2] or lat1 < YEONSU_BOX[1] or lat0 > YEONSU_BOX[3])


def build(elementary_raw, middle_raw, link_raw):
    links = school_links(link_raw)
    def schools(zone_id, level):
        return sorted(name for name, lv in links.get(zone_id, ()) if lv == level)
    zones, dates = [], set()
    for rec, shape, tf in read_shp(elementary_raw):
        if str(rec.get('SD_CD')) != INCHEON or str(rec.get('SGG_CD')) != YEONSU:
            continue
        polys = polygons(shape, tf)
        if not polys:
            continue
        zid, name, kind = str(rec['HAKGUDO_ID']), str(rec['HAKGUDO_NM']).strip(), str(rec['HAKGUDO_GB']).strip()
        if not re.fullmatch(r'Z[0-9]{9}', zid) or not name.endswith('통학구역') or kind not in ('0', '1'):
            raise RuntimeError('unexpected elementary record')
        dates.add(str(rec.get('BASE_DT')))
        zones.append({'id': zid, 'name': name, 'kind': kind, 'schools': schools(zid, '초등학교'),
                      'rings': [[encode(r) for r in poly] for poly in polys]})
    groups = []
    for rec, shape, tf in read_shp(middle_raw):
        if str(rec.get('SD_CD')) != INCHEON:
            continue
        polys = polygons(shape, tf)
        lons = [x for poly in polys for ring in poly for x, _ in ring]
        lats = [y for poly in polys for ring in poly for _, y in ring]
        if not lons or not in_box((min(lons), min(lats), max(lons), max(lats))):
            continue
        zid = str(rec['HAKGUDO_ID'])
        dates.add(str(rec.get('BASE_DT')))
        groups.append({'id': zid, 'name': str(rec['HAKGUDO_NM']).strip(), 'kind': str(rec['HAKGUDO_GB']).strip(),
                       'schools': schools(zid, '중학교'),
                       'rings': [[encode(r) for r in poly] for poly in polys]})
    if len(dates) != 1 or not re.fullmatch(r'20[0-9]{2}-[01][0-9]-[0-3][0-9]', next(iter(dates))):
        raise RuntimeError('inconsistent reference dates')
    reference = next(iter(dates))
    names = {z['name'] for z in zones}
    if not 20 <= len(zones) <= 80 or any(n not in names for n in REQUIRED_ELEMENTARY):
        raise RuntimeError('elementary zones failed sanity check')
    if not 1 <= len(groups) <= 8 or not any(g['schools'] for g in groups):
        raise RuntimeError('middle-school groups failed sanity check')
    zones.sort(key=lambda z: z['id']); groups.sort(key=lambda g: g['id'])
    now = datetime.now(KST).isoformat(timespec='seconds')
    zone_doc = {'schema_version': 1, 'state': 'verified_geometry_only', 'reference_date': reference,
                'precision': 'original', 'crs': 'EPSG:4326', 'simplified_degrees': 0, 'updated_at': now,
                'original_source': '한국교육시설안전원_초등학교통학구역 (data.go.kr 15159265, EPSG:5186)',
                'source_url': LANDING.format(DATASETS['elementary'][0]), 'region': '인천광역시 연수구',
                'note': '공식 SHP 원본 꼭짓점(약 1m 반올림). 학교명은 학교학구도연계정보 기준. '
                        '공동통학구역은 자동 단일학교 배정 금지.', 'zones': zones}
    middle_doc = {'schema_version': 1, 'state': 'verified_geometry_only', 'reference_date': reference,
                  'precision': 'original', 'crs': 'EPSG:4326', 'updated_at': now,
                  'original_source': '한국교육시설안전원_중학교학교군 (data.go.kr 15159264, EPSG:5186)',
                  'source_url': LANDING.format(DATASETS['middle'][0]), 'region': '인천광역시 연수구 인근',
                  'note': '중학교는 학교군 단위 배정(학교군 안 여러 학교 중 배정). 특정 학교 확정 아님.',
                  'groups': groups}
    return zone_doc, middle_doc


def write(path, doc):
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    tmp.replace(path)


def main():
    try:
        raw = {k: download(*v) for k, v in DATASETS.items()}
        zone_doc, middle_doc = build(raw['elementary'], raw['middle'], raw['link'])
    except Exception as exc:  # network, format or sanity failure: keep last good files
        print('학구도 원본 갱신 보류 · 기존 파일 유지:', type(exc).__name__, str(exc)[:120])
        return 0
    write(ZONES, zone_doc)
    write(MIDDLE, middle_doc)
    print('학구도 원본', zone_doc['reference_date'], '초등 통학구역', len(zone_doc['zones']),
          '· 중학교 학교군', len(middle_doc['groups']),
          [(g['name'], len(g['schools'])) for g in middle_doc['groups']])
    return 0


if __name__ == '__main__':
    sys.exit(main())
