#!/usr/bin/env python3
"""Describe data.go.kr school-district files around Songdo. No keys, no personal data."""
import csv, io, json, zipfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import shapefile
from pyproj import Transformer
UA={'User-Agent':'Mozilla/5.0 FirstHyundai-SchoolZoneProbe','Referer':'https://www.data.go.kr/'}
def get(u):
    with urlopen(Request(u,headers=UA),timeout=180) as r: return r.read(300_000_000)
def download(pk,uddi):
    m=json.loads(get('https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?'+urlencode({'recommendDataYn':'','publicDataPk':pk,'publicDataDetailPk':uddi,'fileDetailSn':'1'})))
    v=m.get('fileDataRegistVO') or {}
    return get('https://www.data.go.kr/cmm/cmm/fileDownload.do?'+urlencode({'atchFileId':m.get('atchFileId') or v.get('atchFileId'),'fileDetailSn':str(m.get('fileDetailSn') or v.get('fileDetailSn') or '1')}))
SONGDO=(126.62,37.36,126.70,37.42)  # lon/lat box
for name,pk,uddi in (('elementary','15159265','uddi:fe8b71fa-5321-4d89-b6bb-a9a6ddd2fa8c'),('middle','15159264','uddi:0dae54bb-7464-4e01-9d82-c4b901686200')):
    z=zipfile.ZipFile(io.BytesIO(download(pk,uddi)))
    names={n.rsplit('.',1)[-1].lower():n for n in z.namelist()}
    prj=z.read(names['prj']).decode('utf-8','replace'); print('ZPRJ',name,prj[:200])
    cpg=z.read(names['cpg']).decode() if 'cpg' in names else 'cp949'
    r=shapefile.Reader(shp=io.BytesIO(z.read(names['shp'])),shx=io.BytesIO(z.read(names['shx'])),dbf=io.BytesIO(z.read(names['dbf'])),encoding=cpg.strip() or 'cp949')
    print('ZFIELDS',name,cpg,r.shapeType,len(r),[f[0] for f in r.fields[1:]])
    tf=Transformer.from_crs(prj,'EPSG:4326',always_xy=True)
    hits=0
    for sr in r.iterShapeRecords():
        x0,y0,x1,y1=sr.shape.bbox
        (a,b)=tf.transform(x0,y0);(c,d)=tf.transform(x1,y1)
        if c<SONGDO[0] or a>SONGDO[2] or d<SONGDO[1] or b>SONGDO[3]: continue
        hits+=1
        if hits<=12: print('ZREC',name,dict(zip([f[0] for f in r.fields[1:]],sr.record)),'parts',len(sr.shape.parts),'pts',len(sr.shape.points))
    print('ZHITS',name,hits)
raw=download('15159266','uddi:0765351b-d4d6-4ca3-85fa-e4e01dbb7963')
text=raw.decode('cp949','replace'); rows=list(csv.reader(io.StringIO(text)))
print('ZLINKHEAD',rows[0]); print('ZLINKN',len(rows))
for row in rows[1:]:
    j=','.join(row)
    if '연수' in j or '송도' in j or '인천' in j and ('신정' in j or '예송' in j or '송일' in j): print('ZLINK',row)
