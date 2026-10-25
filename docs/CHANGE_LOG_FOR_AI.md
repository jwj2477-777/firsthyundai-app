# AI 개발 인수인계 변경 로그 — 항상 새 항목을 맨 위에 추가

## 2026-10-25 · v2.0.98 · 비공개 자유 메모 추가
- assets/index.html: PAGES와 상단 utilityNav에 #officeBoard, 두 역할 모두 접근. #officeBoardDraft 자유 텍스트 + 붙이기, 리스트/완료 보기, 인증/상태 표시. assets/office-board.js/css 신규.
- Android: OfficeBoardClient.java 고정 Worker URL/토큰 프라이빗 보관/읽기·POST·PATCH·DELETE. LockActivity 가족 암호 확인에서 최초 게시판 자동 등록, 기존 기기에는 MainActivity native password dialog 사용. 브리지 officeBoardAction / requestOfficeBoardAccess, 코드는 JS 미노출.
- Worker: /board/session POST에 private family code + rate limit, 60일 HMAC board scope. GET/POST /board, PATCH/DELETE /board/:id 모두 인증 필요. per-note KV key로 동시 새 글 게시 시 목록 덮어쓰기 회피. secret FIRSTHYUNDAI_ACCESS_CODE를 Worker deploy action이 설정, 가족 코드 rotate workflow 연동.
- test_office_board.mjs: 공개 읽기 차단·wrong code·브라우저 origin 차단·추가/완료/수정/삭제·패치 입력 검사·코드 변경 무효화·공개 설정 민감정보 누출 방지. test_office_board_ui.js: 자유 입력, XSS escape, tel 링크, Native 브리지. CI 40164159729 성공. APK v2.0.98/build149, release/manifest 확인. 부모님 휴대폰 실제 테스트 미수행.

## 2026-10-25 · v2.0.97/build148 · 중앙 설정 최종 서명 릴리스
- Worker 신규 KV 바인딩/배포/secret/health 성공. Android User-Agent가 Cloudflare Worker 접근 검사와 동일 계열로 지정됨. admin-preferences.js에서 변경이 Native 게시 요청으로 연결, shared-settings.js에서 일반모드 자동 수신, 단기 네트워크 실패 시 안전 캐시 적용.
- test_shared_settings_worker.mjs 서버 인증·필드 allowlist·코드 변경 후 토큰 무효화 검사, test_shared_settings.js 로컬/원격/권한 테스트를 통과하도록 구축. v2.0.96 리리스를 덮어쓸 수 없어 v2.0.97로 최종 배포. CI 서명 APK와 update index는 별도 성공 확인 필수.

## 2026-10-25 · v2.0.96 관리 설정 공통 공유
- workers/shared-settings/src/index.mjs + wrangler.toml + deploy-shared-settings.yml: KV 설정 저장 및 검증된 관리자 1h 세션, 8회/분 인증 제한, GET 공개/PUT 인증. KV namespace 재사용.
- Android MainActivity + SharedSettingsClient: 기존 AdminPolicy 인증 후 Worker 임시 토큰 메모리에만 보관, family 복귀시 삭제. Native에서 고정 URL GET/PUT만 허용하고 JS에는 토큰 전달 안 함.
- admin-preferences.js 관리자 변경 시 서버 게시 요청, 일반모드가 applyShared 로컬 설정 반영. shared-settings.js 공개 설정 자동 수신, 게시 실패 상태 표시, Native callback. JSON 내 계약/메모/인증키 없음. 테스트 test_shared_settings.js 추가. 2.0.96/build147.
- Worker 초기 배포 health 403 이슈: 배포 성공과 공개 주소 접근을 별도 검증하기 전에는 동기화 가능으로 표시하지 말 것.

## 2026-10-25 · v2.0.95 · 일반모드와 관리자 UI 운영 설정
- index.html 헤더/ARIA/모드 전환/보조 문구와 MainActivity.java 안내의 '가족 모드' 표시를 '일반모드'로 변경. Native JS role 문자열 'family', 인증정책, 사용자 데이터·키는 불변.
- adminCenter 앱 환경 패널: 시작화면/밀도/글자/효과/대비/실거래 팝업 알림. 별도 admin-preferences.js/css에서 관리자 인증 role 검사, localStorage 엄격 값 목록·스키마 검증, body data 속성 적용, real-time animation reduction integration.
- admin-preferences.js를 premium-motion.js와 selection-flow.js 전에 로드, OS reduce-motion 존중. 초기 진입도 generalStartPage()로 설정 반영. 설정만 JSON으로 백업·복원, 고객/비밀키 제외. reset은 알림을 손대지 않음.
- 기존 admin-center.js 상태 업데이트에서 설정 UI sync; test_admin_preferences.js 추가, 화면/모드 회귀 수정. 버전 2.0.95/build146, CI/공개 APK·실기기 검증 별도.

## 2026-10-25 · v2.0.94 · 관리자 정밀 점검 기능
- app/src/main/assets/admin-center.js: SOURCES 8종 정의, classifiy 대신 정밀 classify(자료 기준/시각/오류/누락/최대 500건 품질점검), 중요도별 우선 점검, details, 소스별 retry/화면 이동, 기간 경고 strict/normal/relaxed 로컬 설정, 개인자료 미포함 보고서 복사+선택 fallback, 이벤트 최대 24건 로컬 저장/삭제, 관심알림 설정 바로가기.
- HTML adminCenter만 재배치, admin-center.css에 스코프 스타일 확장. 일반 업무·네비·가족모드·별도 인증 정책은 변경 없음.
- 스냅샷 갱신과 API 수집 분리; 오류 원문/저장소 주소/개인정보/키를 보고서·이력에 기록 금지. test_admin_console.js 정밀 회귀 확대.
- 버전 2.0.94/build145, 릴리스 워크플로 동기화. APK 서명/실기기 테스트는 CI 결과 확인 후 보고.

## 2026-10-25 · v2.0.93 · 시스템 관리센터
- 신규 assets/admin-center.js/css로 관리자 전용 운영센터 구성, 상태·오류·게시 시각·설치 버전 표시. 앱의 실제 refreshAll/refreshPublicServices 및 appUpdateCheck 연결. 기존 관리자 설정·API·보안·백업·단지 편집으로 진입.
- 관리자 인증 후 시작 화면 adminCenter, 기존 3대/2보조 업무 메뉴 유지. 가족은 PRIVATE_PAGES로 접근 차단. 기존 AdminPolicy 세션 규칙 불변.
- 공개 JSON '게시 확인'과 실제 API 작동 여부 구분, GitHub Actions 신규 수집은 외부 웹으로 진입(앱에 PAT/비밀키 없음). 기본 화면 자가점검은 API 진단이라고 주장하지 않음.
- test_admin_console + 역할/네비/권한 테스트 수정. 2.0.93/build144 릴리스 워크플로 변경. CI/실기기/배포 결과 별도 확인.

## 2026-10-25 · v2.0.92 · '송도 뉴스' 상단 제목
- 뉴스 큰 제목 텍스트만 index.html 정적 H2와 switchNewsPane 동적 H2에서 변경. 인천광역시 청약·분양 제목/전환 버튼, 데이터와 디자인 유지.
- 관련 테스트 test_screenshot_consistency.js, test_unified_top_layout.js, test_segmented_switch_unity.js 수정.
- v2.0.91/build142가 마지막 CI의 Chromium 실행 35초 초과로 릴리스되지 못하여 test_native_lower_tab_browser.js 제한을 70초로 조정. 이전 거래유형 건수 개선과 함께 v2.0.92/build143 릴리스 준비.
- 배포 확정은 새 Actions 및 공개 Release APK와 app_latest.json 확인 후 보고.

## 2026-10-25 · v2.0.91 · 거래유형 고정 크기 건수 표시
- 각 4종 거래유형 버튼에 N건 보조 줄. 아파트/오피스텔/새 거래는 서로 분리된 자료/검색조건으로 집계. 미수집 —.
- index.html, ui-v2.css 공통 50px 고정/11px 숫자(소형10px), test_new_trade_clarity·test_office_on_demand·test_trade_layout_browser 확장.
- Gradle 2.0.91/build142 및 자동 Release 업데이트. CI 결과·APK·실기기 검증은 별도 확인.

## 2026-10-25 · v2.0.90 · 실거래/아파트 정보 화면 제목 4곳 수정
- 요구: '새소식 · 신규 공개 실거래'→'신규 공개 실거래', '송도동 오피스텔 실거래가'→'송도 오피스텔 실거래', '송도동 아파트 실거래가'→'송도 아파트 실거래', '단지정보 · 송도 아파트'→'송도 아파트 정보'.
- 변경: app/src/main/assets/index.html의 해당 H2 텍스트만 교체. CSS·버튼·수집시간·데이터·서브메뉴는 유지. 기존 제목 의존 테스트 test_officetel_heading_color.js와 공통 제목 회귀 test_page_title_parity.js를 새 문구 기준으로 수정.
- 릴리스 준비: app/build.gradle 2.0.90/build141, .github/workflows/build-apk.yml 릴리스 태그·APK명·설명 일치.
- 로컬 전체 테스트 및 실기기 체감은 미확인. Actions 빌드 결과·공개 APK·업데이트 index는 실행 이후 별도 확인할 것.

## 2026-10-25 · v2.0.89 · 뉴스·청약 필터와 목록 시작점 통일
- 사용자 v2.0.88 캡처: 뉴스의 별도 참고용 배너가 필터를 아래로 밀고, 청약의 출처·긴 집계가 목록 앞에서 다른 여백/위치를 만듦. 2열 청약 선택 문구도 잘림.
- 두 pane에 newsFeedPanel/newsFilterRow를 공통 적용. 카드 padding16px, filter50px, 접힌 안내 summary44px, 결과 count21px 최소로 통일하고 실제 첫 결과 카드의 위 margin도 통일. 고정 높이 빈칸/빈 카드 없이 동일 순서(필터→접이식 안내→건수→목록)로 배치. 안내를 열면 필요한 내용만 자연스럽게 확장.
- 기존 뉴스 참고·원문 확인 문구와 관리자 본문요약 설명/현황은 필터 아래 '요약·원문 안내'에 그대로 보존. 기사별 원문/AI 상태/3문장/미요약 경고 유지. 청약은 기본 선택 문구를 '예정·진행', '전체 유형' 등으로 줄이되 필터 value와 원자료 분류는 유지. 선택 상태/종류에 맞는 실제 결과 건수만 기본 표시하고 예정·진행/마감/일정미확인 전체 집계·출처·조회범위는 '자료 출처·집계' 안에 모두 보존. 미수집=0건으로 만들지 않음.
- native select 화살표를 제거한 공통 모양에는 같은 SVG chevron 표시. 기존 전역 important 배경 shorthand 때문에 화살표가 사라지지 않도록 해당 배경 이미지/위치 longhand만 명시. 터치 영역50px을 보존하고 좁은 화면13px 반응형 규격을 공통 적용.
- 검증: test_trade_layout_browser.js 확장. 6폭(320/360/380/393/430/600), 가족/관리자, 4주제·4접수상태×4공고유형, 유효/마감/미확인 실제 fixture를 실제 렌더러로 표시. 공통 카드/필터/안내/건수/첫 결과의 경계값, 선택 텍스트가 화살표 영역 침범하지 않음, 50px 터치/화살표, 접이식 안내 접근 및 원본 전체 집계·조회범위 보존을 검사. 앞선 887 색흐름과 업무/데이터 검증 유지. CI·고정서명 APK·공개 Release·업데이트 index는 별도 확인 후 기록; 실기기 체감은 설치 후 사용자 확인.
- 배포 검증 완료: 구현 ce0cf89, Actions 40144594802/job 121023129758 성공. 실제 v2.0.89/build140 APK 메타·고정 릴리스 서명 검사, 공개 APK(1,737,663 bytes)·인수인계 MD/ZIP 및 app_latest.json v2.0.89 연결 확인. 6폭×625=3,750 배치/필터/출처 검사와 기존 887 색흐름·브랜드·JS/Python/JVM 검증 통과. 실제 사용자 단말 체감은 업데이트 후 별도 확인.


