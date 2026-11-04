### 2026-11-04 · 부동산계산기.com 무료 API 키 발급/등록 후 세금 계산 안전 연결 (v2.1.79)
- **사용자 제공 상태:** 사용자가 발급받은 개인 서비스 키를 GitHub 비공개 Secret에 등록했다고 알림. 키 원문을 확인/복사/기록하지 않았음. `CALC_API_KEY`로 배포시 Cloudflare Worker의 private secret에 설정하는 GitHub Actions 변경. 실제 서버 적용·공급자 API 성공은 Actions 결과와 테스트로 별도 확인 필요.
- **서버 구현:** `workers/shared-settings/src/index.mjs`의 `POST /board/calculator/tax`; 다른 공유메모 API와 동일한 기기별 사무실 계정 bearer로만 인증, Origin 있는 호출 403, 분당 요청 제한, 허용 금액·날짜·주택수·지역·거주기간 및 허용 키 검사, HTTPS 공급자 `/v1/acquisition` 및 `/v1/transfer`에 private `CALC_API_KEY` 서버 전달. 주택 매매만 1차 지원, 추정·미등록·불완전 조건 거절. 임의 법안 적용값은 `N`으로 고정. API 응답은 `적요`/`값`/`비고` 안전 정규화, Worker 로그/KV/캐시/계좌/고객 성명 저장·전송 없음.
- **안드로이드:** `OfficeBoardClient.calculateTax`가 사무실 토큰으로만 서버 요청; `MainActivity.calculateRealtyTax` JavascriptInterface에서 비동기 실행, requestId 일치 시에만 UI 표시. API 키/사무실 계정 토큰은 WebView JS에 미전달. 입력조건 검증, 날짜 실제 유효일 검사, 바뀐 값에 대한 오래된 결과 무효화, 오류/키 미설정/한도 초과 시 외부 계산기로 안내.
- **출처·개인정보:** 최종 계산 버튼에 인접하여 제공자 출처와 클릭 가능한 https://eznm.me/realestate 표시(0.9rem 이상). 공급자는 API 호출 입력값 및 결과 로그를 약관상 최장 1년 보유할 수 있으므로 이용자에게 안내. API는 세무 조언이 아니며 단독명의/일반주택/미적용 특례 외의 복잡한 사례는 별도 확인 필요. 서비스와 제휴 관계가 아님.
- **검증:** `scripts/test_realty_tax.mjs`에서 인증/차단/형식/전달/응답/요청제한, `scripts/test_realty_calculators.js`에서 필수 필드·잘못된 날짜·응답 식별·인증 누락·DOM 표시 검증. Actions 또는 실제 공급자 응답 없이는 API 라이브 연결 정상이라고 단정할 수 없음.

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
- **현재 v2.1.79 구현:** 중개보수·대출이자·전월세 전환은 앱 내 로컬 계산. 취득세·양도세는 인증된 사무실 휴대폰에서만 Cloudflare Worker를 통해 공급자 API로 연결하는 코드와 테스트를 추가했음. 키가 실제 등록·배포되기 전에는 안전한 외부 계산기 링크를 이용할 수 있음. 일반 주택 매매·단독명의 기본 조건만 제공하며 추가감면·증여·상속·오피스텔·공동명의 등은 별도 외부 확인. 실서버 성공은 Actions와 실제 샘플 검증 후 확인.
