# 퍼스트현대 공공데이터 API 신청 안내

관리자용 메뉴 **API 신청**에서 아래 공식 신청 페이지를 열 수 있습니다. 외부 서비스의 약관 동의·로그인·본인인증은 사용자가 직접 진행해야 합니다.

| 순서 | 서비스 | 공식 신청 | 필요한 키 |
|---|---|---|---|
| 1 | 건축HUB 건축물대장 | https://www.data.go.kr/data/15134735/openapi.do | 기존 DATA_GO_KR_SERVICE_KEY 활용 가능 여부 확인 |
| 2 | K-apt 공용관리비 | https://www.data.go.kr/data/15057937/openapi.do | 공공데이터포털 서비스키 |
| 3 | 나이스 학교기본정보 | https://open.neis.go.kr/portal/guide/apiGuidePage.do | NEIS_API_KEY |
| 4 | 도로명주소 검색 | https://business.juso.go.kr/addrlink/openApi/apiExprn.do | JUSO_API_KEY |
| 5 | 학구도 공간정보 | https://schoolzone.emac.kr/ | 파일 내려받기/공식 경계 자료 확인 |

**신청시 활용목적 예시:** '인천 송도동 아파트 중개업무 지원용 안드로이드 앱. 공공 건축물대장, 월별 공동주택 관리비, 학교 기본정보, 도로명주소와 학구도를 수집하여 단지별 조회 화면에서 비교·검증하고 정기 갱신할 예정입니다. 출처와 갱신일을 표시하며 공개정보만 제공합니다.'

**보안:** API 키는 채팅, 앱 화면, GitHub 코드/이슈에 게시하지 마세요. GitHub 저장소 > Settings > Secrets and variables > Actions > New repository secret에 등록하세요. 기존 공공데이터포털 키를 재사용할 수 있다면 중복 키를 만들 필요가 없습니다.

**현재 단계:** 신청 화면과 가이드를 앱에 연결했습니다. 승인·키 발급 전이므로 신규 API 호출이나 배정학교/관리비 자동 수집이 이미 작동한다고 표시하지 않습니다. 승인 후 서비스별 실제 응답 형식과 매칭을 검증해 데이터 수집기 및 아파트 상세의 '학교·학군', '기본정보', '관리비'에 반영해야 합니다. 학구도는 학교 기본정보 API만으로 배정 여부를 판단하지 않습니다.
