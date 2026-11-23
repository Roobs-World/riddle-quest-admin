# Closed-game challenge notifications — 2 October 2026

## Changes

The user-supplied public Firebase Web Push certificate is now in the Jest-only Vite configuration under `config/vite/portal/.env.jest`. The Firebase challenge functions have been released with `JEST_CHALLENGE_PUSH_ENABLED=1`.

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

The Firebase MCP deployment completed successfully (job `1790966887359`), selecting only `setLiveRacePushSubscription` and `deliverLiveRaceChallengePush`. Both functions are active in `europe-west1`, with `JEST_CHALLENGE_PUSH_ENABLED=1`; their final update timestamps are `2026-10-02T18:49:55.874114551Z` and `2026-10-02T18:49:54.824217529Z`. Firebase Cloud Messaging and FCM Registration APIs are enabled for the project. A temporary deployment copy excluded reserved local `FIREBASE_*` environment entries; the original files were preserved and the MCP environment was restored to the repository afterward.

The Jest MCP server confirmed build `1.0.0-challengepush.20261002184250` (`01a0fded-239f-7578-b5c5-c86bff5c09c8`) is ready and active, activated at `2026-10-02T18:50:39.728Z`. Uploaded ZIP SHA-256: `d6ffe5f23e050cb6dcfd911fcc22cd6b1693967c0f9e14447b59ccef56edbb26`. The previous build remains available for rollback. The game is still unpublished; build activation does not submit or approve moderation.

The worker downloaded from the new Jest build matched the verified local artifact byte for byte. Chromium then registered the worker directly from the Jest build host, closed every page, injected a push event, and confirmed one real browser notification with zero pages open. See `artifacts/closed-game-challenge-push/remote-result.json`. This verifies the deployed worker and its module imports; it does not establish notification permission inside the Jest embed or actual device delivery through FCM.

Players need an authenticated registered account and successfully granted browser notification permission. Browser permission and service-worker support remain dependent on the host environment. These tests inject the provider push event and do not claim actual FCM delivery to a user's device. Live invitations remain subject to their server deadline and the inviter's lobby heartbeat.
