# Multiplayer asynchronous host delivery failure

Verified 2026-10-01 against local production source. The hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

Race transport caught synchronous adapter exceptions but discarded a returned promise. An asynchronous rejection left the start pending until the 30-second response deadline. A controlled public session regression reproduced that behavior; two retained lifetime cases passed against prior source.

The host delivery contract now explicitly permits Promise<void>. The private gameplay delivery module observes rejected promises and reports failure only if the exact delivery object remains current. An already accepted confirmation, disposed lifetime or newer retry with the same server mutation ID cannot be rejected by an old promise. A current failed start enters existing retry recovery immediately, preserving its original receipt and payload. Successful promise completion still waits for canonical host confirmation; it does not claim authority acceptance. Existing synchronous failure semantics are retained.

## Verification

- Four new public session cases passed: current asynchronous rejection, rejection after synchronous accepted start installed readiness, rejection after disposal, and old rejection after a newer delivery reused the mutation ID. Initial baseline was one failed regression and two passing lifetime controls; the fourth same-ID case was added afterward.
- Complete client suite: 1,630 tests in 188 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Twelve retained startup recovery browser scenarios passed.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The test transport harness now forwards the adapter's actual return value. Controlled deferred promises also attach a test-only rejection observer so the old-source regression checks state without process-level unhandled-rejection noise. The new asynchronous failure is verified through public session injection, not a claim that a currently deployed provider adapter returns a rejected promise. Browser checks are retained integration coverage. Logs and source/build hashes are in `artifacts/race-async-delivery/`. No visible text, provider SDK or Firebase deployment changed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/development-tasks/race-async-delivery.json` retains earlier gates; its full client suite includes these delivery cases. Guarded completion awaits the active hosted E2E chat finishing source evidence edits. The source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
