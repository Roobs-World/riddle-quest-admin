# Multiplayer overlay ownership

Verified 2026-10-01 against local production source. The ongoing hosted Jest E2E preview and its evidence file were left untouched.

## Failure and change

The game frame concurrently presented multiplayer, onboarding guidance and reducer-owned achievement fanfare. Each dialog managed keyboard focus independently. The injected production frame reproduced two simultaneous dialogs against the saved prior source in both challenge entry with pending onboarding and a server-confirmed completed race with an achievement.

The frame now defers its game modal while multiplayer is open and suspends guidance presentation. Guidance stays mounted with its pending step; suspension disables its focus handling and tooltip measurements. Reducer-owned reward data is retained. Closing multiplayer restores onboarding or the achievement as the single dialog, including keyboard focus and Tab containment. No visible text, locale key or provider integration changed.

## Verification

- Four injected Chromium scenarios passed: onboarding/challenge entry and server-confirmed result/achievement, each at 1280px and 390px. Assertions check one dialog, absence of obscured dialogs, focus containment, deferred presentation and focus restoration, no page errors or alerts, and no unintended race start, guess or abandonment commands.
- Complete client suite: 1,599 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven configured isolated builds passed, followed by exact target dependency-evidence verification.
- Portal types, TSDoc, file size, security and scalability checks passed.
- The resumed mobile achievement screenshot was visually inspected.

Logs, saved prior sources, screenshots and source/artifact hashes are in `artifacts/race-overlay-ownership/`. Baseline failures are expected regression evidence. The browser fixture substitutes only the decorative solar system and exposes reducer/guidance observations; game frame, guidance, race session, outcome projection and styles are production modules. This is local injected verification, not a claim that the held hosted draft contains the fix. No Firebase Functions deployment is required for this client-only change.

## Completion receipt

The focused proof is `artifacts/race-overlay-ownership/verification-held.json`, not an accepted full-source dashboard receipt. The 39-check manifest `docs/common/development/development-tasks/race-overlay-ownership.json` retains all prior backend and browser gates and adds overlay ownership verification. The source-stability guard remains unchanged. Guarded completion and automatic dashboard recording await the other chat finishing its full pathway tests and source evidence edits, as requested by the user. No Jest upload, activation or publication was performed.
