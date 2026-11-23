# Multiplayer quit confirmation focus recovery

Verified 2026-10-01 against local production source. The hosted Jest pathway test remains active; its preview and evidence edits were left untouched.

## Failure and change

The quit dialog took focus when opened, but removed itself on dismissal without returning focus to gameplay. The injected production browser reproduced failure to restore the focused Hint control after Escape dismissed confirmation.

The focus hook now captures the gameplay element when confirmation opens. Cleanup cancels its pending focus frame and restores that element if it remains connected, inside the live race, and enabled. Otherwise it focuses the live race root. It checks the root and confirmation refs so a full race teardown can retain its existing outer focus restoration. Ordinary Escape and composing/default-prevented event handling are retained. No visible text or backend protocol changed.

## Verification

- Six browser scenarios passed: Escape dismissal, Keep playing dismissal and disabled original control fallback, each at 1280px and 390px. Tests assert the restored target, subsequent Tab containment, unchanged pending answer, closed confirmation, absence of unintended race mutations, alerts or page errors.
- Ten retained dialog keyboard ownership scenarios and four retained game-frame overlay ownership scenarios passed.
- Complete client suite: 1,599 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated target builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

Logs, saved prior hook, screenshots and current source/artifact hashes are in `artifacts/race-quit-focus-recovery/`. Fixtures use production RaceTo10Game, session and focus hook with a valid injected resume response. The fallback fixture explicitly disables the original control, modelling an unavailable interaction target. Retained scripts save screenshots in their own artifact directories. These local checks do not establish that the unchanged hosted draft contains this fix. No Firebase deployment is required for this client-only change.

## Completion receipt

`verification-held.json` records focused verification, not an accepted full-source dashboard receipt. The 41-check manifest `docs/common/development/development-tasks/race-quit-focus-recovery.json` retains previous backend/browser gates and adds quit focus verification. The source-stability guard remains unchanged. Guarded completion awaits the ongoing hosted E2E chat finishing source evidence edits, as requested. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
