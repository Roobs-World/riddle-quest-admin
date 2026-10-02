# Challenge alerts end-to-end verification — 2 October 2026

## Results

- All 16 server integration tests in `raceLivePush.it.test.ts` passed against the isolated `demo-riddle-quest-challenge-alerts` Firestore emulator.
- Browser invitation journeys passed at 1280px and 390px for Jest, Facebook native invitations, and Facebook share fallback.
- Expanded browser checks confirm an incoming invitation appears while multiplayer is already open after its focus refresh, appears exactly once after reload, and never automatically accepts a challenge. Explicit acceptance joins the original reserved lobby and reaches shared gameplay.
- Native dialog cancellation and failure remain retryable. Unsupported native invitation hosts omit the friend challenge action.
- Notification controls passed at 1280px, 390px and 280px, including first-click revocation, denied consent, pending operations across modal navigation, selected-state synchronization in Settings and Profile, keyboard interaction, failed revocation, and unsupported adapters.
- Server checks cover idempotent invitation publication and delivery, recipient-language copy, ambiguous provider timeouts, expired subscriptions and lobbies, opted-out and blocked recipients, deleted accounts, previously accepted challenges, shared-device token ownership, registered-account authorization, and subscription revocation.

## Evidence and reproduction

Logs are retained under `artifacts/challenge-alerts-e2e-2026-10-02/`. Browser screenshots are retained under `artifacts/live-pvp-invitations/browser/` and `artifacts/challenge-notification-toggle/`.

After building the core package and Firebase Functions, run from the repository root:

```bash
pnpm --dir firebase-functions exec firebase emulators:exec --config ../firebase.json --only firestore --project demo-riddle-quest-challenge-alerts 'pnpm exec jest --config jest.config.js --testMatch "**/raceLivePush.it.test.ts" --runInBand && node ../packages/portal/scripts/verify-live-race-invitations-browser.mjs'
pnpm --filter @qwordly/portal test:challenge-notifications:browser
```

## Scope

The tests use real game components and server invitation services with local demo data. Provider delivery, native dialogs and browser notification-consent outcomes are injected. Real FCM delivery, service-worker notification clicks, and delivery through a live Facebook host to an actual device are not verified by this run.

An intermediate expanded run failed before the alert checks because its lobby bundle lacked the newly referenced `Ranks.BRONZE` translation. Rebuilding the harness after the source catalog contained that label resolved the failure; the final expanded run passed.