## 2026-10-25 · v2.0.88 · 같은 단계 메뉴의 위치·크기·정보 밀도 통일
- 사용자 캡처: 아파트 전체/관심/새 거래의 제목 메타 줄수, 오피스텔 카드 안쪽 여백·최신순 높이·선택란 삽입 때문에 공통 메뉴가 오르내림. 뉴스/청약은 빈 제목 메타 공간과 반복 정보도 정리 요청.
- ui-v2.css 최종 공통 규격: 거래 4페이지 헤더 최소 55px(380px 이하 제목 두줄 대비 81px), 메타 한줄 21px 자연 줄바꿈 허용. 카드16px, 하위 메뉴71px(370px 이하68px), 동일 아이콘/폰트/간격, 거래유형50px, 상세검색 여백 통일. 크게 비워 정렬하지 않고 짧은 실제 메타 사용. 새 거래 4유형 색도 전체/매매/전세/월세의 기존 의미색으로 통일. 관심 상세는 건수 보조행이 있으므로 기존 큰 터치 규격 보존.
- 공통 메뉴 → 거래유형 → 상세검색 → 조건별 입력·결과 순서. 새 거래 날짜 및 단지 선택란, 적용 조건/선택 단지 안내는 공통 메뉴 아래로 이동. 선택란 열기/필터 선택으로 공통 메뉴 이동하지 않음. 기존 id/onclick/aria와 입력값·원자료·색 흐름 보존.
- 아파트·관심은 동일 실제 거래 수집 시각, 오피스텔은 매매·전월세 자체 updated_at, 새 거래는 자체 checked_at. 반복 지역은 송도동으로 짧게 표시; 일부 수집 실패는 결과의 기존 강조 배지/관심 집계 안내에 유지. 아파트정보의 정적 설명은 complexes.updated_at 자료 기준으로 교체; 날짜만 있으면 날짜만, 미확인/오류는 확인 필요로 구분.
- 뉴스는 헤더에 시각, 건수/AI 요약 개수는 필터 결과 한곳에 유지. 청약 헤더에도 실제 확인 시각 표시. 청약 출처/범위·AI 세부 현황은 details로 보존; 뉴스 원문 확인 안내·청약 일정 미확인/마감/유효 분류·공식링크는 유지. 관리자 긴 메타 때문에 가족과 다른 거대한 헤더 여백 발생하지 않음.
- 검증: 신규 실제 전체 앱 browser 테스트는 320/360/380/393/430/600px, 가족/관리자·정상/부분수집·실제 버튼 전환·선택란 열기/닫기·거래유형/상세검색·뉴스/청약·단지상세8탭의 정착 후 경계값 및 과도한 헤더 여백/출처/미확인 상태 검사. 기존 887 색흐름 검사와 업무/데이터 테스트 유지. 실제 휴대폰 체감·설치 결과는 별도 사용자 확인; CI/APK 서명/Release 완료는 따로 기록.
- 배포 검증 완료: 최초 Actions 40143061710은 오피스텔 진입의 실제 서버 갱신이 검사용 시각을 바꾸어 신규 브라우저 fixture 검사가 실패. 앱 동작을 완화하지 않고 fetchRemote 응답을 동일 검증 스냅샷으로 고정(239a401)하여 갱신 경로도 재현. Actions 40143257991/job 121019219116 성공, v2.0.88/build139 실제 APK 메타·고정 릴리스 서명 검사 및 공개 자산(1,737,019 bytes), data/app_latest.json v2.0.88 연결 확인. 6폭×197=1,182 배치 검사·887 색흐름·브랜드 착지·기존 JS/Python/JVM 회귀 통과. 사용자 휴대폰 설치 후 체감 확인은 별도.


## 2026-10-25 · v2.0.87 · 오피스텔 제목 아래 실제 수집 시각
- 사용자 캡처: 오피스텔 제목 아래 검색 방식 설명을 제거하고 아파트처럼 수집 시각 표시 요청.
- officeMeta를 아파트와 같은 지역·짧은 한국시각(YY.MM.DD HH:mm) 형식으로 표시. publicServices.office_sales/office_rents의 실제 updated_at만 사용; 공공정보 전체/학교 또는 아파트 시각을 대신 쓰지 않음. 매매·전세/월세는 해당 유형, 전체는 확인된 자료 중 오래된 시각을 사용. 자료 없음·미승인·시각 누락은 최신 시각을 꾸며내지 않고 구분. 기존 수집 대기/오류 표시 유지.
- test_office_on_demand.js에 실제 시각 선택·유형 전환·미수집/잘못된 시각·아파트/학교 시각과 독립 검증 추가. 다른 UI/브랜드 전환/데이터/업무 기능 무변경. 빌드·서명·Release는 별도 확인.
- 배포 확인: Actions 40139118386 성공. 실제 오피스텔 시각 선택/표시 회귀와 전체 기존 검사, APK 빌드·고정 서명 검증 통과. v2.0.87/build138 Release APK 및 app_latest.json 게시 확인.


## 2026-10-25 · v2.0.86 · 영문 FIRST 줄의 마지막 자간·길이 미세 불일치
- 사용자: 한글/로고보다 하단 영어 FIRST~만 마지막에 살짝 어긋나 보임. 한글 제목·로고의 이동 및 착지 방식 유지, 영문만 보완.
- 동일 폰트라도 TextView/HTML inline span의 tracking·글자폭 처리와 반올림이 달라질 수 있어 영문 줄을 한 개의 공통 윤곽으로 고정. bundled FHD Brand regular를 generate_brand_subtitle.py로 변환한 동일 path/금색/viewport의 SVG와 Android VectorDrawable 사용. 한글은 이전 live TTF text 그대로. 영문 alt/contentDescription 유지.
- 기존 영문 1.3em line-box·8/10px 반응형 크기·340px 이하 숨김 유지. native subtitle만 ImageView로 표시하고 실제 웹 img 경계에 X/Y를 각각 정렬하여 native intrinsic 정수 반올림을 끝에서 보정. 다른 로고/제목은 기존 uniform scale/기준선 정렬 그대로. 860ms 이동/190ms 정지 dissolve/도착 확인 흐름 무변경.
- 검증: Android/Web 두 자산의 path·색·viewport 완전 동일 및 접근성/한글 보존 검사. 5종 화면 폭에서 실제 img가 준비되고 native bridge metrics/착지 표시가 정상인지 확인. 실제 사용자 단말의 체감은 업데이트 후 별도 확인.
- 배포 확인: Actions 40114854686 attempt2 성공 (attempt1의 기존 Chrome 실행 시간초과 후 같은 commit 재실행). 실제 앱 887개, 착지 5폭×16개(80개), 영문 공통 윤곽2개 및 기존 회귀/Android 빌드 통과. v2.0.86/build137 APK 메타데이터·고정 서명 검증, Release APK(1,735,915 bytes) 및 app_latest.json 등록 확인. 실제 삼성 단말의 마지막 영문 체감은 설치 후 별도 확인.



## 2026-10-25 · v2.0.85 · 시작→상단 마지막 착지·글꼴 불일치 개선
- 사용자: 시작 로고/제목이 상단으로 이동할 때 특히 마지막이 매끄럽지 않고 글꼴도 다름.
- 원인: native 790ms 이동과 DOM 측정 때 시작한 CSS 555+225ms 노출이 서로 다른 시계로 작동하여 이동 중 상단 글자가 겹침. native sans-serif와 웹 Roboto/Noto 폴백은 동일 글꼴 보장 못함. TextView 전체 박스를 CSS line-box에 맞춰 축소해 실제 글자 크기·기준선이 달랐고, 로고는 SVG 실물 대신 wrapper 여백을 측정했음.
- 동일 Noto Sans KR SIL OFL 기반 브랜드 전용 400/700 static subset TTF(각 약 3.8KB, FHD Brand로 개명)를 Android/웹에서 함께 읽음. 전체 앱 본문 폰트는 기존 유지. 글꼴 준비를 제한 재시도 후 실제 CSS font-size/inline baseline을 native에 전달(17숫자 bridge). 텍스트는 line-box 맞춤이 아닌 실제 font-size와 baseline으로 정렬. 좁은 화면의 숨긴 영문은 0 metrics로 정상 축소 이동 지원.
- native 이동 860ms: 감속곡선 보완, native 완주 callback → 상단 underlay 표시 → WebView visual-state 완료 → 정지한 native만 190ms fade. CSS 독립 타이머 제거. tap skip/동작 줄이기/실패시 제한된 fallback 유지.
- header 실로고는 native vector generator의 동일 경로·그라데이션 SVG를 표시하고 그 실제 img bounds를 측정. 기존 inline SVG는 계약 PNG 원본 경로/색상으로 유지, 고객 문서 로고 무변경.
- 검증: 320/340/360/393/430px 실제 Chromium에서 내장 폰트·기준선·17개 값·좁은 영문 숨김·1.1초 동안 독립 조기노출 없음·착지 신호 후 표시 확인. JVM BrandLandingMathTest는 밀도/큰 글씨 설정에서도 baseline·실제 글자 크기 정렬 검사. 기존 버튼/계약/보안 회귀 유지. 실제 삼성 단말 native 체감은 설치 후 별도 확인 필요. CI·서명·Release 상태는 별도 검증.
- 완료 검증: Actions 40113754414 성공. 실제 Chromium 5개 폭 × 15개 착지 검사(총75), 기존 실제 앱 887개 검사 및 JS 64개/Python 89개 검사, JVM 글자 기준선·폰트 배율 검사와 APK 빌드 통과. v2.0.85/build136 메타데이터·고정 서명 확인, Release APK(1,730,764 bytes)와 app_latest.json 게시 확인. 실제 삼성 단말의 native 전환 체감 검증은 사용자 설치 후 별도.



## 2026-10-25 · v2.0.84 · 건너뛴 중간 버튼을 차례로 스치는 색 흐름
- 사용자: 상단 실거래↔뉴스의 아파트정보 경유 효과를 표시한 하위 메뉴와 여러 버튼이 나열된 줄에도 동일하게 적용.
- selection-flow.js viaIndices는 같은 실제 가로줄의 출발/도착 사이 버튼만 이동 방향대로 수집. 전체 최신순↔새 거래는 관심 14개, 전체↔월세는 매매·전세를 차례로 거침. 1개 경유는 기존 790ms/21% 옅은 색 유지, 2개 경유는 900ms로 짧게 순차 통과. 인접 전환 630ms 및 메인 5개/아파트정보 경유 동작 유지. 다른 줄·관련 없는 버튼에 효과 없음.
- 중간 버튼 class/aria/클릭/필터 변경 없음. 기존 실제 버튼 배경만 사용, 복제 요소나 이동/크기 변경 없음. 취소/연속 클릭/동작 줄이기 기존 정리 경로 사용.
- 회귀: 실제 앱 브라우저에서 모든 거래유형 순서쌍과 하위 3메뉴 양방향의 경유/중간 비선택/정리/형태 검증. JS 경로 검사에 2개 경유·역순·다른 줄 제외 추가. 실제 터치 및 빌드·서명·Release 결과는 별도 확인.
- 완료 검증: 실제 앱 브라우저 887개 assertion 및 기존 JS 검사 64개 통과. 모바일 Chromium trusted touch에서 전체→월세의 매매→전세, 역방향 전세→매매의 순차 시작 및 하위메뉴 양방향 경유/중간 비선택/정리 확인. Actions 40111614767 성공, v2.0.84/build135 APK 메타데이터·고정 서명 검증 및 Release APK(1,718,873 bytes)/app_latest.json 게시 확인. 실제 사용자 삼성 단말 확인은 업데이트 후 필요.


