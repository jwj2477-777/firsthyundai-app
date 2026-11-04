# 퍼스트현대 공공데이터 API 신청 순서 (2026-10-20)

> 실제 키는 채팅, 공개 GitHub 코드, 앱 화면에 절대로 붙여넣지 않습니다. 승인/신청 **여부만** 공유하세요.

## 이미 앱 수집 코드에 연결된 서비스

- 국토교통부 아파트 매매 및 전월세 공개 실거래
- K-apt 공동주택 단지목록제공 및 기본정보제공 (README v1.7 실제 인증 및 송도 단지 수집 확인)
- 기존 GitHub Secrets: `DATA_GO_KR_SERVICE_KEY`; 기존 값을 덮어쓰지 말고, 새 공공데이터포털 API마다 별도로 활용신청합니다.

## 새로 신청할 서비스 (실무 우선순위)

| 순서 | 공식 서비스 | 공식 신청 | 앱 기능 및 상태 |
|---|---|---|---|
| 1 | 건축HUB 건축물대장 | https://www.data.go.kr/data/15134735/openapi.do | 아파트 상세 건축·전유공용면적; 응답 검증 후 수집 |
| 2 | 공동주택관리비(공용관리비) | https://www.data.go.kr/data/15057937/openapi.do | 월별 단지 공용관리비 비교; 세대별 청구액 아님 |
| 3 | 나이스 학교 기본정보 | https://open.neis.go.kr/portal/guide/apiGuidePage.do | 송도 학교 목록 수집기 구현됨; 인증키 `NEIS_EDU_KEY` 필요 |
| 4 | 도로명주소 검색 API | https://business.juso.go.kr/ | 주소 표준화; 승인키 `JUSO_CONFIRM_KEY` 연결 예정 |
| 5 | 오피스텔 전월세 실거래 | https://www.data.go.kr/data/15126475/openapi.do | 아파트와 분리된 오피스텔 전월세 수집기 구현됨; 추가 승인 필요 |
| 6 | 청약홈 분양정보 | https://www.data.go.kr/data/15098547/openapi.do | 송도 청약/분양 일정 및 공고; 승인 후 수집기 구현 |
| 자료 다운로드 | 학구도 공간정보 | https://schoolzone.emac.kr/publicData/publicDataList.do | 초등 통학구역·중학교 학구/학교군 SHP, 학교 연계 자료 다운로드. API 인증키 발급과 다름 |

선택 확장: 청약홈 청약 경쟁률 API https://www.data.go.kr/data/15098905/openapi.do

공공데이터포털 활용목적 예시:

> 인천 송도동의 아파트·오피스텔 중개업무를 지원하는 사무실 전용 안드로이드 앱 개발. 건축물, 단지별 공용관리비, 실거래가, 학교 기본정보, 주소 및 분양 공고를 공공데이터로 확인하고 출처·갱신일을 표시하여 조회 및 비교에 활용할 예정입니다.

## 비밀키 저장

- 공공데이터포털 서비스키: 기존 `DATA_GO_KR_SERVICE_KEY`를 사용; **각 서비스별** 활용승인이 필요합니다.
- 나이스 키: `NEIS_EDU_KEY` (코드에서 실제 참조하는 이름; 오래된 `NEIS_API_KEY`가 아님).
- 주소 API: `JUSO_CONFIRM_KEY` (향후 연동 예정; 오래된 `JUSO_API_KEY`가 아님).
- GitHub 저장 위치: https://github.com/jwj2477-777/firsthyundai-app/settings/secrets/actions

## 상태 확인 및 후속 작업

- 사용자에게 필요한 것은 활용신청과 가입/본인인증, 필요시 학구도 파일 내려받기입니다.
- 승인 후 개발자는 API별 응답 구조/권한/레코드 매칭을 검증하고 수집기·앱 UI를 연결합니다.
- 나이스는 학교 기본정보만 제공합니다. **아파트 배정학교는 학구도 경계 + 교육청 고시·예외사항 검증이 필요**합니다.
- 건축물대장에는 개별 호수 등 상세 정보가 포함될 수 있으므로 공개 JSON에는 비식별 단지정보만 게시합니다.
- 평면도와 타입 A/B 이미지는 별도 권리 및 원본 자료 없이는 API로 자동 채우지 않습니다.

## 부동산계산기 · 취득세·양도소득세 (2026-11-04)

- **지금 신청할 것은 민간 부동산계산기.com API 키 단 1개**입니다. 국세청/위택스가 발급하는 키가 아니며, 기존 공공데이터포털 서비스키로 대신할 수 없습니다.
- 신청 링크: https://xn--989a00af8jnslv3dba.com/developers/register
- 서비스 이름: **퍼스트현대 부동산**. 사무실 공식 업무용 이메일, 10자 이상 새 비밀번호 입력. 서비스 주소는 선택사항. 개인정보 대신 서비스용 주소만 사용.
- API 경로: `POST https://calcapi.fran.kr/v1/acquisition` (취득세) 및 `POST https://calcapi.fran.kr/v1/transfer` (양도세). **둘 다 같은 `Authorization: Bearer rck_...` 키 사용.**
- 사업자/업무용 이용 조건과 출처 표시 정책은 https://xn--989a00af8jnslv3dba.com/developers/guide 및 https://xn--989a00af8jnslv3dba.com/developers/terms 확인; 무료 한도(등록형): 500회/시간, 3천회/일, 5만회/월. 제공자와 제휴한 것처럼 표현하거나 출처를 숨기지 않음.
- **키 보안:** 이 저장소는 공개 저장소이고 app/assets는 사용자에게 배포됩니다. 키를 WebView JavaScript, 앱 내부 APK, URL, 사용자의 채팅, GitHub 이슈/PR/CI 로그, 공유 메모에 기재하거나 붙여넣지 말 것. 향후 인증된 Cloudflare Worker의 **비공개 secret** (예: `CALC_API_KEY`)에 직접 등록해야 함. 기존 키 덮어쓰기 금지.
- **현재 v2.1.79 상태:** 중개보수·대출이자·전월세 전환은 앱 내 로컬 계산 완료. 세금은 공식/민간 외부 링크로 열고, 계산 결과를 앱이 받아오거나 세금 API 호출은 하지 않음. 키 발급 후 API 응답 검증, 요청 필수조건(주택수, 조정지역, 면적, 취득일/양도일, 필요경비/공동명의 등), 고객 정보 최소화, 출처 링크 표시, 한도/오류 대응과 비공개 API 프록시 인증을 완성한 다음 연결.

- **v2.1.80 구현 추가:** GitHub Actions `CALC_API_KEY`를 `.github/workflows/deploy-shared-settings.yml`에서 Cloudflare Worker 비공개 Secret에 배포하고, `/board/tax/calculate`로 인증된 4대 사무실 기기만 호출합니다. v2.1.80 앱에는 취득세·양도소득세 입력·결과 화면이 있으며 provider 응답에서 금액과 근거를 텍스트로 보여줍니다. API 호출은 실인증/무료쿼터 확인에 성공해야 실제 사용 가능합니다. 배포 확인 전에는 키 작동을 단정하지 마세요.
- **개발자 점검:** GitHub Actions `Deploy Shared Office Settings` 실행 이력의 `Install optional private realty calculator API key` 성공 확인. 키 내용은 로그에 남기지 않습니다. Worker's `CALC_API_KEY`는 기존 `DATA_GO_KR_SERVICE_KEY`와 다른 별도 비밀입니다.
