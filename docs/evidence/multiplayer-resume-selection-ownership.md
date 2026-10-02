# Multiplayer shared resume selection ownership

Verified 2026-10-01 against local production source. The separate hosted Jest pathway test remains active; its preview and evidence file were left untouched.

## Failure and change

Terminal race receipts already preserved another run's resume hint, but prepared, scheduled and active receipts unconditionally replaced it. An older tab could therefore reclaim the shared selection after another tab chose a different run. Three public session tests reproduced the problem: delayed active resume, delayed prepared resume and readiness completion. The explicit new-start case passed before the change and remains supported.

The session now tells persistence whether the accepted receipt is an explicit new start. All other receipts refresh only their existing selection or an empty store. A different saved run is preserved while valid older authority is still accepted into that tab's in-memory session. An explicit nonterminal new start can replace selection; terminal start receipts retain the previous protection. This changes the optional resume hint, not server authorization or scoring.

## Verification

- Four new public session cases passed; they check canonical in-memory acceptance, pointer ownership, re-entry selection and deliberate new-start replacement.
- Two injected browser scenarios passed at 1280px and 390px. The real browser resume pointer is replaced before delivering the old run; production RaceTo10Game accepts its old run while retaining the newer pointer.
- Twelve retained startup recovery browser scenarios passed across rejected, malformed and wrong-run receipts, retry/reload and desktop/mobile sizes.
- Complete client suite: 1,603 tests in 180 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated builds and exact target dependency-evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

Logs, screenshots, saved prior sources and source/build hashes are in `artifacts/race-resume-selection-ownership/`. The selection browser fixture simulates the shared-storage write at the resume delivery seam; the session tests verify reload selection separately. Retained browser screenshots remain in their script's artifact directory. This client-only change needs no Firebase deployment. Optional unavailable persistence continues to be isolated by the existing adapter.

## Completion receipt

`verification-held.json` records focused verification, not an accepted full-source dashboard receipt. The 43-check manifest `docs/development-tasks/race-resume-selection-ownership.json` retains prior gates and adds real browser selection verification. Guarded completion awaits the ongoing hosted E2E chat finishing evidence edits; the source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
