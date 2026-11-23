# Riddle Quest release readiness, 25 October 2026

The current Jest build is `1.0.0-dev.20261025-review-complete`, version `01a17226-db08-708f-86a1-6733b1fe4824`. Provider readback confirms Ready and active since 08:22 UTC. It includes the six gameplay review fixes and the real screenshot renderer. All 419 hosted files, totaling 4,928,155 bytes, match the local artifact. The compiled screenshot callback and all seven source hashes in its prior verification receipt match. No duplicate upload or application change was needed.

[Open the active build](https://jest.com/g/riddle-q?versionId=01a17226-db08-708f-86a1-6733b1fe4824). [Artifact and Simulator receipt](completion-readback-2026-10-25.json).

## Official Simulator

A fresh Chrome tab was confirmed muted before navigating to the submission page. The first app frame was blank. One ordinary Reload app recovered it. No page scripts were injected. The current official Simulator passes all 20 of 20 Basic Launch checks and displays Ready to submit with an enabled Submit for review button.

The manual session covered guest startup and progress saving, the custom registration prompt and SMS placeholder, a session-only mocked registration through Config, the seven-day notification sequence, catalog reads, completion of one recovered purchase, a canceled mock coin checkout, a successful mock Premium subscription, and the owned-plan no-reoffer check. The shop displays Premium active. Notifications covered all seven days with fourteen scheduled reminders; the first was four seconds after registration. No real payment, SMS or invitation was sent. No automated test suite or new browser harness was run.

The muted submission tab is retained for the final review decision. The existing SDK and source validation records remain historical evidence, independently tied to the matching delivered bytes. These Simulator checks use mocked provider outcomes and do not prove real commerce, messaging delivery or subscription replay protection.

## Remaining release gate

The game is unpublished, with no in-review or published revision. No review submission was made. The next concrete action is submitting this exact active build for Jest review, subject to the repository requirement for explicit authorization. Jest approval is still required for the app to go live. Fresh readbacks found zero open GitHub issues and zero open Jest player-feedback items.

This record supersedes the earlier upload-pending screenshot note and the earlier blank-Simulator blocker. It does not change provider publication decisions, other platform partner gates or the documented subscription freshness limitation.
