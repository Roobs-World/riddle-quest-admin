# Issued content ownership and canonical Classic progress — 3 October 2026

This pass continues the reliability, performance, playability, and latency goal. It prevents delayed content from crossing account visits, preserves the progression position associated with an issued puzzle, and makes current-progress recovery read fresh authority.

## Reproduced failures and fixes

The original Firebase adapter could request Classic position 17, receive a later profile showing 18 while the question transport was pending, and then label the original question as position 18. The admitted request position is now immutable. For older backend responses, this position remains the fallback.

The backend may legitimately advance Classic progress while reconciling a terminal session. New clients opt in with `includeClassicIndex: true`; the current-question response then includes the canonical position of the issued question. Firebase and Reddit use this position ahead of the request hint. The opt-in preserves older strict response consumers. The Classic buffer also opts in and anchors its current question and successors to that issued position, rather than a later unrelated profile read.

Each Firebase content load captures its admitting account visit. After any held Daily/current-Classic/buffer read, a retired visit becomes a handled cancellation before returning a question or starting a fallback/refill. This includes sign-out and same-UID re-entry. Existing server reward and purchase authority is unchanged.

Authoritative Firebase recovery now starts a fresh buffer request instead of sharing a speculative preload. If a newer confirmed buffer completes first, the later older read uses the newer cache so it cannot rewind the current puzzle. Ordinary preload and same-position reads retain deduplication.

Six initial ownership regressions failed before the adapter change. Eight ownership cases now pass, covering profile changes during transport, replacement and same-UID re-entry, held Daily content, retired-buffer fallback prevention, fresh reconciliation, server advancement, and out-of-order authority delivery. Backend tests additionally exercise pending terminal completion and progression changing during buffer assembly.

## Browser evidence

The receipt browser harness now builds the actual Firebase adapter with controlled SDK/callable responses. At 1280 px and 390 px it verifies immutable legacy positions, canonical terminal recovery, retired receipt cancellation without a replacement-account refill, and a fresh authoritative request while an older preload is held. Existing receipt timing and optional-profile-outage checks remain covered.

The original source SHA-256 `838d7879c368d61d554da955897fd8d789a8438b0a6394a535d9cac004c3c89b` fails the browser assertion with position 18 instead of 17. Updated code passes both widths. The controlled receipt measurements use an injected 300 ms optional profile read; they do not establish production network latency.

Eleven selected Jest authentication journeys pass against the production artifact, including 25-second identity delay, registration, login, restoration, unavailable Daily content, pending optional profile delivery, and first Classic rewards. The full injected Reddit browser journey also passes, including current live multiplayer, same-origin traffic, phone gameplay, and immediate single-player feedback.

## Verification

Raw logs and screenshots are under `artifacts/game-riddle-ownership-2026-10-03/`.

- Focused Firebase ownership/completion and Reddit adapter checks: 4 suites, 35 tests passed.
- Final portal unit suite: 269 suites, 2,285 tests passed; 118 opt-in tests skipped.
- Core unit suite: 34 suites, 314 tests passed.
- Backend unit suite using the repository's VM-module test command: 128 suites, 1,581 tests passed. An earlier direct Jest invocation omitted that required flag and failed Yahoo OAuth dynamic imports; the correctly configured complete rerun passed.
- Eleven selected authentication browser scenarios passed; the Reddit browser journey passed.
- All six production targets (Jest, Facebook, Reddit, YouTube, Netflix, Yahoo) and their isolation audits passed. Individual exit codes are recorded in `build-results.json`.
- All workspace type checks, backend lint, TSDoc (23,508 declarations), maintainable-file-size audit (1,152 source files), and whitespace checks passed.

Concurrent chats are editing this checkout; full-suite counts describe the combined checkout at validation time. Existing completion request coalescing and other concurrent multiplayer changes are not attributed to this pass. Two routine documentation annotations were added to concurrent Facebook files to satisfy the shared TSDoc audit. No production deployment was performed. Firefox controls remain absent from this chat's exposed tool inventory; browser verification used Chromium.

The goal remains active. A remaining concrete opportunity is Reddit receipt delivery: confirmed completion and coin spending still await an optional profile read. Investigate that path, authoritative Reddit recovery sharing old preloads, and stale profile response ordering next.