## 2026-10-25 · v2.0.83 · 실패한 두 줄을 메인과 같은 실제 배경 painter로 통일
- 사용자: 메인 5개는 정상, 뉴스↔청약 및 전체/매매/전세/월세는 여전히 효과가 보이지 않음.
- v2.0.82는 해당 줄을 JS에서 명시적으로 제외하고 @property CSS로 분리했음. 기존 브라우저 검사는 별도 축약 DOM의 등록 속성 수치만 확인했고 실제 앱의 클릭→화면 배경 흐름을 보증하지 못했음. 사용자 기기의 정확한 실패 원인은 단말 계측 없으므로 확정하지 않음.
- 두 줄만 동일한 JS real-button background painter에 연결. 클릭한 실제 row와 버튼을 보존하며 inline onclick 후 버블 단계에서 첫 paint를 준비 (실제 사용자 이벤트의 capture→microtask→onclick 순서 문제 예방). @property 및 CSS background-transition 경쟁 제거. top-five 기존 RAF/색상/아파트정보 경유 로직은 유지. 관심단지 상세 nearbyTypeBar도 정확한 row를 사용.
- 검증: test_native_lower_tab_browser.js를 실제 전체 앱 자산/onclick/DOM 기반으로 교체. 모든 방향·4유형의 모든 순서쌍·빠른 연속 클릭·배치/텍스트 불변·이외 버튼 무효과·cleanup·reduced-motion을 배경 computed style로 검증. 기존 주메뉴 회귀 검사 유지. CI/서명/APK 배포 성공 여부는 Actions와 Release를 따로 확인. 실제 삼성 단말 미검증.
- 완료 확인: 실제 전체 앱 브라우저 751개 assertion, 주메뉴/이벤트 순서 포함 JS 64개 및 Python 89개 통과. 모바일 Chromium 실제 trusted touch로 뉴스 양방향·거래유형 양방향·관심단지 상세 색 흐름/정리 및 JS 오류 없음 확인. Actions 40109820553 성공, v2.0.83/build134 APK 메타데이터·고정 서명 검증 및 Release APK(1,718,525 bytes) 게시, data/app_latest.json의 v2.0.83 등록까지 확인. 실제 삼성 단말은 사용자 업데이트 후 확인.


## 2026-10-24 · v2.0.67 · 오리지널 스플래시 스타일을 헤더 기준으로 복원, 이동 중 끊김 완화
- 사용자는 v2.0.66 메인 스타일에 맞추기보다 예전 시작 화면의 화이트 타이틀/금색 영문을 선호. Native 원래 title #FFF Bold(700), English subtitle #F6D791 Regular(400), 자간 0/.1em. 메인 헤더도 동일 CSS 통일하고 크기만 헤더 폭에 따라 축소.
- 원래 인트로에는 없던 154dp 크림 로고 바탕을 제거하고 헤더의 크림 바탕/그림자도 삭제. 원본 FHD 엠블럼·골드 halo만 이동 후 링 페이드.
- SmoothBrandOverlay.java는 이동 중 onApproach JavaScript round-trip을 제거. 최초 좌표 측정 시 CSS fade 555~780ms 자동 예약, native 790ms compositor 애니메이션 중 앱/웹 동기화 왕복 없음. TextView 및 로고 GPU pre-layer로 애니메이션 프레임 안정화.
- 인증·계약·실거래·가격동향·알림 및 기존 앱 서명 업데이트 변경 없음. v2.0.67/build118.



## 2026-10-24 · v2.0.66 · 첫 화면과 헤더 브랜드 폰트·색상·원형 통일
- 같은 로고로 이동하는데도 도착 순간 바뀌던 글꼴/굵기, 영어 색상 및 글자 간격/원형 배경을 근본 정리.
- Native `BrandIdentityStyle.java`에 한글/영문 문구, Sans-serif(로보토/노토 대체), 굵기 820/670, 자간 -.033/.072em, 제목 #F9FFFF, 영문 #D8E7E4를 단일 정의. LockActivity와 SmoothBrandOverlay 모두 사용. 웹 헤더도 같은 font-family 계열을 명시. 영문 2칸 공백을 실제 헤더와 일치하도록 1칸 공백으로 수정.
- 기존 시작 화면의 금색 영문이 마지막에 청록으로 변하던 별도 ValueAnimator 제거. 처음부터 청록색, 이동은 위치와 균일 축소만. 원본 144dp FHD 로고 주위의 154dp 크림 원형 backing도 시작/이동 레이어에 동일하게 추가하고 마크와 함께 상단으로 축소 이동. 얇은 gold ring만 마지막 250ms 페이드.
- 시작 큰 제목 30sp와 최종 헤더의 반응형 폰트 크기는 의도적으로 다르지만, 이동 중 최종 실제 글자 크기에 맞춰 부드럽게 스케일하는 원칙 유지. 인증·정보 배치·계약·실거래/가격동향·업데이트 유지. `v2.0.66/build117`.



### 2026-10-24 · v2.0.65 · 착지 글자·색상·원형 전환의 연속성 보완
- 실기기 후속 피드백: 도착 시 한글/영문 글꼴, 크기, 영문 색상 및 마크 원형 바탕이 갑자기 바뀌는 현상.
- WebView 브랜드 표시 255ms 전부터 CSS opacity 230ms, native 텍스트 205ms 페이드. 출발 시 금색 영문 TextView를 510ms에 걸쳐 메인 #D8E7E4 색상으로 변경, 한글 글자색도 최종 CSS 값에 가까워지도록 천천히 변환.
- 금색 원형 링을 중앙에 남기지 않고 브랜드 로고와 함께 실제 헤더 좌표로 축소 이동. 원형 하얀 바탕과 그림자는 마지막 235ms에 투명→원래 CSS 값으로 점진 생성. 도착 후 원본 Header는 CSS 기존 기본값 그대로.
- v2.0.65/build116 (아직 최초 CI 실패 상태인 동일버전 수정), 로그인·금액·계약/가격동향/업데이트 로직 불변.



## 2026-10-24 · v2.0.65 · 더 부드러운 시작→메인 브랜드 이동
- 사용자 실기기 피드백: 2.0.64보다 조금 더 자연스럽게. Native SmoothBrandOverlay 총 모션 680→790ms(기능 처리 지연 없음), 가속·감속 베지어 `(.34,.06,.18,1)`로 출발의 급가속 제거.
- **마지막 165ms부터 실제 HTML 메인 헤더를 부드럽게 표시**, 네이티브 이미지/문구는 마지막 120ms에 ObjectAnimator 알파 전환 → 폰트/렌더링 차이로 생기는 착지 순간 교체감을 크로스페이드. 딥그린 배경 공개도 적당히 늦춰 카드 등장 타이밍을 맞춤.
- 터치 즉시 완료, 접근성 애니메이션 줄이기, 좌표 실측, 인증/실거래/계약/기존 APK 서명 유지. `v2.0.65/build116`.



## 2026-10-24 · v2.0.64 · 중앙 로고→상단 로고 이음새 제거 최종본
- v2.0.63 이후 추가 보완: 실제 웹 헤더 노출 성공을 확인한 **다음** Android 오버레이를 제거하여 마지막 프레임 깜빡임을 방지. 초기 레이아웃 값 불확실 시 재시도 횟수를 제한하며 실패하면 빠른 폴백 처리.
- 가족 보안정책 로딩 중 시작 브랜드가 중간에 사라지고 로그인 폼이 잠깐 나타나는 현상도 방지. 권한 불승인/오류 시에는 정책 결과 후 정상 로그인 창 노출, 사용자가 탭하면 인트로 즉시 생략 가능.
- 별도 버전 `v2.0.64/build115` 배포: 먼저 실행된 2.0.63의 immutable GitHub Release APK와 구별.



## 2026-10-24 · v2.0.63 · 실제 네이티브 로고를 메인 헤더로 연결
- v2.0.62의 WebView가 다른 SVG/문자 UI를 다시 그리면서 느껴지는 전환 중 이질감/프레임 지연 보완. MainActivity 생성 시 **LockActivity 원본과 같은 Android 벡터 배지/텍스트/그린 배경**으로 브리지 화면을 위에 그려 WebView 로딩 전후에도 계속 보이게 처리.
- 웹 화면이 준비되면 JS는 메인 헤더 실제 좌표만 반환. SmoothBrandOverlay.java에서 native FHD 배지/제목/영문을 Android property animation(680ms, 감속 경로)으로 해당 헤더 위치에 이동. 모든 배지 변형은 X/Y 동일 스케일 사용(원본 비율 보존).
- 배경 천천히 페이드, 완료되는 같은 프레임에 실제 HTML 헤더 노출. 누르면 즉시 완료/줄이기 모드 즉시 노출/좌표 미수집 시 페이드 대체. 기존 인증·실거래·계약·업데이트 불변. v2.0.63/build114.



## 2026-10-24 · v2.0.62 · 시작 브랜드 3요소를 상단 헤더로 이동
- 사용자 이미지 두 장 기준: 정품 FHD 로고/퍼스트현대 제목/영문 브랜드가 가운데서 실제 header 각 좌표로 이동하고 축소되는 FLIP (Web Animation) 연출. 메인 상단 로고/문구는 전환 중 감추었다가 이동 요소 착지 후 나타남.
- 시작→WebView 화면 전환은 Android 기본 슬라이드를 제거하고 WebView가 로드될 때까지 숨긴 뒤 임시 DOM에 중앙 브랜드를 준비하여 연속성을 높임. 620ms 내 전환, 딥그린 배경 걷힘, 카드 등장 연출 유지. 타이머 안전 종료, 탭 시 조기 완료.
- 재방문/일반 메뉴 이동 중 반복하지 않으며 애니메이션 줄이기/화면구조 미준비면 기존 220ms 페이드로 안전 복귀. 로그인/권한/API/거래/계약/배포는 그대로. v2.0.62/build113.



## 2026-10-24 · v2.0.61 · 시작 화면의 브랜드 연출 / 첫 프레임 연결
- 기존 원본 FHD FIRST 이미지(벡터 리소스) 보존, 새로 그리거나 글자 변형 없음. Native LockActivity 시작 화면에서 얇은 골드 링·선, 원본 로고, 브랜드 텍스트를 순차적으로 짧게 등장. 별도의 강제 로딩/대기 추가 없이 기본 웰컴 자동 종료 시간을 1100→920ms로 감소. 탭하면 즉시 생략·정책 검증은 병행하며 절대 생략하지 않음.
- MainActivity WebView 첫 frame 전 blank-white flash 방지: index.html onPageFinished까지 WebView 알파 0, 완료 후 220ms에 나타남(동작 줄이기면 즉시). 처음에만 JS `FirstHyundaiMotion.playEntrance()`를 호출하여 로고·브랜드명·메인 3탭이 짧게 따라 등장. 재탐색/가족 관리자 전환 시 재생하지 않음.
- 기존 CSS 버튼/단지카드/탭 전환·접근성·성능 유지. 시각 요소 외 데이터/위치/계약 기능 불변. `v2.0.61/build112`.



## 2026-10-24 · v2.0.60 · 터치 효과 마무리 및 최종 배포
- v2.0.59 CSS/JS 고급 화면 효과를 유지하며 단발 터치 파동의 animationend 이후 버튼의 `overflow:hidden` 격리 클래스를 정상 제거하도록 마무리. 버튼 텍스트/터치 영역 및 복합 UI 잘림 방지.
- 페이지·단지 상세·팝업·버튼 효과 그대로, 접근성 동작 줄이기 및 기존 기능 회귀검사 유지. 서명된 설치 APK `v2.0.60/build111`.



