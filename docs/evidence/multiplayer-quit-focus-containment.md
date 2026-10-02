# Multiplayer quit confirmation focus containment

Verified 2026-10-01 against local production source. The ongoing hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

While abandonment awaits the server, both confirmation buttons are disabled. The focus hook previously returned without handling Tab when no controls were available. The production browser harness reproduced Tab moving outside the confirmation during a pending abandonment request. Focus moved outside by another surface also bypassed the existing first/last-element wrapping.

The hook now prevents Tab navigation and focuses the active dialog itself when no controls are available. When focus is outside an active dialog with controls, forward Tab selects its first control and reverse Tab selects its last. Existing composition/default-prevented handling and focus restoration remain in force. The server still owns abandonment; no new mutation, text or SDK was added.

## Verification

- Eight injected browser scenarios passed at 1280px and 390px: pending abandonment with Tab/Shift+Tab and displaced focus with Tab/Shift+Tab. The pending bridge deliberately leaves the abandonment request unresolved; tests assert disabled controls, focus within confirmation, exactly one abandonment request, no alerts and no page errors.
- Six retained quit-dismissal focus recovery, ten dialog keyboard ownership and four frame overlay scenarios passed.
- Complete client suite: 1,599 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped. The initial unit run exposed an incomplete mocked DOM element lacking `contains`; the fixture now models containment, and the full suite passes. The original failed log is retained.
- All seven isolated target builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

Logs, screenshots, saved prior hook and source/build hashes are in `artifacts/race-quit-focus-containment/`. Fixtures render production race modules with valid injected resume state. Retained scripts save screenshots in their own directories. No Firebase Functions deployment is required for this client-only fix.

## Completion receipt

`verification-held.json` is focused evidence, not an accepted full-source dashboard receipt. The 42-check manifest `docs/development-tasks/race-quit-focus-containment.json` retains previous gates and adds containment verification. Guarded completion awaits the hosted E2E chat finishing evidence edits; the source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
