# Multiplayer draft write confirmation recovery

Verified 2026-10-01 against local production source. The other Jest E2E chat remains active, so its preview and source evidence are untouched.

## Failure and change

A write could succeed while its read-back confirmation was denied. The next successful read differed from the prior observed record, so the session treated its own write as another tab's replacement and stopped persisting later input. Initial regressions failed in three cases, with 53 retained/additional cases passing. The injected browser using the exact prior draft module also failed: live PI input remained backed by an empty stored draft after reads recovered.

The draft module retains the exact attempted serialized bytes, matching semantic content and originating session lifetime. A subsequent successful read can acknowledge only those bytes in that same live journey. Confirmation of unchanged input reuses its original bytes and retention clock; later edits and a deliberate return to the prior empty draft are then saved normally. A different replacement still revokes overwrite permission. Disposal and new account/run binding discard the pending candidate.

Terminal cleanup retains at most two exact candidates: the previously observed record and this live session's attempted write, each checked against the canonical terminal owner, run and locale. It rereads the actual storage value before removal, so an unconfirmed successful write can be cleaned after terminal authority and read recovery. Changed records and invalidated session lifetimes remain protected. No new serialized fields, answer authority or scoring payload were added.

## Verification

- Complete client suite: 1,597 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Focused draft suite: 57 cases passed. Five added cases cover latest input after delayed confirmation, unchanged confirmation without retention renewal, terminal cleanup, newer-tab protection and deliberate clearing back to the previous draft.
- Twenty production RaceTo10Game draft browser scenarios passed: creator/challenger at desktop and mobile-sized viewports with normal, denied-read, scheduled, failed-write and failed-confirmation storage. The new confirmation cases restore reads without editing again, save the latest PI input and selected slot, then reload only after server resume.
- Eight terminal cleanup browser scenarios passed: thrown deletion, silent deletion, denied reads and unconfirmed successful writes at 1280px and 390px. Cleanup occurs after canonical abandonment returns to the live six-category hub, with no gameplay mutation, alert or page error.
- All seven configured isolated builds and exact target dependency-evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The saved baseline draft source hash matches the previous batch's recorded production hash. Logs, screenshots and focused source/artifact proof are in `artifacts/race-draft-confirmation-recovery/`. These injected Chromium viewport/storage checks are not physical-device evidence. This client-only change requires no Firebase Functions deployment.

## Completion receipt

`artifacts/race-draft-confirmation-recovery/verification-held.json` is focused proof, not an accepted full-source dashboard receipt. The 38-check manifest `docs/common/development/development-tasks/race-draft-confirmation-recovery.json` retains prior gates; the existing draft and cleanup browser checks now cover delayed confirmation too. The source-stability guard remains unchanged. Run guarded completion after the other E2E chat finishes changing source evidence. No Jest upload, activation or publication was performed.