## 2026-10-24 · v2.0.59 · 상용 앱 수준의 짧은 터치·화면전환 모션
- 주요 버튼·단지카드·탭에 짧은 눌림 반응(scale .972~.988), 한 번의 터치 파동(390ms, 이벤트 차단 없는 pointer-events:none), 터치 후 DOM 정리. 롱프레스/스크롤/키보드와 기존 onclick 이벤트는 그대로 둔다.
- 페이지 전환 시 185ms 불투명도 페이드, 상단 제목만 6px 이내 짧은 등장. 전체 페이지에는 transform을 주지 않아 고정형 단지 상세가 깨지지 않도록 설계. 기존 단지 상세 슬라이드 이징과 별도 설정 다이얼로그 등장은 부드럽게 다듬음.
- Android 접근성 ‘동작 줄이기’에서 전체 전환 모션 및 터치 파동 제거. 대량 거래 카드 일괄 등장/딜레이, 과한 스프링/배터리 부하 유발하는 효과는 사용하지 않음.
- 모든 기존 기능·배치·모드/계약 검증/실거래/업데이트 보존. `v2.0.59/build110`.



## 2026-10-24 · v2.0.58 · 아파트 가격동향 그래프
- 기존 단지 정보 상세에 **가격동향** 탭 추가, 실거래 탭의 '가격동향 그래프 보기' 이동 추가. 관심14개 아파트 실거래 상세에도 단지별 가격동향 바로가기 추가(전체 모음 시 숨김).
- 국토교통부 실거래가 로컬 스냅샷(`remote.trades.records`) 사용, 추가 API/비밀키 없음. **단지 별칭의 기존 strict/ambiguous 매칭 적용**. 정확히 같은 전용면적(0.01㎡) 별로 매매/전세/월세를 따로 보며 6/12개월 제공, 기준일은 계약일·서버 갱신월.
- 월별 **중위가격** 점/선 차트 + 계약건수 그래프, 거래 없는 달은 이어붙이지 않음. 월세는 보증금과 월차임을 각각 그리며 어떤 전세/매매 금액도 섞지 않음. 해제 거래 제외, 명시된 갱신계약은 초기 제외/옵션 포함. 거래량 적으면 상승/하락%를 만들지 않음. 월별 표, 최신 거래가, 집계상태 경고 포함. 사진 사례의 공급평형은 기존 검증된 매핑이 있을 때만 표시.
- 기존 실거래 면적별 탐색·예약 및 계약문자·부모님 모드·업데이트 기능 유지. `v2.0.58/build109`.



## 2026-10-24 · v2.0.57 · 우측 상단 종 아이콘으로 알림 설정 이동
- 사용자 스크린샷: 상단 새 버전 알림은 버전·설치 버튼·닫기 구조가 명확하고 실제 설치 검증이 존재하여 그대로 유지. '관심단지 알림 설정'은 주변단지 리스트에서 제거해 목록 밀도를 개선.
- 헤더 우측 가족·관리자 모드 바로 **왼쪽**에 43px 종 아이콘을 노출. 모든 화면에서 누르면 모달로 기존 '새 실거래 팝업 알림', '휴대폰 알림센터에서도 받기', 권한상태, '알림 화면 미리보기' 제공. 개인 기기 기존 선택값(localStorage)과 알림 권한 요청 유지.
- 새 관심 실거래를 아직 확인하지 않았을 때만 작은 점을 표시. 미리보기는 설정창을 닫고 기존 팝업을 연다. 휴대폰 뒤로가기는 설정창을 먼저 닫는다. 폭 400px/340px 이하의 브랜드/버튼 겹침 방지 대응.
- 기존 업데이트 배너·실거래 새 거래 팝업·계약 기능과 앱 직접 업데이트, 보안서명 검사에 변경 없음. v2.0.57/build108.



## 2026-10-24 · v2.0.56 · 계약 확인 → 이미지 확인·공유의 단순한 2단계 마무리
- 사용자 스크린샷/정정 반영: 핵심은 전체 공유 버튼을 숨기는 것이 아니라 **확인 완료 바로 다음에 단독 '안내 이미지 확인·공유' 버튼을 크게 배치**하는 것.
- `문자 복사`, `문자 / 카톡 공유`, `새 계약 시작`과 반복 하단 설명은 기본 접힌 '기타 기능 펼치기' 안에 이동. 이미지 확인 및 공유 버튼은 **접히지 않음**. 관리자/가족 공통.
- 확인 완료 직후 도움말을 이미지 확인 유도로 변경. 새 메모/새 계약에서는 기타 기능 메뉴를 접음. 승인·유효성 검사 없이 공유할 수 없던 안전장치 유지.
- `v2.0.56`, `build107`. GitHub APK 릴리스 및 설치 전환 테스트 대상.



## 2026-10-24 · v2.0.55 · 계약 안내 아파트명·동호수 분리
- 사용자 수정 요청: v2.0.54의 결합 제목 `아파트명/동호수`를 취소하고 계약문자 및 공유 PNG 원문을 `▶ 아파트명 : ...` / `▶ 동호수 : ...`로 각각 독립된 줄에 출력.
- 계약 핵심정보 카드도 아파트명·동호수 두 행으로 분리. 기존 메모와 누락정보 자동인식, 별도 입력, 날짜/금액, 계좌·송금액 강조, 이미지·검토 승인 기능 불변.
- v2.0.55/build106.



## 2026-10-24 · v2.0.54 · 아파트명/동호수 표기
- 계약 안내 문자 및 동일 원문으로 만드는 고객 전달 PNG에서 기존 `▶ 아파트명 :` 제목을 **`▶ 아파트명/동호수 :`**로 변경. 두 정보의 실제 값과 누락 경고, 자동 단지검색은 변경하지 않음.
- 계약 핵심정보 카드도 `부동산` 대신 `아파트명/동호수` 제목으로 일치시킴. 세부 수동입력 필드(단지명/동호수)는 자동 인식 안정성을 위해 분리 유지.
- 문자·이미지·가족/관리자·계약 금액/계좌/특약·사전 확인·업데이트 시스템 회귀 테스트 보존. v2.0.54/build105.



## 2026-10-24 · v2.0.53 · 부족한 정보 입력도 메모처럼 자동 정리
- 사용자가 가족모드 부족한 정보 입력에서 '12월 3일'이 문자 그대로 남는 불일치를 지적. 인라인 빠른 입력에도 기존 메모 `dateIn` 및 `moneyPart` 함수를 사용해 **계약일/잔금일/중도금 지급일/입주일과 금액(만원)**을 같은 기준으로 변환.
- '12월 3일' → 기준 연도 추정 후 내부 YYYY-MM-DD, 문자/이미지 YYYY.MM.DD. '1억 2천만원' → 12000(만원 단위). 계약일 '12월 중 협의'와 기간 표기는 임의의 확정일로 만들지 않으며 잘못된 날짜/금액은 입력 적용 차단.
- v2.0.52의 원래 송금·계약성립·해제·중개보수 문구 복원, 가족/관리자 구분, 기존 정확한 계좌 금액 강조, 원문 특약, 누락 항목 1건씩 입력 UX 보존.
- v2.0.53/build104. CI 및 고정 서명 릴리스 확인 필요.


## 2026-10-24 · v2.0.52 · 기존 계약 성립·해제·중개보수 문구 복원
- 사용자가 이미지에서 지적한 '아래 조건에 대한 동의를 요청', '제안 1/2/3', '제안드립니다' 문구를 철회하고 **v2.0.47 당시의 원래 계약 안내 문장**으로 복원. 원래 송금 안내 문장에서 이번 송금액·계좌·예금주를 직접 표시하며 별도 입금 카드/문구 중복을 제거하여 PNG에서 기존 강조 처리(parseTransfer) 적용.
- 해당 문구는 현재 거래 유형(매도인·매수인 또는 임대인·임차인)과 실제 입력 금액/계좌로 자동 치환. 특약 자동 정리, 누락정보 한 항목 입력, 공유 전 사람 확인, 관리자/가족 분리 보존.
- 관리자 공통문구 편집 유지. 예전 제안형 로컬 문구가 새 버전에 남지 않도록 별도 템플릿 키(v2)를 사용하며, 이전 저장된 제안형 커스텀 템플릿은 불러오지 않음. 관리자 문구 저장 시 송금액·계좌 자동 치환 위치 필요.
- 이 안내는 실제 당사자가 발송 후 조건을 확인해 동의 여부를 결정하기 위한 것임. 발송 전에 이미 동의했다는 별도 체크란은 재도입하지 않음.
- v2.0.52/build103.



## 2026-10-24 · v2.0.51 · 계약 간 임시입력 분리 보완
- v2.0.50 입력 UX 개선에 이어 다른 고객의 메모를 새로 분석할 때 아직 적용하지 않은 계약일·계좌 입력 임시값까지 초기화. 고객 간 정보 혼입 방지 자동 테스트 추가.
- 계약 원문·금액 검증·특약 자동정리·관리자 양식·가족모드·이미지 승인 기능 변화 없음. v2.0.51/build102.


## 2026-10-24 · v2.0.50 · 계약 누락정보 한 건씩 입력
- 누락 정보가 여러 개일 때 모든 입력칸을 세로로 늘어놓지 않고 항목 버튼을 고르면 **같은 위치에 해당 입력칸 하나만** 표시. 상세 입력화면으로 이동하지 않는다.
- 항목을 바꿔도 아직 적용하지 않은 값은 해당 작업 중 메모리에서 유지하고, 항목별 입력 적용 시 원본 계약 필드·미리보기·완료 상태를 즉시 다시 계산. 새 계약 시작 시 임시값 폐기. 영속 저장·외부 전송 없음.
- 누락된 **단지명/중도금 금액/중도금 날짜 확인**도 즉시 수정 목록에 포함. 가족의 직접 문구 수정 제한, 관리자 동일 기기 공통문구, 특약 자동 정리, 이미지 공유 전 검토 및 기존 데이터 기능 유지.
- v2.0.50/build101. 실기기 검증은 APK 설치 후 별도 필요.


## 2026-10-24 · v2.0.49 · 계약 제안 및 특약 입력
- 실제 최종합의 전 발송하는 거래조건 제안문에 맞춰 사전합의 확인란 3개 제거, 계약 성립/해제/중개보수는 조건 제안으로 작성.
- 기본 메모 + 별도 특약 메모 입력칸. 별도 특약은 무조건 특약으로 인식하고 읽기 좋은 문장으로 자동 정리해 안내 문자 및 PNG 이미지에 반영. 원문·정리문 비교 및 원문 선택 기능 유지.
- 누락 계약일·계좌 등은 현재 자리에서 바로 수정. 가족모드의 원문 직접 수정 숨김, 관리자 공통문구는 동일 기기 가족모드에 공유(타 기기 공통 반영은 별도 배포).
- v2.0.49/build100. 기존 v2.0.48 버전 복구 가능.


## 2026-10-24 · v2.0.48 · 계약 메모 / 확인 / 이미지 공유
- 부모님용 3단계 작성, 작은 메모 입력창과 안내 단순화. 메모 인식 후 핵심 금액/계좌 요약, 부족한 항목 즉시 수정으로 이동. 기존 자동 인식과 금액 계산, 계약조건 안전 확인은 유지.
- 계약성립·해제·중개보수 별도합의 문구는 명시적으로 수동 체크할 때만 넣고 변경/새 계약 시 재확인 및 상태 초기화. 이미지 공유는 내용 확인 뒤 가능.
- v2.0.48/build99. 복원 기준 v2.0.47 공식 릴리스 유지.



## 2026-10-24 · v2.0.47 · 업무 중심 시범 UI
- 기존 3개 대표 메뉴, 오늘요약/계약문자 고정 버튼, 7개 상세탭, 실거래/해제·갱신·계약 상태 보존.
- 오늘 요약은 액션(오늘 새 거래/관심14/단지검색)→자료수집상태→기존 누적통계 순으로 정리. 건수는 실제 KST first_seen_date 기준, 미수집과 0건 구별.
- 거래 필터는 선택되었을 때만 짧게 조건을 표시. 계약문자 긴 작성 단계는 기본 접힌 안내에 넣고 메모/작성/음성/필수 확인은 원형 유지.
- v2.0.47/build98, test_workflow_pilot.js 신규. 원복은 v2.0.46의 UI·JS를 높은 빌드로 재배포해 다운그레이드 데이터 삭제를 피한다.


