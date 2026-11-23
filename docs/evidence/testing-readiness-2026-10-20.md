# Hosted testing readiness — 20 October 2026

The deployed backend and active Jest build pass the technical readiness checks. Tester setup is pending: the connected Chrome browser is signed out of Jest Developer Console, so existing Sandbox Users and their login access have not been verified. No accounts were created or modified.

Use the [hosted testing handoff](../testing/hosted-testing-handoff-2026-10-20.md) for the ordered checks and expected results. The [pinned game version](https://jest.com/g/riddle-q?versionId=01a1567e-c03d-712d-b40e-2ef13b822050) is `1.0.0-dev.20261020-keyboard-complete.mvfvxio4`. It is active and ready; the game remains unpublished.

## Verified prerequisites

| Area | Readback |
| --- | --- |
| Backend | All 16 deployed regional instances are ACTIVE, receive traffic on the verified revisions, and match release source provenance. |
| Runtime parity | All 533 runtime/core files and 21 prepared hashes match the deployed source. |
| Daily content | All 16 locales have current playable Daily documents. A Dutch generation attempt recovered through the existing retry at 07:08 UTC; it is not a current content blocker. |
| Frontend delivery | All 419 hosted files match the uploaded archive byte for byte. Critical HTML, JavaScript and CSS MIME types pass. |
| Jest SDK | The official SDK endpoint returned HTTP 200 with nonempty JavaScript. |
| Test plan | Keyboard targets, Daily-to-Classic, achievement timing, subscription exclusion, public waiting and private invitation isolation have ordered manual checks. |

## Remaining setup

An owner must sign in to [Jest Developer Console](https://auth.jest.com/ui/login) and confirm or prepare three Sandbox Users in separate browser profiles. The authenticated Jest tools expose game configuration but do not expose Sandbox User management. Existing testers are unverified, rather than known to be missing.

Use a fresh sandbox player for an unfinished Daily and a first achievement. Confirm the provider's no-charge sandbox payment dialog before completing a subscription. Active and inactive subscription account states have not been prepared by this audit. An actual SMS delivery check also needs an agreed recipient and authorized send; no message was sent during readiness work.

## Evidence and limits

- [Backend readiness](../../artifacts/testing-readiness-20261020/backend/backend-readiness.json)
- [Hosted file readback](../../artifacts/testing-readiness-20261020/hosted-content/readback.json)
- [Jest access and sandbox readback](../../artifacts/testing-readiness-20261020/frontend/provider-readiness.json)
- [Deployment and activation receipt](continuation-release-2026-10-20.md)
- [Keyboard verification](keyboard-hit-targets-2026-10-20.md)
- [Multiplayer, difficulty and security verification](human-wait-difficulty-security-2026-10-18.md)
- [Completion, checkout and performance verification](current-task-performance-2026-10-19.md)

This audit used configuration, content and deployment readbacks. It did not execute hosted gameplay, purchase or SMS journeys, run new game test suites, change runtime code, deploy another release, publish the game or submit it for review. Prior local and emulator results remain separate from the hosted checks awaiting testers.
