# Multiplayer dialog keyboard ownership

Verified 2026-10-01 against local production source. The separate hosted Jest pathway test remains active and its preview/evidence file were left untouched.

## Failure and change

The race dialog processed Escape before checking composition or prior event handling. An input method cancelling composition could consequently open race abandonment confirmation, and a control which had already prevented Escape could still change the race dialog. Both failures were reproduced in the injected production browser against the saved prior focus hook.

The focus hook now ignores composing and default-prevented keydown events before dialog shortcuts. Ordinary Escape behavior remains: the first press opens confirmation in an active race and the second dismisses it. The existing session owns confirmation and abandonment; this change introduces no backend mutation or visible text.

## Verification

- Ten browser scenarios passed across 1280px and 390px viewports: composing/consumed Escape while racing, composing/consumed Escape with confirmation open, and ordinary Escape opening/dismissing confirmation. Assertions cover synchronous session state and rendered confirmation, unchanged pending answer, no unintended abandonment/submission/start command, no alert and no page errors.
- Fourteen retained answer-keyboard activation scenarios and four retained game-frame overlay ownership scenarios passed.
- Complete client suite: 1,599 tests across 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated target builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.
- Mobile confirmation screenshot was visually inspected.

Logs, screenshots, saved prior hook and current source/build hashes are in `artifacts/race-dialog-keyboard-ownership/`. Keyboard events explicitly carry `isComposing` or `defaultPrevented`; this proves event handling rather than an OS-specific IME end-to-end integration. Browser fixtures use the production RaceTo10Game, session and focus hook; the resume bridge injects a valid server run. Retained browser scripts save screenshots in their own artifact directories. No Firebase Functions deployment is required for this client-only fix.

## Completion receipt

`verification-held.json` records focused verification, not an accepted full-source dashboard receipt. The 40-check manifest `docs/development-tasks/race-dialog-keyboard-ownership.json` retains earlier reliability gates and adds this browser check. The source-stability guard remains unchanged. Guarded completion awaits the hosted E2E chat finishing its source evidence edits, as requested. No Jest upload, activation or publication was performed. The ongoing multiplayer audit remains active.
