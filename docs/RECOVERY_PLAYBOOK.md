# 퍼스트현대 — 비상 복구·백업·운영 인수인계 절차
> 어떤 AI든 이 문서만 받은 상황에서 실행 가능한 절차. 2026-10-21 작성. 개인 식별정보, 실제 비밀번호, API key, 계약/계좌는 여기에 넣지 않는다.

## A. 새로운 AI와 첫 대화를 시작하는 법
새 AI(ChatGPT/Gemini/Claude)에 아래 문장을 붙이고 **`AGENTS.md` + `docs/AI_HANDOFF.md` + 관련 문서 또는 ZIP 백업**을 첨부:

> 나는 한국 송도 '퍼스트현대' 공인중개사 사무실의 Android 앱을 개발 중이다. 이전 AI의 대화 기억이 없어도 작업할 수 있도록 GitHub `https://github.com/jwj2477-777/firsthyundai-app`의 `AGENTS.md`, `docs/AI_HANDOFF.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/PROJECT_HISTORY.md`, `docs/RECOVERY_PLAYBOOK.md`, `docs/CHANGE_LOG_FOR_AI.md`를 **모두 읽어라**. 낡은 README/구 버전 릴리스를 최신 기능으로 오인하지 말고 현재 `main` 소스, Gradle 버전, 최신 성공 Actions, GitHub Release APK, `data/*.json`을 검증해라. 기존 요구사항과 테스트를 보존하고 내가 지시하는 다음 수정은 직접 구현·테스트·배포한 뒤 AI 이력 문서까지 갱신해라. 고객 개인자료·API 키는 절대 공개 저장소에 기록하지 말고, 미구현을 구현 완료라고 하지 말아라.

**AI에게 첨부할 자료 순서:** (1) `퍼스트현대_AI_인수인계_백업.zip` 또는 통합 MD (2) GitHub 링크 (3) 최신 APK 릴리스 (4) 사용자에게만 있는 비공개 메모 백업 (민감하면 AI에게 업로드하지 않음). **비밀키 원문은 AI에게 보내지 않는다.**

## B. 무엇을 어디에 백업할지 — 3개의 서로 다른 복구 대상
1. **앱 소스·공개 데이터·개발 히스토리** → GitHub 저장소 `main` 전체, `.github/workflows`, `scripts`, `tests`, `data`, `workers`, `AGENTS.md`, `docs`; Git 커밋·릴리스 태그를 보존. 단일 APK만 보관하면 소스와 개발 이력이 복구되지 않는다.
2. **AI 작업 기억/합의·사양·오류/해결 이력** → 이 문서 세트 + 오프라인 `.zip` 또는 `.md`; 대화 전체 원문을 별도로 보존하고 싶으면 ChatGPT 데이터 내보내기(제품 UI로 사용자 직접 수행)를 추가. 요약은 원문 대화를 100% 보존하지 않음을 인정.
3. **실제 휴대폰 로컬 자료** → 앱 '내 자료'의 내보내기/백업 JSON을 **사용자가 직접 안전한 개인 저장소/암호화 드라이브에 보관**. 공개 GitHub 데이터 파일은 고객·메모 복구 불가. 기기별 가족/관리자 접근 암호, API key/개발 콘솔 설정은 사용자의 개인 보안 저장소에서 따로 관리. APK 재설치 특히 디버그 서명 교체 때 먼저 복구 가능성을 확인.

## C. 원본 백업 받기
GitHub 웹에서 다운로드:
- 소스 ZIP: https://github.com/jwj2477-777/firsthyundai-app/archive/refs/heads/main.zip
- 저장소: https://github.com/jwj2477-777/firsthyundai-app
- Releases/APK: https://github.com/jwj2477-777/firsthyundai-app/releases
- Actions 로그: https://github.com/jwj2477-777/firsthyundai-app/actions

로컬 Git 환경이 있다면:
```sh
git clone https://github.com/jwj2477-777/firsthyundai-app.git
cd firsthyundai-app
git pull --ff-only origin main
git tag --sort=-creatordate | head -15
git log --oneline --decorate -30
```
소스뿐 아니라 모든 커밋/태그를 포함한 별도 오프라인 저장이 필요하다면:
```sh
git bundle create ../firsthyundai-full-history.bundle --all
git bundle verify ../firsthyundai-full-history.bundle
```
**GitHub ZIP은 기본 브랜치의 현재 파일만 담고 커밋 이력을 보존하지 않는다.** 전체 기록은 `git bundle`이나 `git clone --mirror`를 따로 보관.

