# Multiplayer interrupted start selection ownership

Verified 2026-10-01 against local production source. The active hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

Retried starts rewrote their recovery journal unconditionally. When the original start finally returned, persistence also treated every raceStart response as a new selection, allowing that replay to replace another tab's confirmed run pointer. Four public session regressions reproduced the journal and active-pointer failures.

The private correlated command now records whether the start was freshly selected or sent with an existing replay receipt. Replayed starts refresh only their observed recovery journal and cannot reclaim another run's active pointer. They still reuse the exact original request ID and accept the valid canonical run into memory, including chained readiness. Fresh starts retain explicit selection replacement. Receipt creation happens after the replay distinction is retained, and the validated original identity is passed to transport.

## Verification

- Five new public session cases passed: journal replacement, denied journal reads, journal deletion, newer confirmed pointer during retry, and cold saved-start replay after full session disposal. Four initial cases failed against prior source. Cases assert receipt identity, canonical acceptance and readiness follow-up alongside shared selection preservation.
- Twelve retained startup recovery and two shared resume selection browser scenarios passed.
- Complete client suite: 1,620 tests in 185 runnable suites passed; 95 tests in 13 opt-in suites skipped. Existing fresh-start replacement tests remain covered.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

New start replay races are verified through public session calls and injected transport/storage adapters. Browser scenarios are retained integration coverage rather than direct reproduction of replay selection. Logs and source/build hashes are in `artifacts/race-start-retry-selection/`. No visible text, provider SDK or backend deployment changed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/development-tasks/race-start-retry-selection.json` retains earlier gates; the full client suite includes the new replay cases. Guarded completion awaits the ongoing hosted E2E chat finishing source evidence edits. The source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
