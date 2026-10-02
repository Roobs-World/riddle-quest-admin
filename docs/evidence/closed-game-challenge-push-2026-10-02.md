# Closed-game challenge notifications — 2 October 2026

## Changes

The user-supplied public Firebase Web Push certificate is now in the Jest-only Vite configuration under `config/vite/portal/.env.jest`. The project-specific local Firebase deployment configuration prepares `JEST_CHALLENGE_PUSH_ENABLED=1` for the next server release.

The Jest service worker is emitted as a real script entry through the normal dependency-audited build graph. It is registered as a module worker because the production bundler can emit shared module imports. The worker URL remains a standard source URL import in injected harnesses and development. Other targets reject the Jest worker virtual entry.

## Verification

- All six production target builds and their isolation audits passed.
- The supplied public push key was found only in the Jest artifact.
- The closed-game browser test loads the actual emitted worker in full Chromium, grants notification permission, closes every game page, injects a provider push event, and verifies a real browser notification exists. Duplicate messages replace the same tagged notification; malformed and expired invitations produce no additional notifications. Display never reopens or accepts the game.
- Worker payload/click tests and dependency-inventory regression tests passed: 13 tests. The focused worker URL build tests also passed after switching the test entry to the actual target-owned source import.
- Notification modal checks passed at 1280px, 390px and 280px.

Run the artifact browser test after building Jest:

```bash
pnpm --filter @qwordly/portal test:challenge-push:browser
```

## Production status and limits

A read-only check confirmed the deployed delivery function is active but has neither `JEST_CHALLENGE_PUSH_ENABLED` nor `FACEBOOK_CHALLENGE_PUSH_ENABLED` set. Firebase Cloud Messaging and FCM Registration APIs are enabled for the project. No production activation, upload or deployment was performed during this change.

Players need the configured Jest build and server activation released, an authenticated registered account, and successfully granted browser notification permission. Browser permission and service-worker support remain dependent on the host environment. This test injects the provider push event and does not claim actual FCM delivery to a user's device. Live invitations remain subject to their server deadline and the inviter's lobby heartbeat.