## 2026-10-24 · v2.0.46 · 단지정보 7탭 사용자 스크린샷 반영
- 상단/본문 중복 단지명 제거, 제목/주소/탭 구조는 유지. 학교 경계·배정 주의사항 노출 유지하고 출처·기준일만 접어보기 처리.
- 카카오맵 외부 검색만 가능할 때 실시간 API 지원을 암시하던 안내 수정. 원문/실거래/학교/관리비/주변시설 컨트롤을 청록색 계열 시각규칙으로 정리. 모든 데이터/원본 링크/계약 연결 유지.
- 신규 정적 테스트 scripts/test_apartment_detail_tabs_polish.js와 기존 자동 검사, APK 2.0.46/97.


## 2026-10-24 · v2.0.45 · 중복 신고 배지 제거
- 실거래 카드의 신고/임대차 신고 중복 배지만 제거, 매매·전세·월세 / 중개거래·직거래 / 신규계약·갱신계약 배지 및 해제 상태, 해제일, 해제 검색 조건, 갱신 내용, 수집 실패 경고 모두 보존.
- tradeStatusBadge 공통 함수만 수정해 아파트 전체·관심 14·새 거래·오피스텔에 일괄 적용. 회귀검사 2종 수정, APK 2.0.45/build96.


## 2026-10-24 · v2.0.44 · 오피스텔 제목 강조선 단색 교정
- 사용자 지적은 제목선 길이가 아닌 유일한 그라데이션 색상. 해당 오피스텔 `::before`의 background만 실거래 단색 블루 변수로 변경. 길이/두께/위치/간격/다른 화면 모두 보존.
- 원인: 전역 그라데이션 CSS가 officetel 전용 단색 미지정으로 누출. `test_officetel_heading_color.js` 추가. v2.0.44/build95.


## 2026-10-24 · v2.0.43 · 전체 업무화면 디자인 피니시
- 갤럭시 스크린샷 10장 비교: 기존 구조/배치·색상 의미·정확성 경고 유지. 오래된 베이지 아파트 상세 시트와 과도한 계약 강조 테두리를 차분한 청록/아이보리 앱 톤으로 정돈.
- 단지 상세 주소/상세탭/정보 타일/관리사무소 통화 버튼, 계약 히어로/3단계 도움/메모 시작/생성·음성 입력 버튼 시각적 위계 및 터치 목표 보존. 오늘 요약·분양 공고·실거래/오피스텔/신규/관심카드 그림자 통일.
- 청약 공고 아이템 클래스 추가로 분양/접수 일정·공급세대·공식 공고 원문 구분 강화. API 응답·필터·공식 URL 검증 변경 없음.
- 테스트 `test_cross_screen_polish.js` 및 전체 CI, APK 2.0.43/build94. 실제 폰에서 시각 검증 필요.


## 2026-10-24 · v2.0.42 · 디자인 일관성 및 간결한 상태 문구
- 실제 갤럭시 캡처 3화면의 제목/메타데이터/검색 카드/뉴스 안내 시각적 위계 일치. 기능·탭 순서·화면 배치·안전영역 유지.
- 뉴스 가족모드 업데이트 시각 초 생략, KST YY.MM.DD HH:mm. 아파트 가족모드 등록 95건과 조회 93곳 중 혼란스러운 두 숫자 병기를 없애 조회 가능한 단지만 표시, 관리자 모드는 원자료 건수 보존. 실거래 부분 수집 오류 및 자료 갱신 오류 경고 보존.
- 새 테스트 `test_screenshot_consistency.js`, 빌드 93/v2.0.42.


## 2026-10-24 · v2.0.41 · Android 상태바 및 UI 밀도 보정
- 사용자 사진: 상태 시계/알림 아이콘과 회사 로고 충돌. SDK35+ edge-to-edge inset (status/cutout/navigation/IME) 보호용 `SystemBars.java` 추가, MainActivity·LockActivity 적용, 기존 로그인/앱 동작 유지.
- main 3탭/실거래 3하위버튼/전체매매전월세 4필터의 순서와 동작을 유지한 채 버튼 높이/두꺼운 테두리/반복 `✓ 선택됨`만 정돈. 수집 메타 시간 `YY.MM.DD HH:mm` KST 간략화.
- 정적 테스트 신규 `scripts/test_android_insets_presentation.js`, CI/버전 2.0.41(92). 실기기 최종 확인/배포 성공은 별도 검사.


## 2026-10-24 · v2.0.40 · 프리미엄 비주얼 전용 리뉴얼
- v2.0.39의 기능/페이지/DOM/데이터/API를 변경하지 않고 `ui-v2.css` 끝의 명시적인 시각 전용 계층으로 아이보리/청록/금빛 브랜드 표현, 부드러운 카드 표면/명확한 선택 버튼/정돈된 뉴스·계약·실거래 테두리와 그림자 개선.
- 거래 의미 색상과 기존 독립 14개 단지/줄바꿈/컴팩트 카드 크기·행 순서/가족-관리자 상태 유지.
- `scripts/test_premium_visual.js` 색 대비와 레이아웃 불변/기존 액션 확인 추가; APK 버전 2.0.40 (91), PR·CI·Release 결과로 성공 여부 판단.


## 2026-10-24 · v2.0.39 · 업데이트 최신 판정 개선
- 사용자 v2.0.37 설치 화면에서 최신으로 표시됐으나 점검 시 GitHub Release와 공개 app_latest.json은 모두 v2.0.38이었다. 휴대폰의 실제 HTTP 응답은 확보하지 못했으므로 캐시를 확정 원인으로 단정하지 않음. 소스상 이전 버전도 latest로 판정하고 첫 available 응답으로 조기 종료하던 문제를 수정.
- 매 요청 UUID 쿼리/no-store/no-cache로 두 고정 경로를 모두 조회, APK 자산을 검증한 최고 버전 선택. 낮은 버전은 stale, 동일 버전은 latest, 더 높은 버전만 available. 동일 버전에도 APK 존재 검증, draft/prerelease/과대 파일 차단. 기존 패키지·고정 서명·높은 build 검증은 그대로.
- JS 확인 버튼 및 네이티브 AtomicBoolean으로 중복 조회 방지, 재조회 시 낡은 설치 배너/URL 초기화, 실패/오래된 정보는 공식 다운로드 안내. 최신 안내에는 확인한 버전 번호 표시.
- AppUpdateTest 7개 JVM 테스트로 오래된 primary+새 index, 두 경로 순서/버전 비교, 낮은 정보, 잘못된 APK, 1개 경로 실패, 무작위 요청 URL 검증. GitHub Actions에서 testDebugUnitTest 성공 후만 APK 빌드/배포. 구버전은 이 코드가 없으므로 수정 APK 직접 설치 경로도 제공. 이전 v2.0.38 화면 변경 보존. v2.0.39(90) 실제 CI·배포 확인 필요.


## 2026-10-24 · v2.0.38 · 실거래 정보·갱신계약 배치 정리
- 사용자 스크린샷의 층수 단독 줄바꿈과 갱신금액/기간의 어중간한 줄바꿈 개선. 전체 실거래·관심단지 상세·새 거래·오피스텔에서 `tradeCardFacts` 공통 사용: 첫 줄 계약일/층, 둘째 줄 전용면적/검증 평형. 새 거래의 발견일과 실제 계약일 구분 유지. 빈 층을 `층 정보 없음층`으로 중복 표기하던 부분도 정리.
- `tradeRenewalDetails`는 4개 항목을 의미 있는 dt/dd 한 줄씩 정렬. 갱신 계약에만 표시하고 미기재와 실제 0, 사용/미사용 구분 유지. 월세의 보증금/월세는 `tradeAmount`에서 각각 한 묶음으로 줄바꿈. 원본 금액·갱신 필드·단지 데이터 무변경.
- 오피스텔의 거래 상세정보 펼침 및 지번 숫자/거래방식 중복 제거. 거래 방식 배지와 해제일, 원본 JSON은 보존. 오피스텔 평형을 아파트 정보로 추정하지 않음.
- 검증: 89개 Python 테스트, 관련 JS 회귀 검사, 한글 폰트로 실제 공개 거래를 사용한 4개 화면 × 320/360/390/430px 배치/갱신값 줄바꿈/가로 넘침 검사. 실제 Android 단말은 미검증. 버전 2.0.38(89), 고정 서명 배포는 Actions/Release 결과 확인.


## 2026-10-24 · v2.0.37 · 관심단지 단지명·건수 가독성
- 긴 단지명이 애매하게 두 줄로 꺾이지 않도록 휴대폰 관심단지 목록을 한 열의 짧은 가로 카드로 변경. 700px 이상은 두 열. 16px 단지명과 별표·화살표를 보존하며 카드 고정 높이 없음.
- 거래 건수의 굵은 청록색 강조와 b 마크업을 제거하고 최근 계약일과 동일한 13px 보조 글자·색상·굵기로 통일. 집계기간·14개 ID·상세 전환·최근 계약일 계산 및 아파트정보 카드는 유지.
- 회귀 테스트 및 320/360/390/430/700px 화면 점검 후 고정 서명 v2.0.37(88) 릴리스 검증. 실제 배포 상태는 Actions/Release 확인.


## v2.0.36 · 2026-10-24 · Precise contract coverage status
- `favoriteCollectionScope()`: show '일부 월 미수집' only when `missing_buckets` is nonempty; when `state='partial'` but monthly snapshots exist, show '일부 자료 갱신 오류' instead. Preserve v2.0.35 compact card UI and existing IDs. Bump Android `versionName` to 2.0.36, code 87, with matching immutable-release GitHub workflow tag; verify published release before claiming installed availability.


## v2.0.35 · 2026-10-24 · Compact favorites and apartment catalog cards
- `app/src/main/assets/index.html`: renderNearby() displays only ★ + full favorite label (no inconsistent '주변 핵심단지' header), separate count and latest full contract date, plus visible 12-month contract collection scope derived from source `checked_at`. Partial snapshots show a coverage warning; uninitialized snapshots do not pretend to have zero deals.
- `renderComplexes()`: compact rows with full proper names, verified cadastral lot address first (otherwise road address), short form only on summary card, verified household count. Entire detail panel still uses source-backed full address and information.
- `ui-v2.css`: favorites use compact 2-column density; apartment catalogue uses 1-column accessible address rows on mobile, 2-column on large screens. Preserves tap targets, contrast and selected state. `scripts/test_compact_complex_cards.js` regression introduced.
- `app/build.gradle`, build workflow: v2.0.35 / code 86. Relax updater test version literal to a semantic-version validity check. Release status must be checked independently.


- **2026-10-24 / v2.0.34 하위 2분할 스위치 디자인 통일**: 실거래 아파트·오피스텔 4개 화면(전체·관심·새 거래·오피스텔)과 뉴스의 뉴스 브리핑·인천 청약·분양 전환을 하나의 공유 `.sectionModeSwitch` 세그먼트 디자인으로 맞춤. 2분할 같은 부모 프레임/패딩 6px/버튼 높이 62px(모바일 59px)/라운드 18/13px/타이포·그림자·선택 상태/포커스/애니메이션 통일. 실거래 data-tone=teal 청록색, 뉴스 data-tone=purple 보라색 브랜드 색은 분리 보존. 뉴스 선택 상태 중복 ✓ 아이콘 제거, 기존 `switchNewsPane` 클릭·aria-selected·실제 뉴스/분양 갱신·실거래 모드 전환 onclick·aria-pressed 유지. 작은 스마트폰과 움직임 줄이기 접근성 규칙 포함. 기존 3개 대메뉴와 하위 업무 버튼, 계약·실거래·학군·관리비 기능 변경 없음. 테스트 `scripts/test_segmented_switch_unity.js` 신규 + 이전 nav/public/office 테스트의 클래스 이름 가정 최신화, APK v2.0.34 versionCode 85. 빌드/배포 성패는 실제 Actions 및 Release에서 확인해야 함.

