# Multiplayer challenge refresh journal ownership

Verified 2026-10-01 against local production source. The ongoing hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

Challenge entry writes a recovery hint before transport. A retry or waiting-invitation poll repeated that unconditional write, replacing another tab's newer challenge selection. Two public session matrix tests reproduced both refresh paths against prior source.

Once a challenge journey has a recovery revision, subsequent entry reads now refresh only the observed revision it owns. Replaced, unavailable and deleted journals are preserved. Initial explicit challenge entry still writes its new selection. Valid entry responses continue updating the original tab normally, and polling schedules and request payloads remain unchanged.

## Verification

- Two new public session tests passed, each exercising replacement, denied read and deletion: six matrix scenarios across manual retry and automatic polling. Tests check exactly two entry commands for the original challenge, shared journal preservation and accepted ready response. Baseline tests each failed at their first replacement scenario.
- Twelve retained startup recovery and two denied-journal browser scenarios passed.
- Complete client suite: 1,622 tests in 186 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated target builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The new challenge refresh race is verified through the public session with injected storage and transport. Retained browser checks cover integration regressions; they are not direct reproduction of the new polling race. Logs and source/build hashes are in `artifacts/race-entry-journal-ownership/`. No visible text, provider SDK or Firebase deployment changed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/common/development/development-tasks/race-entry-journal-ownership.json` retains earlier gates; its full client suite includes these matrix tests. Guarded completion awaits the active hosted E2E chat finishing source evidence edits. The source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
