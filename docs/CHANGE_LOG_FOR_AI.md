# AI 개발 인수인계 변경 로그 — 항상 새 항목을 맨 위에 추가

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
