"""송도·부동산 키워드 RSS 뉴스 → 중복 제거 + 통계적 자연어 처리 제목 브리핑.

원문 본문을 복제하지 않음. 생성형 LLM이 아님. 정책 시행 여부 등은 확인되지 않음.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'news.json'
KST = timezone(timedelta(hours=9))
TOPICS = {
  '개발·교통': ['송도 GTX-B','송도 롯데몰','송도 워터프런트','송도 11공구','인천 경제자유구역 개발'],
  '분양·입주': ['송도 분양 입주','인천 연수구 아파트 청약'],
  '세금·대출': ['부동산 취득세 양도소득세','주택담보대출 DSR 정책'],
  '정책·규제': ['국토교통부 주택 정책','인천 부동산 규제'],
  # 부동산 외의 문화·학교·생활·기업·사건사고도 모두 지역 뉴스로 수집.
  # 이 범주는 기존 전문 분류 뒤에서 처리되어 이미 분류된 중복 기사를 빼앗지 않음.
  '송도 종합': [
    '인천 송도', '"송도국제도시"', '인천 송도동', '인천 연수구 송도',
    '인천 송도 문화 축제', '인천 송도 학교 교육',
    '인천 송도 주민 생활', '인천 송도 기업 바이오',
    '인천 송도 사건 사고', '인천 송도 관광 행사',
  ],
}
MAX_ITEMS_PER_FEED = 90
MAX_ENTRIES = 300
MAX_BRIEFS = 180
MAX_SOURCES_PER_BRIEF = 10

# 지역 기사에는 송도와 직접 연결되는 지명/교통 키워드가 반드시 있어야 함.
# 전국 부동산 정책은 송도 언급이 없어도 실무에 유효할 수 있음.
LOCAL_NEWS = re.compile(r'송도|연수구|인천대입구|GTX[ ]*[-–]?[ ]*B|워터프런트', re.I)
INCHEON_SONGDO = re.compile(r'송도(?:국제도시|동)?', re.I)
OTHER_SONGDO = re.compile(r'부산(?:시)?\\s*송도|포항(?:시)?\\s*송도|송도해수욕장|송도구름산책로|부산\\s*서구\\s*송도',re.I)
CRIME_REPORT = re.compile(r'검거|적발|단속|수사|체포|경찰|기소',re.I)
HOUSING_NEWS = re.compile(
    r'주택|아파트|부동산|전세|월세|임대|분양|청약|입주|주담대|'
    r'주택담보|대출|DSR|LTV|DTI|취득세|양도세|종부세|보유세|'
    r'가계부채|코픽스|금리|토지거래|재건축|재개발|공급|국토부|국토교통부',
    re.I,
)
SPAM_NEWS = re.compile(
    r'카지노|바카라|토토|먹튀|슬롯|배팅|베팅|룰렛|홀덤|'
    r'도박|스포츠북|온라인[ ]*카지노|보너스[ ]*게임',
    re.I,
)


def relevant_news_title(title, category):
    if category == '송도 종합':
        if not INCHEON_SONGDO.search(title):
            return False
        # 부산·포항의 송도와 관광지 기사는 인천이 함께 명시된 경우에만 허용.
        if OTHER_SONGDO.search(title) and not ('인천' in title or '연수구' in title):
            return False
        # 실제 송도 도박 범죄 보도와 홍보성 도박 스팸을 구별.
        return not SPAM_NEWS.search(title) or bool(CRIME_REPORT.search(title))
    if SPAM_NEWS.search(title):
        return False
    if category in ('개발·교통', '분양·입주'):
        return bool(LOCAL_NEWS.search(title))
    return bool(HOUSING_NEWS.search(title))



def rss_link(query):
    return 'https://news.google.com/rss/search?' + urlencode({'q': query+' when:7d','hl':'ko','gl':'KR','ceid':'KR:ko'})


def parse_rss(payload, category, query):
    root = ET.fromstring(payload)
    result=[]
    for el in root.findall('.//channel/item')[:MAX_ITEMS_PER_FEED]:
        title = (el.findtext('title') or '').strip()
        link = (el.findtext('link') or '').strip()
        pub = (el.findtext('pubDate') or '').strip()
        outlet = (el.findtext('source') or '').strip()
        if not title or not link.startswith('https://'):
            continue
        try:
            published = parsedate_to_datetime(pub).astimezone(KST).isoformat(timespec='seconds')
        except (ValueError, TypeError, IndexError):
            continue
        if not outlet and ' - ' in title:
            outlet = title.rsplit(' - ',1)[-1].strip()
        headline = title.rsplit(' - ',1)[0].strip() if outlet and title.endswith(' - '+outlet) else title
        result.append({'title': headline[:240], 'publisher': outlet[:70] or '매체 미확인',
                       'published_at': published, 'link':link, 'category':category, 'query':query})
    return result


def http_request(url):
    with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0 FirstHyundaiRSS/1.0'}), timeout=35) as r:
        data = r.read(3_000_001)
        if len(data)>3_000_000: raise ValueError('RSS 용량 초과')
        return data


def tokens(headline):
    """한글 명사사전 없이 사용하는 문자 n-gram + 영문 단어."""
    cleaned=re.sub(r'[^0-9가-힣a-zA-Z ]+', ' ', headline.lower())
    parts=cleaned.split()
    terms=[]
    for p in parts:
        if len(p)>=2: terms.append(p)
        if re.search(r'[가-힣]',p):
            terms += [p[i:i+2] for i in range(len(p)-1)]
            if len(p)>=4: terms += [p[i:i+3] for i in range(len(p)-2)]
    return Counter(terms)


def cosine(a,b,idf):
    if not a or not b:return 0.0
    dot=sum((v*idf.get(k,1))*(b.get(k,0)*idf.get(k,1)) for k,v in a.items())
    norm_a=math.sqrt(sum((v*idf.get(k,1))**2 for k,v in a.items()))
    norm_b=math.sqrt(sum((v*idf.get(k,1))**2 for k,v in b.items()))
    return dot/(norm_a*norm_b) if norm_a and norm_b else 0.0


def normalize_title(s):
    return re.sub(r'[^가-힣a-z0-9]','',s.lower())


def deduplicate(rows):
    seen=set(); result=[]
    for item in sorted(rows, key=lambda x:x['published_at'], reverse=True):
        key=(normalize_title(item['title']),item['publisher'])
        if key in seen:continue
        seen.add(key)
        item=dict(item)
        item['id']=hashlib.sha256((item['title']+'\n'+item['publisher']+'\n'+item['published_at']).encode()).hexdigest()[:18]
        result.append(item)
    return result


def make_briefs(news):
    groups=[]
    for cat in TOPICS:
        group=[x for x in news if x['category']==cat]
        if not group:continue
        vectors=[tokens(x['title']) for x in group]
        df=Counter(k for vec in vectors for k in vec)
        idf={k: math.log((len(group)+1)/(n+1))+1 for k,n in df.items()}
        # 간단 TF-IDF 유사도 기반 기사 군집: 최소 2개 출처면 복수보도 표시.
        clusters=[]
        for item,vec in zip(group,vectors):
            matching=None
            best=0.0
            for cluster in clusters:
                similarity=max(cosine(vec, existing_vec, idf) for existing_vec in cluster['vectors'])
                if similarity>best: best=similarity; matching=cluster
            if matching is not None and best>=0.43:
                matching['articles'].append(item)
                matching['vectors'].append(vec)
            else:
                clusters.append({'articles':[item], 'vectors':[vec]})
        for cluster in clusters:
            articles=cluster['articles']
            publishers=sorted({p['publisher'] for p in articles if p['publisher']!='매체 미확인'})
            representative=articles[0]
            briefs_id=hashlib.sha256((cat+'|'+normalize_title(representative['title'])).encode()).hexdigest()[:14]
            groups.append({
                'id':briefs_id,'category':cat,'title':representative['title'],
                'summary': ('관련 기사 '+str(len(articles))+'건, 서로 다른 표기 매체 '+str(len(publishers))+'곳을 발견했습니다. '
                            '아래 원문 제목과 공식 발표를 확인하세요.'),
                'verification':'언론 제목 기반 자동 분류 · 사실 미검증',
                'article_count':len(articles),'publisher_count':len(publishers),
                'last_published_at':representative['published_at'],
                'sources':[{'title':a['title'],'publisher':a['publisher'],
                            'published_at':a['published_at'],'link':a['link']} for a in articles[:MAX_SOURCES_PER_BRIEF]],
            })
    groups.sort(key=lambda x:(x['last_published_at'],x['article_count']), reverse=True)
    return groups[:MAX_BRIEFS]


def update(*, request=http_request, now=None):
    now=now or datetime.now(KST)
    all_rows=[]; errors=[]; success=0
    for category,queries in TOPICS.items():
        for query in queries:
            try:
                url=rss_link(query)
                raw=parse_rss(request(url), category, query)
                # 피드 이상으로 7일보다 오래된 기사 제외
                lower_bound=now-timedelta(days=8)
                raw=[r for r in raw if lower_bound<=datetime.fromisoformat(r['published_at'])<=now+timedelta(hours=2) and relevant_news_title(r['title'],category)]
                all_rows+=raw
                success+=1
                print(f'{category}/{query}: {len(raw)}건')
            except Exception as exc:
                errors.append(f'{category}/{query}: {type(exc).__name__}')
                print(f'[WARN] RSS 실패: {category} / {query}: {exc}')
    if success==0:
        raise RuntimeError('모든 RSS 수집 실패: 기존 뉴스 자료 유지')
    news=deduplicate(all_rows)[:MAX_ENTRIES]
    briefs=make_briefs(news)
    out={
        'schema_version':1,'checked_at':now.isoformat(timespec='seconds'),
        'state':'partial' if errors else 'ok','errors':errors,
        'source':'Google 뉴스 RSS (보도 제목·출처 메타데이터)',
        'brief_method':'무료 통계적 자연어 처리(TF-IDF 유사도). 생성형 AI/팩트체크 아님.',
        'warning':'언론 기사 제목은 공식 확정 발표가 아닙니다. 사업 일정, 세금, 대출, 시행일은 기관 원문 확인 필요.',
        'briefs':briefs,'articles':news,'counts':{'briefs':len(briefs),'articles':len(news)},
    }
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return out


if __name__=='__main__':
    r=update()
    print('뉴스',r['counts'])
