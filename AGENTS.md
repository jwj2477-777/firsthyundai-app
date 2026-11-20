# FirstHyundai AI Agent Guide / 퍼스트현대 개발 AI 인수인계

> **START HERE** — ChatGPT, Gemini, Claude, Codex, Copilot, human maintainers. This is a live Android/WebView app for a real-estate office. Do not treat chat memory, old README headings or release notes as current implementation facts. Last comprehensive handoff review: 2026-10-21 (KST).

## Read in this order before changing anything
1. [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) — independent, cross-model project handoff; current source-of-truth hierarchy; architecture and risk.
2. [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) — **user-approved invariants**; never silently remove these.
3. [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md) — decisions, regressions and release lineage.
4. [docs/RECOVERY_PLAYBOOK.md](docs/RECOVERY_PLAYBOOK.md) — environment, validation, backups and how to recover with no previous conversation.
5. [docs/CHANGE_LOG_FOR_AI.md](docs/CHANGE_LOG_FOR_AI.md) — human-readable AI handoff change log.
6. Inspect ACTUAL current source, GitHub Releases, Actions and `data/*.json`; docs may lag behind code.

## Highest-priority rules
- Owner: a Korean licensed real-estate agent building a **free**, private-office/family Android app (not a commercial SaaS). Korean end-user UI; warm ivory/cream/brown, modern, simple, readable for parents. Minimize filler/help text.
- All 14 interest-complex IDs and block boundaries are separate. `퍼팍 1502동` => First Park block 15; `마뷰 2301동` => Master View block 23 **only if supported; reject conflicts/ambiguity**.
- Keep government apartment contract data truthful: renewal/new classification; renewal right, term, prior deposit and prior monthly rent; broker/direct type and broker region when applicable; no repeated source/month per transaction; cancellation notice. **Unknown is not zero.**
- Contract SMS: retain separately negotiated legal terms without inventing consent; add the standard clause that other detailed special terms are agreed/documented upon the main contract. Parse name/account/bank/remittance without a fixed order; human review required. **No customer, bank or contract data in public repo, logs or test fixtures.**
- News: article-body-based Gemini/Groq, **three factual sentences**, individually displayed. No article body => no invented summary; verification not implied.
- Schools: NEIS school directory is **NOT assigned school districts**; do not fabricate assigned schools or claim key/server healthy without actual API evidence.
- Since v2.1.95 elementary 통학구역 and middle-school 학교군 come from official data.go.kr 학구도 files at original precision (`collect_school_zone_files.py`, weekly). Joint zones list choices, never one school; middle schools are a 학교군 list, never one school.
- K-apt reserve fee: use `getHsmpMonthFeeInfoV3` (`sLevy`). `getHsmpMonthChargeAmtInfoV3` does not exist.
- UI (v2.1.97): same colour = same meaning (page colour = selected main tile; deep teal = continue; deal-type colours unchanged); one SVG line-icon style via `ui-icons.js`; unification rules live in `ui-consistency.css` (loaded last, removable for rollback).
- Motion (v2.2.1): press = instant inset shade only (no scale/translate/filter/ripple); screen change = opacity fade 160ms, no stagger; all in `ui-motion.css` (loaded last), off under both reduced-motion switches.
- Performance (v2.2.1): never rebuild `catalogRows()` per list row — it is cached by the identity of `remote.complexes`/`remote.trades` (replace, never mutate, those objects). Check `renderTrades` under 4x CPU throttle after list changes.
- Contract Live (v2.1.98): contract VAD silence 2000ms (news 700ms); "다 말했어요" sends only `audioStreamEnd`. Spoken/typed 평형 (`areaType`) maps to exactly one verified type via `contract-area-types.js`, otherwise ask; never derive areas from pyeong.
- Notifications: favorite-14 trade alerts are foreground popup + opt-in local notification (no background trade push); first snapshot baseline, never replay seen transactions. **Shared memo/schedule alerts DO use FCM** (Worker cron ~8 min → T-30 reminder) plus, since v2.1.94, a handset backup alarm from the encrypted offline snapshot (`ScheduleBackupAlarms`), deduplicated with the push.
- Security (v2.1.94): a **new handset needs administrator approval** before any memo token is issued (`/board/devices/pending|approve|reject`). The family code's PBKDF2 verifier is public in `data/access_policy.json`, so never let the code alone grant memo access. Emergency switch: Cloudflare Worker variable `BOARD_DEVICE_APPROVAL=off`.
- Keep **family vs administrator** separation; do not leak settings or notes. Admin sessions temporary. Local personal notes need separate backup; public repo is not a private user-data backup.
- Prior failures occurred when UI rewrites dropped user requirements. **Add/update automated regression tests for every user-visible rule**; never "restore" a feature by only changing a badge.
- Never assume a successful GitHub commit means APK release succeeded. Check Actions job conclusion and published release asset.
- Never commit or print GitHub Secrets, API keys, family/admin passwords, phone numbers, personal notes, actual clients' payment accounts.
- Check latest status from `app/build.gradle`, GitHub Releases, `.github/workflows/build-apk.yml` instead of hardcoding "latest version" in a living document.

## Before each handoff / after each material feature change
1. Check implementation, data and release results, run relevant `scripts/test_*.js` and Python `tests/`.
2. Update PRODUCT_REQUIREMENTS if any requested behavior changes, PROJECT_HISTORY for milestone, CHANGE_LOG_FOR_AI for implementation; revise AI_HANDOFF if architecture/status changed.
3. Build/signing/release verification per `docs/RECOVERY_PLAYBOOK.md`. Follow user requirement to back up `내 자료` before reinstalling a debug-signed APK.
4. Tell the user precisely what was implemented, tested, released and what is still not supported.

**When the user loses the chat or switches AI:** provide [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md), this file, the GitHub repo URL and the latest APK release. The docs preserve project decisions, NOT hidden personal memories, actual unarchived conversations, secrets, or client records.
