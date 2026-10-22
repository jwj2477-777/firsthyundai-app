# AI 개발 인수인계 변경 로그 — 항상 새 항목을 맨 위에 추가

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
