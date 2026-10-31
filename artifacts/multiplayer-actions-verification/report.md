# Multiplayer actions verification

The current multiplayer UI has two separate actions.

- **Start PvP match** joins the public queue. Two independent registered player sessions paired in the same server lobby, reached countdown and gameplay, and saw each other's answer progress. Neither session opened an invite. Passed at 390px and 1280px against the real Firestore-emulator service.
- **Challenge a friend** reserves a private lobby, then automatically calls `JestSDK.referrals.shareReferralLink` through the Jest adapter after the server returns its invitation handle. The payload carries that exact handle and the multiplayer destination. Guest and registered sessions passed at 320px, 390px and 1280px in development and production React. Cancellation, error recovery, keyboard retry, duplicate exclusion and accepting the original lobby also passed.

The public and private paths remain separate on the server. Five focused Firestore integration tests passed, covering public pairing/countdown, the original private lobby, idempotent acceptance and exclusion of private invitations from public searches. The SDK adapter and launch-payload unit suites passed all 102 tests. The native-dialog lifecycle harness passed all 66 observations.

The invitation cases also passed through the untouched official Jest SDK, version `26.10.16.17`, with a local platform bridge. Its real `ShareReferralLink` messages contained the original lobby handle. This repeated all 12 development/production, screen-width and registration cases, including cancellation, errors and retries. The tested SDK came from `https://cdn.jest.com/sdk/latest/jestsdk.js` and had SHA-256 `77d9367144ae6dbd2d748fc87073cb1cc8a797d2b9944b25eb0363ccdfbc57ae`.

Evidence is recorded in:

- `artifacts/live-public-match-2026-10-17/evidence.json`
- `artifacts/live-public-match-2026-10-17/backend.log`
- `artifacts/live-public-match-2026-10-17/private-authority.log`
- `artifacts/multiplayer-jest-invite-2026-10-17/development/browser.json`
- `artifacts/multiplayer-jest-invite-2026-10-17/production/browser.json`
- `artifacts/multiplayer-jest-invite-2026-10-17/official-sdk/development/browser.json`
- `artifacts/multiplayer-jest-invite-2026-10-17/official-sdk/production/browser.json`
- `artifacts/multiplayer-actions-verification/native-invite/browser-after.json`

Repeat the browser invitation checks from the repository root:

```bash
pnpm --filter @qwordly/portal test:jest-live-invite:browser
```

To repeat with an untouched local copy of the official SDK, set `JEST_LIVE_INVITE_OFFICIAL_SDK_PATH` to its absolute path and use a separate `JEST_LIVE_INVITE_REPORT_DIR` for each React mode. The default command uses instrumented adapter responses; the optional mode records actual SDK bridge messages and supplies local platform responses.

Repeat public matchmaking against an isolated Firestore emulator after building the current backend:

```bash
env -u DEBUG node firebase-functions/scripts/run-isolated-emulators.js emulators:exec \
  --config firebase-functions/firebase.race-verification.json \
  --only firestore --project demo-riddle-quest-multiplayer \
  "node packages/portal/scripts/verify-live-public-match-browser.mjs"
```

These tests use synthetic accounts and local platform responses. No real SMS was sent. The hosted Jest page returned HTTP 403, "Game not live yet", in the available browser session, so this is local application, official SDK and backend verification rather than a carrier-delivery claim.

The current Jest artifact passed TypeScript, target-boundary, locale, license, console-manifest, artifact and HTML checks. It was uploaded as `1.0.0-dev.20261017163224.multiplayer-verified`, build ID `01a14ab7-22ed-7592-b64c-8d8860e5b9ac`. Jest reports processing complete, status `ready`, and `isActive: false`.

[Preview the uploaded build](https://jest.com/g/riddle-q?versionId=01a14ab7-22ed-7592-b64c-8d8860e5b9ac).
