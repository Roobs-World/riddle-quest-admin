# Multiplayer keyboard activation

Verified 2026-10-01 against the local production multiplayer screen. The hosted Jest E2E chat remains active and its evidence file is untouched.

## Failure and change

The global answer keyboard handler consumed Enter while a gameplay button had focus. With a complete APPLE attempt, pressing Enter on Hint issued `game:submitRaceGuess` instead of `game:requestRaceHint`. The corrected harness run using the saved prior production handler reproduces this exact assertion failure in `artifacts/race-keyboard-activation/negative-browser.log`.

The shared answer keyboard module now ignores already-consumed and IME composition events. Enter on a focused button, link or other supported activation control retains the control's normal browser behavior. Enter from the game area still submits; physical letter and backspace shortcuts retain their existing behavior. No new visible text or locale changes were needed.

## Verification

- Fourteen injected production RaceTo10Game browser scenarios passed at 1280px and 390px: focused Hint, Skip, letter Q and Submit, background Enter, prevented Enter and composing Enter. Each action issued only the expected authority command; Q edited APPLE to APPLQ with no submission. No alerts or page errors occurred.
- Eight retained pending-answer recovery browser scenarios and two provider-confirmed outcome scenarios passed.
- Complete client suite: 1,583 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven configured isolated builds passed: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo and GameSnacks. Exact dependency-evidence verification passed.
- Portal types, declaration documentation, source size, security and scalability checks passed.

The browser harness uses desktop Chromium with desktop and mobile-sized viewports. Synthetic composition events verify shortcut suppression; this is not physical device IME evidence. This client-only change did not require Firebase Functions deployment.

## Completion receipt

`artifacts/race-keyboard-activation/verification-held.json` records production and dependency-evidence hashes for these focused checks. It is not an accepted full-source dashboard receipt. The 37-check manifest `docs/development-tasks/race-keyboard-activation.json` retains prior multiplayer recovery and backend gates and adds this browser check. Run the guarded completion workflow once the other chat has finished changing source evidence. No guard exclusions were added, no hosted preview was replaced and Jest was not published.