## C-2. 업데이트/서명 이전의 개인 자료 보호
- v2.0.14부터 릴리스는 비공개 GitHub Secret `FHD_SIGNING_BUNDLE_B64`가 필수이며, 기존 Debug와 첫 Release의 서명이 다르면 기존 앱 위 설치는 불가능하다.
- 제거 전 '내 자료'에서 JSON 백업 파일 저장과 정상 열림을 확인하고, 최초 고정 서명 설치 후 복원한다. 이후 동일 서명키 사용 및 versionCode 증가로 삭제 없이 업데이트 가능.
- 앱 내 확인은 검증된 GitHub 릴리스 버전/자산만 사용하며 Android 사용자 승인 없이 설치되지 않는다. 자세한 설정 절차는 `docs/SIGNING_SETUP.md`.

## D. 현재 상태 검사 순서
1. `app/build.gradle`에서 `versionName`/`versionCode` 확인. Android 서명·`applicationId` 변경이 있으면 설치/데이터 유지에 영향.
2. GitHub Releases의 **최신 '성공한' 태그와 실제 APK 첨부 파일** 확인. GitHub Actions 빌드 로그에서 `Test ...`, `Build APK`, `Verify actual APK version`, `Publish successful...`이 모두 초록인지 확인.
3. `data/trades.json`, `new_trades.json`, `news.json`, `complexes.json`, `public_services.json`의 **상태, checked_at, 레코드 수, errors** 확인. 공개 JSON `awaiting_key`는 Secret 미설정의 확증이 아님.
4. 사용자와 새 지시가 있다면 `docs/PRODUCT_REQUIREMENTS.md`의 우선순위와 실제 테스트를 비교해 기능 회귀 방지.
5. API key는 **이름만** GitHub Actions 워크플로에서 확인: `DATA_GO_KR_SERVICE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `NEIS_EDU_KEY`, 필요 서비스별 Secret. 설정 여부와 사용 권한은 워크플로의 실제 요청 성공으로 판단. 키 자체는 공개/출력하지 않는다.

## E. 유닛/통합 테스트 — 무료 로컬 검증
필수:
```sh
python -m unittest discover -s tests -v
node scripts/test_nearby.js
node scripts/test_trade_contract_regression.js
node scripts/test_contracts.js
node scripts/test_contract_language.js
node scripts/test_contract_transfer.js
node scripts/test_contract_easy.js
node scripts/test_news_ai_ui.js
node scripts/test_favorite_trade_alerts.js
node scripts/test_android_trade_notifications.js
node scripts/test_app_version.js
node scripts/test_refresh_feedback.js
```
추가 단지/보안/화면 관련 `scripts/test_*.js`와 `scripts/test_*.py` 파일을 변경 영향 범위에 맞춰 실행. GitHub Actions `.github/workflows/build-apk.yml`의 테스트 목록이 공식 CI 구성이다.

현재 APK 빌드 예:
```sh
gradle --no-daemon assembleDebug
python3 scripts/check_apk_version.py app/build/outputs/apk/debug/app-debug.apk
```
실제로는 GitHub Actions의 Android SDK/Gradle 환경을 이용하는 것이 가장 안전. `scripts/check_apk_version.py`는 `aapt`를 통해 APK 안의 패키지 버전이 Gradle/Release와 일치하는지 검사한다.
**중요:** 코드가 통과해도 실제 삼성 단말의 화면/알림 권한/배터리 제한/파일 복원은 별도 실기기 확인이 필요.

## F. 자동 수집과 앱 '갱신' 구분
- GitHub Actions `Update Public Data (FREE)` 뉴스 3시간마다, 실거래 매일 (GitHub 예약 지연 가능).
- `Sync Songdo K-apt Apartments` 단지 기초정보, `Sync Optional Public Services (requires approvals)` 승인받은 선택 API. `mode` 선택에 따라 서비스별 수집.
- 사용자가 앱에서 '갱신'을 누르면 앱이 GitHub의 **이미 게시된 스냅샷을 다시 읽는 것**이고 국토부/NEIS/Gemini를 즉시 강제 호출하는 게 아니다. 수집 갱신 시각을 별도로 보고한다.
- 데이터 수집 실패 때 기존의 성공 스냅샷을 유지하며, 비어 있는 자료를 성공 수집했다고 주장하지 않는다.
- 첫 관측 거래와 계약 체결일·정부 공식 발표일의 차이를 항상 구분.

## G. NEIS·지역 API 문제 복구
- Secret `NEIS_EDU_KEY`는 사용자가 등록한 이력이 있으나 2026-10-21 GitHub 환경에서 API 조회가 **HTTP 500**. 공개 샘플, 의도적으로 틀린 키, 실제 Secret, XML/JSON, 별도 NEIS API 등 모두 실패. **키가 정상인지 틀린지는 판별되지 않음.**
- 실제 API 호출의 최소 응답, HTTP 상태, 제공기관 `RESULT.CODE`, 발급키 서비스 종류, 접근 제한, 작업 시각을 안전하게 로깅한다. 키·전체 URL(쿼리에 키 포함!) 절대 출력 금지.
- 스냅샷이 `schools.state='awaiting_key'`이라도 현재 Secret이 존재하는지와 같지 않다. 신규 키 등록 후 **새 워크플로 실행**이 이전 실행 재시도보다 검증에 명료하다.
- 나이스 지역학교 목록은 배정학교 확정 자료가 아니므로 공식 학구도 파일과 교육청 고시 확인 전 '배정' 표시 금지.
- 카카오 주변시설 Worker/이용 승인 상태는 현재 소스와 Worker 배포 이력 검증 필요; 키값 자체를 문서에 기록하지 않는다.

## H. 신규 실거래 알림 검증
- `trade-alerts.js`는 14개 확정 단지의 **처음 확인한 새 거래**만 로컬 저장해 한 번 알림. 첫 수집은 기준선; 각 새 거래 수집의 `first_seen_date`가 소스다.
- 내부 모달/팝업과 Android OS 알림은 서로 구별. Android 13 이상 시스템 알림은 `POST_NOTIFICATIONS` manifest + 런타임 권한 + 사용자의 별도 명시적 켜기 + 알림 채널이 모두 충족되어야 한다.
- 앱 종료 시 **백그라운드 FCM 푸시는 현재 없음**. 알림을 허용한 뒤에도 새 데이터 수집/앱 내부 갱신이 일어나지 않으면 즉시 알림을 보장하지 않는다.

## I. 회귀가 발견됐을 때 즉시 확인할 것
| 증상 | 먼저 볼 코드/테스트 |
|---|---|
| 갱신계약 표시 부족 | `index.html`의 `tradeExtraBadges`, `tradeRenewalDetails`; `collect_trades.py`의 원본 4필드; `test_trade_contract_regression.js` |
| 매매 중개사 지역 누락 | `tradeBrokerLocation`, `broker_region_raw`, 모든 거래카드 |
| 출처/조회연월 다시 표시 | 세 거래 화면 HTML 생성 지점과 거래 UI 테스트 |
| 송금액·계좌 순서 인식 실패 | `contracts-language.js`, `contracts-transfer.js`, 24순열 테스트 |
| 기본 특약이 사라짐 | `contracts.js`의 `DEFAULT_DETAIL_TERM`, `previewSpecialTerms` |
| 뉴스 3문장/AI 여부 누락 | `summarize_news.py`, `groq_news.py`, `renderNews`, `test_news_ai_ui.js` |
| 비슷한 블럭/타입 잘못 병합 | `FAVORITE_APTS`, 타입의 원본 매칭, `test_nearby.js`, 공급타입 검증 테스트 |
| 앱 버전 하단이 구버전 | `AppVersion.java`, `MainActivity.java`, footer, `test_app_version.js`, `check_apk_version.py` |
| Android 알림 차단 | `AndroidManifest.xml`, `TradeNotifications.java`, OS 앱 알림 설정, `test_android_trade_notifications.js` |
| NEIS 키를 등록했는데 학교 0 | API HTTP 진단, `NEIS_EDU_KEY` Secret, `sync-public-services.yml`, `schools.state` |

## J. AI 문서를 지속해서 최신화하는 규칙
- 코드/기능이 변경되면 `docs/PRODUCT_REQUIREMENTS.md`의 해당 항목, `docs/PROJECT_HISTORY.md`의 릴리스 행, `docs/CHANGE_LOG_FOR_AI.md`에 **무엇/왜/검증/남은 일**을 적고 `docs/AI_HANDOFF.md`에 구조 변경을 기록.
- 새 AI는 변경 요청을 받을 때 실무 사양이 빠지지 않았는지 위 문서를 보면서 테스트를 선행 수정한다. **실행 가능한 소스가 가장 최신 사실**이며 과거 기록과 다르면 이유를 명시.
- GitHub 전체 소스 백업과 '내 자료' 백업은 분리. 모든 문서와 소스가 한 번에 사라지는 위험을 대비해 오프라인 `git bundle`, 프로젝트 ZIP, 이 인수인계 ZIP을 물리적으로 분산 보관.
- **AI 문서의 존재는 AI 모델의 비공개 메모리 복원을 의미하지 않는다**. 다른 AI에게 문서를 첨부하면 그 모델이 문서에 적힌 사실과 조건을 새 대화에서 이해하는 방식이다.