- **2026-10-24 / v2.0.33 업데이트 확인 실패 복구**: 사용자 실제 v2.0.31(빌드82) 화면의 `새 버전을 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.` 제보 확인. v2.0.32 APK는 GitHub Release에 정상 존재하며 기존 `AppUpdate.check`가 `api.github.com/.../releases/latest` 한 경로만 읽고 실패 시 무조건 `offline` 처리하는 구조가 문제 가능성이 큼(실제 단말 네트워크 오류/HTTP 상태 직접 관찰은 불가). v2.0.33 `AppUpdate.java`는 GitHub API 확인 실패·이상 응답·오래된 latest인 경우 `raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/app_latest.json` 예비 경로를 확인; **두 경로 모두 동일한 엄격한 `readRelease` tag/asset/url/크기 검증**, 앱 APK 설치 시 기존 동일 패키지/고정 서명 인증서/증가 버전 검사 유지. GitHub 릴리스 성공·손상 없는 서명 APK 확인 후 `scripts/publish_app_release_index.py`가 GH Actions 토큰으로 원본 JSON 공식 버전 포인터를 자동 게시하며 구버전으로 되돌리는 게시를 거절. 두 경로 실패 시 앱 푸터에서 공식 Releases 최신 페이지로 가는 링크 노출, 인터넷 탓으로만 단정하는 오류문구 제거. 검증 테스트 `tests/test_release_index.py`, `scripts/test_update_fallback.js`, v2.0.33 versionCode 84. 기존 v2.0.31·32에 예비 경로 코드는 없으므로 처음 복구시에는 새 릴리스 APK 직접 덮어씌워야 할 수 있음. Release 배포 성공 전에는 앱 내 업데이트 복구 완료라고 단정 금지.

- **2026-10-24 / v2.0.32 관심 14개·개별 단지 거래유형 버튼에 건수 통합**: 사용자가 제공한 관심 14개 전체/마스터뷰21/퍼스트파크13 실거래 상세 비교 캡처를 반영. 이전 `전체·매매·전세·월세` 4개 필터 버튼과 별도의 `전체 N건·매매 N건·전세 N건·월세 N건` 정보 뱃지 4개의 중복 표시를 없앰. `nearbyDetails` 단일 `nearbyTypeBar`의 클릭 가능한 각 버튼에서 `전체↵N건`, `매매↵N건`, `전세↵N건`, `월세↵N건`으로 2행 라벨과 건수 표시. 원래 14개 통합/단지별 필터 상태와 색상, 전체·매매·전세·월세 필터 선택 기능 유지. 전용면적을 선택하면 각 버튼 수치는 해당 면적에서 집계(필터 선택 상태와 무관하게 4개 유형별 모두 접근 가능). 실거래 데이터 미수집 상태에서는 임의 0 대신 `—` 표시. 결과 `N건 중 40건 표시`는 페이징 안내라 유지, 원문 카드 내용 변경 없음. 새 테스트 `scripts/test_favorite_trade_count_buttons.js`, v2.0.32 code83 CI 반영. signed APK 실제 배포 성공은 workflow 검증 필요.

- **2026-10-24 / v2.0.31 세 대메뉴 상단 위계·타이포 통일**: 사용자의 5장 비교 이미지 피드백(실거래/아파트정보/오피스텔/뉴스/청약)을 반영해 공통 상단 3메뉴→오늘 요약·계약문자→페이지 h2 제목+갱신→해당 화면 전환 버튼 순서로 통일. 실거래 아파트/오피스텔 전환을 공통 nav 내부에서 각 거래 화면 heading 아래로 이동(실거래/관심/새거래/오피스텔 4곳, 1개 현재 화면만 표시). 아파트 실거래 3개 하위버튼은 현행 페이지 내부 유지. 뉴스는 상단 '뉴스·청약/분양' 중복 일반 제목 및 하위 h3들을 제거하고 하나의 동적 h2(‘송도·부동산 뉴스 브리핑’ 또는 ‘인천광역시 청약·분양’)로 동급 제목 글꼴 22px(모바일 20px) 통일, 동일 위치의 ‘갱신’ 버튼이 실제 현재 패널별 뉴스 또는 공공청약 API로 정확히 연결. 청약 패널 중복 '공고 갱신' 삭제(같은 동작은 상단 갱신으로 보존). 정보 검색/상세 필터/알림/거래 데이터/가족·관리자 권한은 유지. v2.0.31 versionCode 82. 테스트 test_unified_top_layout.js 및 기존 navigation/public/office 테스트 갱신. CI 서명 배포 성공은 Actions 실제 실행 결과로 따로 확인해야 함.

- **2026-10-24 / v2.0.30 새 거래 화면 직관성 개선**: 사용자 스크린샷의 날짜/유형/검색/단지/4개 건수칩/반복 수집안내가 한 화면에서 시선을 분산시키는 문제 수정. 단일 패널에 큰 날짜 셀렉트, 전체·매매·전세·월세 4개 터치칩, 아파트 이름 검색, 관심 14개만 토글, 검색 조건과 맞는 총 건수+유형별 짧은 요약 1개를 배치. 정상 수집은 반복 문구 제거, 일부 수집 실패 시에는 안내를 남김. 기존 신규 확인일(first_seen_date)과 실제 계약일의 구분/알림 포커스/관심 14개 필터, 최대 120건, 기간 31일, 단지 검색 기능은 유지. 유형·관심 기존 select ID는 숨긴 채 보존하여 다른 기능과의 호환성을 유지. 접근성 aria-pressed 및 49px 이상 손쉬운 버튼 영역 적용. v2.0.30 code81, 새 JS 회귀 테스트 추가. 서명된 APK 배포 성공은 별도 확인 후 사용자에게 안내.

- **2026-10-24 / v2.0.29 실거래 중복 내비게이션 정리**: 사용자가 하단 3버튼 UI를 선호해 v2.0.28 상단 거래 하위메뉴(`전체 최신 거래 · 관심 14개 · 새 거래`)를 전부 제거. 아파트 실거래의 `전체 최신순 · 관심 14개 · 아파트 선택` 버튼 세트를 `전체 최신순 · 관심 14개 · 새 거래`로 교체하고 실거래·관심·새거래 페이지 각각의 본문 패널 위쪽에 동일한 3버튼 행 1개씩(현 화면만 렌더) 표시. 각 페이지에서 해당 버튼만 active/aria-current=page. 이전 별도 아파트선택 진입 버튼은 삭제, 세부검색 패널의 아파트명 직접검색/기간/유형/해제 필터는 유지. 오피스텔 화면은 별도 검색 UX 유지. `test_navigation_clarity.js`, `test_family_accessibility.js`, `test_public_hub.js` 구 테스트 가정을 새 UI에 맞게 갱신. Gradle versionCode 80/versionName 2.0.29, APK workflow release tag v2.0.29. 테스트는 빌드 파이프라인에서 통과하였으나 실제 APK/Release 결과는 별도 확인 필요.

- **2026-10-24 / v2.0.28 메뉴 배치 통일**: 사용자가 제공한 세 대표 탭 스크린샷 비교 결과, 실거래에서만 `아파트 | 오피스텔`과 거래 하위메뉴가 `오늘 요약 | 계약문자 만들기`보다 위로 배치되는 불일치를 수정. `app/src/main/assets/index.html`의 `renderMainNavigation`에서 `primary + tools + propertySwitch + secondary` 순으로 렌더링해 모든 대메뉴의 빠른 업무 버튼을 동일한 위치로 통일. 기존 전환 대상/상태/가족·관리자 권한은 그대로 유지. `scripts/test_navigation_clarity.js`에 8개 화면×가족/관리자 순서 검증을 추가하고 코드로 16개 상태의 실제 렌더링 순서를 확인. `app/build.gradle` v2.0.28 / versionCode 79 및 APK release workflow/버전 테스트 일치. 커밋은 적용되었으나 서명된 Release APK 배포 성공 여부는 Actions 후 별도 검증 필요.

- **2026-10-24 / 관리비 실자료 확대 — 9개 관심 단지 직접 검증**: 기존 자동 API 수집이 전체 단지 자료를 게시하지 못하는 문제와 별도로, K-apt 관리비 공개자료를 재게시하는 페이지들의 단지코드·송도 도로명 주소·기준월·공용관리비+개별사용료+장기수선충당금 합계·㎡당 주거전용면적 단가를 개별 확인한 8개 단지를 `data/maintenance_estimates.json`에 추가. 기존 f15 보존해 총 **9개**(f13,f14,f15,m21,m22,avenue,skcentral,central3,kapt-a10027887); 확인된 추가 과거월 6건도 `monthly_history`에 저장. f13의 누락 K-apt ID A10026678을 원문 도로명주소 `컨벤시아대로252번길 70`과 대조해 `data/complexes.json`에 복원. 데이터는 **기준월 2026-06~08 공개 확인값**이며 현재월 실제 청구액이 아님. source_url은 각 월별 재게시 페이지(contents.html인 경우 출처에 월 확인). 현재 공식 API 자동 동기화 성공을 보증하지 않음; 14개 관심 단지 중 나머지 5개는 검증된 단가가 없어 여전히 확인 중. `tests/test_maintenance_seed.py`가 단지코드/월별 원본/합계/보존 검증. 1만원 단위 상담 참고액 계산 JS 실데이터 9개 단지 시험 확인. 앱 기존 API JSON 새로고침으로 게시 자료 수신 가능; APK 릴리스 성공 별도 확인 필요.

- **2026-10-24 / v2.0.27 관리비 1만원 단위 상담형 UI·월별 이력**: 사용자는 세대별 관리비 1원 단위 정밀도가 아닌 대략적인 월 비용(약 20만/30만원)을 원함. 단일 수치를 1만원 단위로 반올림하고 최신 확인월, 최근 12개월 중 검증한 월의 평균·최소·최대(3개월 이상), 전월·전년동월 비교(해당 월 존재 시만), 선택형 월별 차트 추가. 오래된 공개월 안내, 누락월/0원 가공 금지, 최대 24개월 출처가 있는 K-apt 기록 보존, 매월 5·18·28일 수집 재확인. 새 공식 API 수집기는 퍼스트파크15BL 2026-07 기준으로 84.7㎡ 가정 비교액의 차이가 1만원 이내일 때만 파서 해석을 검증(항목별 10% 초과 불일치도 차단); **이 값은 파서 품질검사용이며 실제 세대 청구액이 ±1만원 이내라는 보증이 아니다. 계절별 실제 변동은 전혀 제한하지 않음.** 새 APK v2.0.27 소스 구성, UI/단위 테스트 추가. GitHub Actions 실제 API 자료 게시와 signed Release 생성 여부는 별도 확인 필요. 확인된 게시자료는 기존 F15 202607 한 개뿐인 상태에서 신규 자료 있다고 주장하지 않음.


- **2026-10-24 / 관리비 공식 API 연결 (데이터 수집 기능, APK 버전 변경 없음)**: `scripts/collect_official_maintenance.py` 추가. 신규 승인된 세 공식 K-apt 서비스(공용 16개 항목, 개별 10개 항목, 장기수선 월 부과액 1개 항목)를 `DATA_GO_KR_SERVICE_KEY`로 서버 측 GitHub Actions에서 수집하도록 `sync-maintenance-averages.yml` 연결. API 응답 단지코드/기준월/금액/부과면적 검사; 퍼스트파크15BL 2026-07 공용 115,610,190원·개별 145,310,174원·장기수선 9,841,930원 및 주거전용면적 70,685.27㎡와 3종 모두 일치할 때만 그 파서로 다른 단지의 월별 전체 관리비를 계산, 면적당 단가 및 출처를 기존 `data/maintenance_estimates.json`에 기록. 미검증·에러·불완전 값은 임의 0원 처리하지 않고 기존 F15 기준값 보존. 출처별 단지 전체 참고액이지 개별 세대 고지액이 아님. 한 달치 기준으로 API 호출 수 제한, `tests/test_official_maintenance.py` 추가. **주의: 자동 워크플로의 실환경 실행 결과를 이 도구에서 아직 검증하지 못했으며 모든 단지의 수치 반영 완료로 주장하지 않는다.** 기존 비공식 미러 수집기는 별도 참고용으로 남기고 공식 워크플로의 게시 단계에서는 실행하지 않음.

