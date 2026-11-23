# Hanging content recovery and current browser journeys — 3 October 2026

This pass continues the active reliability, performance, playability, and latency goal. It bounds stalled single-player content delivery, restores browser coverage of current multiplayer behavior, and fixes a leaderboard layout defect uncovered by that coverage.

## Content delivery

`riddleLoadDeadline.ts` bounds each content read to 15 seconds. The deadline wraps the provider read **inside** host activity accounting, so a provider promise that never settles cannot leave the loading overlay active forever. Account/locale changes and final unmount abort the local wait immediately. This does not claim cancellation of server-side work.

Existing bounded recovery remains responsible for retrying. An expired read's later success or failure is consumed without changing the recovered question. The same policy covers the Classic fallback after the authority confirms Daily completion. No mutation is manufactured or considered accepted because a delivery deadline expired.

Two regression cases failed the previous implementation: a never-settling read did not enter recovery, and an unresolved wait did not settle after host retirement. The updated focused lifecycle/recovery suite passes 15 tests, including Daily fallback expiration, fresh profile delivery, reconnect deduplication, account progression reset, and retired-load rejection.

The browser harness uses actual React StrictMode hooks and the actual host activity module at 1280 px and 390 px. It verifies one recovery request after expiration, release of the blocking activity boundary, and rejection of the expired response. The old hook source, SHA-256 `017723890644508e11341f223353b57ce72f7f716028fe46417cde09464f341e`, fails the browser recovery assertion after 19 seconds; updated code passes. Raw evidence is under `artifacts/game-request-recovery-2026-10-03/`.

## Current gameplay coverage

The monolithic hosted journey previously expected the retired recorded-race entry. Its generic mock host supplies no live matchmaking capability. The migrated assertions now verify the current live intro, disabled controls and an accessible unavailable-capability notice, prompt entry rendering, preserved balance, absence of recorded-race commands, and deferred ancillary reward presentation after leaving multiplayer.

Actual live play remains verified separately with two players and the current React live-match component. Its browser harness now owns the multilingual checks formerly exercised through recorded races: decomposed accented Latin, Arabic marks, Cyrillic, a Hindi conjunct, Japanese, Korean, Chinese, multi-grapheme paste, and physical/software deletion. It passes at both widths along with countdown, progress, held-poll supersession, immediate victory, one winner grant, navigation, and bot fallback.

The ordinary game-browser command now also runs the live-match, single-player recovery, and receipt harnesses, preserving this coverage in the normal verification path. Stale hosted assertions were updated to accept bundled SVG data URLs, compare victory collection with its authority receipt, and use the current coin-cost contract.

## Leaderboard playability

The updated hosted journey revealed that the ten-player leaderboard page clipped its last row at 390 × 667. The list had about 358 px available while row spacing and inline name/level text exceeded it. Compact row padding and a two-line name/level layout now show all ten rows; long names truncate visually while retaining full accessible text and a title. Pagination remains outside the scrollable list for shorter viewports.

Before and after screenshots: `artifacts/game-request-recovery-2026-10-03/leaderboard-{before,after}.png`.

## Verified checks

- Portal unit suite: 267 suites and 2,272 tests passed; 118 opt-in tests skipped.
- Focused content lifecycle and recovery: 15 tests passed.
- Injected React recovery and live multiplayer browser harnesses passed at desktop and phone widths.
- Eleven selected real Jest authentication journeys passed, including a 25-second identity delay, unavailable Daily, pending optional social profile, registration, login, rewards, and restoration.
- The full migrated hosted journey passed (58.5 seconds): onboarding, navigation, guest preservation, provisional feedback with held confirmations, authority-owned reward collection, leaderboard paging, responsive layouts, low-end behavior, and saved-progress recovery. Controlled wrong/correct feedback in that run appeared in 5.9/8.3 ms; these are injected harness timings, not production latency.
- All 12 queued paid-action browser scenarios passed, including interrupted draft reload, direct loss-modal Skip, previewed hint/successor content, and unavailable successor recovery.
- All six production target builds and isolation audits passed after the runtime and leaderboard changes.
- Portal types, TSDoc, maintainable-file-size checks, and focused whitespace checks passed.

The checkout includes concurrent work from other chats, so full-suite counts and builds describe the combined checkout at validation time. No production deployment was performed in this pass. Firefox controls were not exposed to this chat's tool inventory; browser results above came from the local Chromium harnesses.

The goal remains active. Next, investigate whether a profile refresh during content transport can attach the wrong progression index to an issued riddle, and continue testing current provider journeys.
