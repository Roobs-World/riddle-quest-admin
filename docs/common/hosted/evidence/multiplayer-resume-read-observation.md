# Multiplayer unavailable resume observation

Verified 2026-10-01 against local production source. The hosted Jest pathway test remains active; its draft and source evidence were left untouched.

## Failure and change

Resume selection protection depended on reading the stored pointer. Both browser read handling and the optional adapter converted denied reads into null, treating unavailable observation as an empty key. When writes remained usable, an older accepted resume consequently replaced the newer pointer. The public session regression and production browser fixture both failed against prior source.

Resume adapters now retain undefined for unavailable observation, distinct from null for a successfully observed absent or ineligible hint. The browser adapter uses the existing strict observation function, and the optional wrapper preserves undefined on returned unavailable observations or exceptions. Confirmed persistence skips writes when selection could not be observed. Valid server receipts remain accepted in memory; initial entry still allows independently valid recovery and new selection behavior. Cleanup continues checking exact account/run snapshots. No text, scoring protocol or provider SDK changed.

## Verification

- New public session regression passed: denied reads with usable writes preserve the newer pointer, accept the older canonical run, and resume the newer selection when access returns.
- Two injected browser scenarios passed at 1280px and 390px, with real Storage.getItem throwing for the resume key while setItem remains usable. Prior-source substitution reproduces replacement of newer-tab-run with keyboard-run; current source preserves the newer pointer.
- Two retained selection and twelve startup recovery browser scenarios passed.
- Complete client suite: 1,604 tests in 181 runnable suites passed; 95 tests in 13 opt-in suites skipped. Existing optional storage isolation cases remain covered by this suite.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

Logs, screenshots, saved prior modules and source/build hashes are in `artifacts/race-resume-read-observation/`. Browser fixtures render production race modules and inject a valid resumed run. Retained scripts save screenshots in their own artifact directories. This client-only change requires no Firebase deployment.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 44-check manifest `docs/common/development/development-tasks/race-resume-read-observation.json` retains earlier gates and adds denied browser read verification. The source-stability guard remains unchanged; guarded completion awaits the ongoing hosted E2E chat finishing source evidence edits. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