- **2026-10-23 / v2.0.26**: User has newly approved all three `data.go.kr` K-apt cost API groups (common, individual usage, repair reserve). Separate official group probe script `scripts/probe_maintenance_three_apis.py` uses existing `DATA_GO_KR_SERVICE_KEY` in GitHub Actions and checks official AptCmnuseManageCostServiceV3, AptIndvdlzManageCostServiceV3, AptRepairsCostServiceV3 for an exact Songdo complex with latest two likely public months. Only safe status/schematic public keys are logged, never auth key/URL/payload. Legacy apt.koreacharts.com mirror still unreliable; preserve verified F15 202607 rate and do not fabricate estimates. Next step: compare live official results and implement full billing-total/relevant fee-area normalization as warranted before claiming all buildings' fees.


- **2026-10-23 / v2.0.25**: Remove redundant full-width explanation from newly-detected trades page without changing first-seen-vs-contract-date semantics, filters or record provenance. Compact bottom footer into a responsive version + one update button row; installed version remains from Android package info, existing secure updater and status preserved, repetitive app description removed. Diagnosed empty management-fee collector: GitHub runner cannot connect to third-party apt.koreacharts.com mirror (URLError), but public official K-apt weekly board is available (HTTP 200) and publishes weekly workbook data; verification is *not* proof data nonexistent. Seeded only F15BL official K-apt re-published **2026-07** complete total rate (3,831 won/exclusive m2; total 270,762,294 won; code A10026679) with exact-source public citation. Other complexes remain pending rather than fabricated and link to K-apt manual source. Automatic full coverage needs reliable direct official weekly XLSX ingest or authorized complete official API; do not claim otherwise. Maintains apartment/officetel segregation, verified address/school, signing and update.


- **2026-10-23 / v2.0.24**: Unify separate officetel-only trade UI with existing apartment trade interaction: latest/search mode, exact building and area selectors, type bar, expandable advanced name/date/status/area filters and identical `dealRow` cards; preserve independent `public_services.office_sales` and `office_rents`, approval-waiting states, official sale cancellation, and no mixing. Add independent monthly `scripts/collect_maintenance_averages.py` with strict apartment code, exact K-apt road address, published month and total management fee per residential-exclusivem2 unit validation against K-apt-derived public mirror; snapshot `data/maintenance_estimates.json` and monthly GitHub Actions. Apartment verified supply/exclusive pairs may display approximate per-type fee `won_per_exclusive_m2 * exclusive_m2`, with source and month, labelled consultation reference **not actual per-household invoice**. Data source unavailable or absent yields pending, never guessed values. Tests updated; v2.0.24/versionCode 75. Preserve security, signature, contract, school, native Kakao.


- **2026-10-23 / v2.0.23**: Fixed Android `MainActivity.JavaScriptBridge.fetchNearby()` host allowlist silently rejecting every live Kakao Nearby request with '주변시설 서비스 주소 또는 요청 형식이 잘못되었습니다.'; native previously hardcoded defunct `firsthyundai-kakao.jwj2477.workers.dev`, but `data/nearby_config.json`, WebView URL allowlist and deployed `workers/kakao-nearby/wrangler.toml` all use `firsthyundai-nearby.jwj2477.workers.dev`. Strictly match the latter (no broad untrusted hosts), add cross-layer regression in `scripts/test_kakao_nearby.mjs` checking native, WebView, config and Worker deployment, and trigger safe live Kakao key/Worker health checks in GitHub Actions when this code changes. Increment versionCode 74 / versionName 2.0.23, retain fixed release signature; no client-side secret, original features unaffected. Validate successful live diagnostics and release separately.


- **2026-10-23 / v2.0.22**: F15BL was truly within official Songil elementary-zone polygon; removed 100m overconservative cutoff, now require unique normal polygon and >=35m clearance (real F15 reference coordinate ~85m). Added regression. Kakao exact matching returns verified legal lot addresses into public `school_districts.lot_addresses` without publishing key. F15 lot 주소 verified 송도동 102. Cadastral lot displayed as main, road address as secondary in apartment detail; auto contract memo and address field prioritize lot. Removed duplicative building/contract and whole-complex partial management-fee cards. Renamed public tab `관리비` with per-verified-area selector. No fabricated area-level bill from K-apt complex-wide costs; only verified exact monthly invoice entries may display. All security/contract and native update logic unchanged.


- **2026-10-23 / v2.0.21**: Analyzed user-supplied official 2026-09-20 Korea Educational Facilities Safety Institute elementary-zone nationwide SHP (EPSG:5186). Converted and verified 34 Yeonsu-gu school-zone polygons to compact WGS84 polyline geometry in data/school_zones_yeonsu.json. Added independent Schoolinfo school-basic-info API collector (2026 mandatory sidoCode=28, sggCode=28185) and optional exact-road-address Kakao geocoder using private GitHub Secrets. Only single ordinary zone with 100m boundary clearance appears as an elementary **zone reference**, not guaranteed school assignment. No inferred matches for missing coordinates, ambiguous addresses, joint zones, or boundaries; old validated Songdo school info and all apartment/contract/security functions retained. Weekly guarded collection, automated tests and v2.0.21 APK. Real API success requires configured secrets.


- **2026-10-23 / v2.0.20**: Also label only the current `가족 모드`/`관리자 모드` in the small header switch, keeping secure mode transitions and accessible action labels intact. Remove the duplicate apartment lookup scope dropdown (`송도 전체 아파트` versus `관심 14개 단지만`) and its associated filter state/CSS. Apartment information continues to show all Songdo complexes by default with a single full-width name search. The separate favorite-14 trading navigation and direct complex-detail links stay unchanged. Updated regression tests, incremented Android build number, and retained fixed signing/update flow.

- **2026-10-23 / v2.0.19**: Upper property type switch in real-transaction primary menu, apartments default and officetel mode isolated from apartment menus/records. Official independent RTMSDataSvcOffiTrade API collector with cancellation tags, distinct `office_sales` approval-gated snapshot; existing verified rental records preserved. No bottom-only entry, same signer.

- **2026-10-23 / v2.0.18**: On-demand isolated officetel rental page opened by unobtrusive bottom-of-trades link; keep unchanged home and 3 main categories. Compact default view, stored optional expanded detailed filters + 40-result pagination. Reuse already-implemented protected official OffiRent XML collector from Actions and schedule safe daily attempts; only mark verified after successful API response and full data retrieval, retain snapshot on failure. Add regression tests and release bump.

- **2026-10-23 / v2.0.17**: Native direct-download installer using pinned GitHub release URL with strict package/installed signer/higher build validation; FileProvider, scoped cache, progress, and Android system install approval. Compact admin header button; expandable one-row interest-trade notifications and reduced repetitive explanatory prose; regression tests and versionCode 68.

- **2026-10-22 / v2.0.16**: Contract interim payment date in rendered customer notice now uses the existing dateLabel helper (YYYY.MM.DD.) shared by contract/balance dates. Raw ISO form fields and flexible agreed schedules remain unmodified; date formatting regression tests added. APK release version 2.0.16/67, immutable signer reused.

- **2026-10-22 / v2.0.15**: Replace low-quality one-tone office launcher with high-DPI-safe premium gold-on-emerald FHD FIRST **layered original-vector** emblem across launcher, startup welcome and header. Metallic gradient via aapt complex color, fine glints/embossing, no raster upscale/cropped FIRST lettering, maintains contract image's approved teal/white logo (original fill attrs untouched). Stable Android release signing and all existing features preserved.

- **2026-10-22 / v2.0.14**: Release signing now requires single private GitHub secret FHD_SIGNING_BUNDLE_B64 with stable PKCS12 key, pinned signer SHA-256; never release a debug-signed APK. Native installed-vs-GitHub Release update checker and browser download, 1-second original FHD welcome, compact recolored teal header. First migration may require one-time backup/reinstall. Pending user registration of signing Secret.

- **2026-10-22 / v2.0.13**: Add one small fixed 44px ↑ scroll-to-top FAB used across all tabs and both apartment fullscreen details. Visible only beyond 240px; smooth scroll with reduced-motion support; correct active scroll root; Android insets and bottom content spacing avoid obstruction. Tests assert main/sheet navigation, background scroll preservation, and user-friendly placement.

- **2026-10-22 / v2.0.12**: Customer contract PNG actual partial remittance amount (e.g. 500만원) now exactly matches bank/account/payee teal `#0c6269` instead of terracotta `#AC3930`. Font emphasis and content unchanged. Tests assert both amount and bank canvas fill colors; preserve all v2.0.11 functionality.

- **2026-10-22 / v2.0.11**: Publish 31 real Songdo-dong running schools (16 elementary, 9 middle, 6 high) directly from an owner-provided official 2026-10-01 Korea Education Facilities school-location CSV. School-ID/address/coordinates/date validated; no nationwide raw file or private data committed. App shows verified CSV source/date and school map link without NEIS/standard API connectivity. Re-import safeguards and tests added. No unverified school assignments.

- **2026-10-22 / v2.0.10**: Add independently verified official nationwide school-location API fallback for NEIS HTTP 500: separate `school_locations` source and strict full-page validation/operating schools/Songdo lot address/coordinates. Snapshot retained on API denial/failure. NEIS source takes precedence when verified. School directory shows school level, official source/updated time, safe map link, never asserts school assignment; hides misleading "register key" message. Regression tests for provider failures and UI; API endpoint has separate automatic usage approval, not assumed working without live verification.

- **2026-10-22 / v2.0.9**: Contract date/explicit signing window now mandatory in all contract types and shown in existing parent missing-items banner, invalidates approval, marks red pending preview until supplied. Make one banner more conspicuous. Inline emphasize actual remittance amount alongside already emphasized bank/account/payee; no redundant card. Correct an earlier regex escape bug in the renderer and introduce targeted CI coverage.

- **2026-10-22 / v2.0.8**: Customer contract PNG keeps exact original FHD FIRST SVG paths (recolor only), removes oversized duplicate transfer/account box, highlights bank/account/payee subtly INLINE within their original legal paragraph, removes bottom footer entirely. No contract wording or transfer amount modified; the same approved plaintext is rendered. Regression tests now assert inline runs, no second card and no footer. v2.0.7 Kakao fix retained.

- **2026-10-22 / v2.0.7**: After rotating leaked Kakao REST key, GitHub actions successfully deployed workers/kakao-nearby to firsthyundai-nearby.jwj2477.workers.dev. App code and public config still pointed to nonexistent firsthyundai-kakao.jwj2477.workers.dev, resulting in HTTP 403. Corrected both URL sources; added Wrangler-vs-app-vs-config regression assertion and live verify trigger on config changes. Secret remains private; prior APK needs replacement.

- **2026-10-22 / v2.0.6**: On-device contract image generator uses exact officeMarkSvg Path2D path data, recolouring only for document tone; removes sender-only footer. Highlights reviewed message's actual today remittance and bank/account/payee in a separate customer-first card before special clauses. Covers midpayment, rent, deposits, final balance with consistent money emphasis. Guards against conflating full deposit and today's partial transfer; no invented financial figures.

- **2026-10-22 / v2.0.5**: Family contract UX: eliminate redundant notice-inclusion toggle and consent checkbox, plus repeated help/success panels. Always include the office's pre-negotiated formation/cancellation/forfeiture/brokerage wording in generated SMS drafts; generated-draft validity, approval button and missing-placeholder checks still required before sharing. Show a missing-fields warning only when actionable and keep clause context admin-only.

