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
- Notifications: favorite-14 **foreground** popup + opt-in local Android notification; **no background push/FCM** yet. First snapshot baseline; don't replay previously seen transactions.
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
