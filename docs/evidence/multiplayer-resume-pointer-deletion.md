# Multiplayer deleted resume pointer ownership

Verified 2026-10-01 against local production source. The active hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

Confirmed persistence preserved replacement pointers but treated an empty key as permission to restore an old run. A delayed resume or readiness receipt could therefore resurrect a selection deliberately cleared by another tab. Three public session cases reproduced late active/prepared resumes and readiness completion.

Accepted non-start receipts now preserve a missing pointer. Explicit new starts can still select normally, and an interrupted start confirmed on replay may create its first missing pointer. This distinction prevents old-run refreshes from resurrecting deleted selection while retaining recovery for a start whose first confirmation was lost. Valid canonical responses remain accepted in memory. Abandoned-run conditional cleanup retains its existing behavior.

## Verification

- Four new public session cases passed: active/prepared delayed resume after deletion, readiness after deletion, and interrupted-start retry creating its first pointer. Three initial regression cases failed against prior source. Resume cases also verify re-entry chooses catalog rather than the removed run.
- Twelve retained startup recovery and two shared-selection browser scenarios passed.
- Complete client suite: 1,626 tests in 187 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The initial client run exposed two cleanup fixtures which recorded writes but always returned an empty key. Their adapter now retains written hints per account so the reentrant ownership assertions exercise real persistence behavior; the full suite passes and the initial failed log is retained. The new deletion race uses the public session seam. Retained browser checks are integration regression coverage, not direct reproduction of deletion. Logs and source/build hashes are in `artifacts/race-resume-pointer-deletion/`. No visible text, provider SDK or Firebase deployment changed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/development-tasks/race-resume-pointer-deletion.json` retains all previous gates; its client suite covers the new cases. Guarded completion awaits the active hosted E2E chat finishing source evidence edits. The source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