- **2026-10-22 / v2.0.4**: Add official `contract_date` date-range search (inclusive) to the existing trade advanced filters. Simple day-only and reset controls, reversible range validation, preserving building/area/type/cancelled filters. Navigating into a selected complex clears prior dates. New `scripts/test_trade_contract_date_filter.js` in CI; Gradle APK metadata 2.0.4/55 and versioned release workflow. No API/transaction data changes. Verify Actions success and actual release artifact separately.

- **2026-10-22 / v2.0.3**: Simplify sale/lease/monthly transaction cards using primary type and quiet supporting status/dealing/lease-contract labels; remove brackets around renewed/new agreement chips and hide unknown classification. Three-state parent-facing confirmation button (pending disabled, ready, confirmed) now reacts to consent revocation, edits, and changing contract conditions; preserve share validation and red missing-field preview.

- **2026-10-22 / v2.0.2**: Family contract review UX: replace noisy parser diagnostics and duplicated required-field instructions with one prominent plain-Korean missing-info warning; safe HTML-escaped read-only red-underlined pending placeholders, direct edit toggle over existing plaintext textarea, admin retains diagnostics; no sharing of unfinished placeholders. Existing contract data and native SMS remain unchanged.

- **2026-10-22 / v2.0.1**: Full source-catalog exclusive-area audit (93 individual Songdo complexes, 576 verified pairs, 185 previously hidden exclusive-only areas across 41 sites); live + stored official trade area fallback without made-up supply or pyeong; visible apartment-to-contract memo/property/address/type prefill with explicit draft overwrite confirmation and prior client data reset; type cards link directly to contract; dedicated regression tests.

- **2026-10-22 / v2.0.0**: Major family-first commercial-grade UI refresh. Added ui-v2.css as a standalone override sheet, explicit distinct active hues per workflow (blue/teal/purple/indigo/terracotta), neutral inactive tabs, checked active-state labeling, refined card/input/nav systems and Android native theme. Existing parsed contract data, announcements, roles, trade feeds and one-sheet PNG untouched.

- **2026-10-22 / v1.19.18**: Consolidated navigation to remove duplicate dead-end submenu buttons on apartments and news; retained three distinct trade pages, two real news/lottery tabs, and prominent apartment search/scope controls. Pressing selected apartments focuses search, primary news resets to briefing. Added navigation behavior tests and kept existing family/admin authorization and contract actions.

- **2026-10-22 / v1.19.17**: Color-code writable contract memo (apricot/cream) versus lookup/filter (mint) and confirm/attention statuses (green/amber) without relying solely on hue. Keep strong text labels, focus/selection outlines, primary teal action, and all existing contract workflows. New static contrast and role tests.

- **2026-10-22 / v1.19.16**: Split family vs admin density for static explanation paragraphs and live news metadata; preserve compact family safety notes and actionable controls, required legal/financial confirmations and Android notification warnings. Refresh button no longer wraps vertically; role switches update without reload.

- **2026-10-22 / v1.19.15**: Family-first accessible redesign: consistent high-contrast lagoon teal, porcelain mint and warm peach across app screens, larger touch/text, visible active outlines and semantic state attributes. Native security gate colors and one-sheet contract PNG branding aligned without changing business logic; static color contrast/touch/regression checks.

- **2026-10-22 / v1.19.14**: Made one-memo contract entry unmistakable for family users using a large labeled step-one card, 3px entry borders, higher legibility, focus visibility, tactile primary/voice buttons, stacked mobile layout; maintained all existing memo IDs and handlers and added UI regression test.

- **2026-10-21 / v1.19.13**: Payment rows after special clauses excluded, inline special headers preserved; negotiated contract signing windows and precise dates recognized in free-text field; payee on bank line prioritized with explicit verification warning; synthetic regression tests.

- **2026-10-21 / v1.19.12**: Recognize bare balance dates with two-digit years; unlabeled interim/balance scheduling and repair terms. Redesigned single-PNG premium customer contract cards from final approved preview text, with complete legal text and overflow rejection.

- **2026-10-21 / v1.19.11**: Fixed interim amount followed by malformed schedule; explicit review gate for invalid date; inferred standalone repair and agreed-date special clauses; removed deposit remainder from customer notice. Synthetic regression fixtures.

- **2026-10-21 / v1.19.10**: Unique name as a local payee draft irrespective of bank proximity, transfer colloquialisms and guarded ambiguous-role handling. Fictional regression samples only.

- **2026-10-21 / v1.19.9**: Added on-device Canvas contract image cards, multi-page preview and native content-URI image sharing; new regression test, Java FileProvider configuration. Verify CI/Release before claiming deployed.
> 작성일 2026-10-21. 다음 AI 개발자는 **기능 수정과 함께 이 문서를 갱신**해, 변경·테스트·배포·미완료를 분리해 기록한다.

## 2026-10-21 · v1.19.8 — 새 실거래 알림 팝업 디자인
- 문제: v1.19.7 알림 감지/OS 권한은 배포됐지만 최종 팝업 디자인 요청이 남음.
- 변경: `trade-alerts.js`의 예시 미리보기·세션 내 Later/reopen·입력 방해 방지·거래별 정보; `index.html`의 배너/모달·미리보기 진입점·여러 날짜 알림 필터; `theme.css`의 따뜻한 반응형 디자인.
- 검증: 최초 기준선, 중복/꺼짐/권한, 미리보기 격리, 미기재 금액을 0원으로 표시하지 않음, 멀티 날짜 이동, HTML 이스케이프와 기존 특약/갱신 상세 테스트.
- 화면 검증: Chromium 320/390/480px에서 미리보기·나중에/재열기·여러 날짜 거래 이동·뒤로가기·가로 넘침 없음 및 JS 오류 없음 확인. 실제 삼성 단말 OS 알림은 미검증.
- 한계: 앱 실행/갱신 시 감지, 종료 중 푸시 없음. Later 보관은 현재 세션, 기기 재시작 후 보관함 아님. 실휴대폰 OS 동작은 별도 확인 필요.
- 배포: v1.19.8/40 대상으로 빌드 후 Actions와 Release 검증. 빌드 과정에서 동일 버전 인수인계 MD/ZIP도 첨부.

## 2026-10-21 · 기억 손실 대응 / 여러 AI의 협업을 위한 문서화
- **사용자 요청:** ChatGPT의 이전 대화가 사라지거나 Gemini·Claude 등 모델을 교체하더라도 앱 목적·이력·합의된 요구·수정 진행을 안전하게 이어받을 별도 백업을 원함.
- **결정:** 공개 저장소 최상단 `AGENTS.md`, `CLAUDE.md`를 공통 AI 진입점으로 구성. `docs/AI_HANDOFF.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/PROJECT_HISTORY.md`, `docs/RECOVERY_PLAYBOOK.md`, 이 로그에 검증 가능한 맥락을 분산 보관.
- **검증:** 현재 `main`·최신 성공 릴리스 v1.19.7·아파트/뉴스/학교 공개 JSON·안드로이드 소스 및 CI·기존 README를 비교. **README의 v1.11 기준 서술은 일부 최신 기능과 불일치**하므로 문서 우선순위를 바로잡음.
- **개인정보:** 키 원문, 개인 연락처, 계약/계좌, 가족/관리자 비밀번호, 기기 로컬 메모는 포함하지 않음.
- **유지관리:** 이후 실제 기능이 바뀌면 구현/테스트/Release와 동시에 문서를 갱신하고 별도 AI 백업본을 다시 발행.
- **미완료:** 이 문서들만으로 사용자와 AI 사이의 **모든 대화 원문을 100% 복원할 수는 없음**. 사용자 본인의 대화 내보내기/별도 보존이 필요. 로컬 메모도 독립 백업 필요.

## 2026-10-21 · v1.19.7 — 안드로이드 알림 권한 / 알림센터
- **이유:** 사용자 휴대폰 '애플리케이션 정보 → 알림: 차단됨, 요청된 권한 없음' 스크린샷.
- **구현:** Manifest `POST_NOTIFICATIONS`, Android 알림 채널, 사용자의 명시적인 켜기/권한 요청, 관심 14개 단지에서 새 거래가 관측됐을 때만 앱 내 팝업과 별도 OS 알림센터에 통지. 가족 인증 잠금 우회 금지.
- **테스트:** `scripts/test_android_trade_notifications.js`, `scripts/test_favorite_trade_alerts.js`, 빌드/릴리스 성공.
- **한계:** 앱 완전 종료 중 서버에서 보내는 실시간 푸시 FCM은 없음. 허용된 OS 권한만으로 동작하는 실시간 수신이라 주장하지 말 것.

## 2026-10-21 · v1.19.6 — 14개 관심 단지 '새 실거래' 팝업
- **이유:** 사용자가 자신이 실무로 자주 다루는 14개 단지에 새 거래가 등장하면 알려달라고 요청.
- **구현:** 기존 공개 `new_trades.json` 첫 관측일 기반, 저장소별 최초 스냅샷 기준/1회 중복방지, 각 블럭 독립 매칭, 관심단지 신규 거래 화면 이동 및 알림 끄기.
- **테스트:** `scripts/test_favorite_trade_alerts.js`.
- **한계:** GitHub 자동 수집 시각/실제 정부 공식 공개일은 다름.

## 2026-10-21 · v1.19.5 — 버전 표시 오류 복구
- **이유:** 실제 최신 APK에서도 하단에 `v1.10`이 나오던 하드코딩 회귀.
- **구현:** 설치된 실제 Android 패키지의 `versionName`/`versionCode`를 읽어 하단/보안/잠금 화면에 표기.
- **테스트:** `scripts/test_app_version.js`, `scripts/check_apk_version.py`.

## 2026-10-21 · v1.19.4 및 v1.19.3 — 실거래 상세/특약 복구
- **이유:** 화면 개편 중 갱신계약 표시/중개사 소재지/출처 중복과 기본 특약이 반복 누락됨.
- **구현:** v1.19.3 거래유형·갱신 배지·중개사 지역/반복 출처 삭제/기본 특약 복구. v1.19.4에서 **갱신요구권 사용, 계약기간, 종전 보증금, 종전 월세** 4정보 추가; 0과 미기재 구분.
- **테스트:** `scripts/test_trade_contract_regression.js` (세 실거래 렌더러, 계약문자 미리보기).

## 2026-10-21 · v1.19.0~v1.19.2 — 따뜻한 전체 UI/단지 및 문장별 뉴스
- **목표:** 부모님도 읽기 편한 심플 모던 + 따뜻한 크림·브라운; 퍼팍/마뷰 동번호 블럭 식별. 건축물대장·관리비를 실무형 카드로.
- **한계:** 공급/전용 타입·평형별 고지 관리비가 없는 곳은 추정하지 않음.

## 2026-10-21 · v1.18.0~v1.18.2 — 계약 송금·학군·AI 뉴스
- **구현:** 순서무관 송금 항목 인식, 은행/계좌/예금주/금액 24순열 테스트. NEIS 지역 학교정보 연동 구조. AI 요약은 실제 읽은 기사 본문으로 3문장씩 표시.
- **문제:** NEIS 요청 HTTP500으로 실제 학교 검증과 키 진위가 보류; '생성형 AI 아님' 표시 회귀 수정.

## 2026-10-20~21 · v1.13~v1.17 — 계약문자 자연어 입력
- 실무 문장 형식/특약/원문 비교, 송금액 유연 인식, 계좌/계약 일정 정확성 향상.
- 법률 관련 내용은 **실제 당사자 사전 합의와 검토**를 반드시 전제로 하며 계약정보를 공개 저장소에 게시하지 않음.

---
**다음 항목 작성 템플릿**

```md
## YYYY-MM-DD · vX.Y.Z — 기능명
- 사용자 요청 / 문제:
- 구현 코드와 영향 범위:
- 보존할 이전 사용자 합의:
- 데이터·API 검증:
- 자동 테스트 / 실기기 검증:
- GitHub Actions 실행 및 Release:
- 미완료 / 오류 / 다음 담당자 TODO:
- AI 인수인계 및 요구사항 문서 갱신 여부:
```
