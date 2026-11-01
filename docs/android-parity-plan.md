# Android parity plan

Tracks [ADR 0008](adr/0008-android-hosted-parity.md): bringing `packages/android` to the Jest Web Target's product surface with native screens. Completion of a step requires implementation plus recorded verification (unit gates, the adb device suite, and where applicable the Firebase emulators). Owner prerequisites are listed per phase; nothing in this plan authorizes a Play upload.

Scale for context: the hosted browser game is roughly 36,000 lines of host, play, race, commerce, profile and notification code with ~150 browser harnesses. The shared-logic/native-views pattern from `@qwordly/solo` is applied phase by phase so logic moves once and only views are written twice.

## Phase 1 — Account and confirmed solo play

- [ ] 1.1 Backend: `provisionAndroidAccount` callable creates the Global Game Account for an authenticated Firebase user whose sign-in provider is `anonymous` (later also `google.com`), idempotently, with the same reserved-username and starting-balance rules as Jest. App Check enforced like every other callable.
- [ ] 1.2 Shared: move the provider-neutral Firebase client (`packages/portal/src/firebase.ts` callable surface, protected-content decoding, region selection) into `@qwordly/hosted` as a factory taking configuration and an auth persistence strategy; the portal keeps module-level re-exports.
- [ ] 1.3 Shared: move the `HostServices` contract and the DOM-free hosted play logic (`HostedPlaySession`, checkpoints, journal, attempt recovery, completion presentation ordering) into `@qwordly/hosted`; portal re-exports.
- [ ] 1.4 Android: Firebase JS SDK with AsyncStorage auth persistence, anonymous sign-in, account provisioning, and an account screen showing the confirmed balance; emulator configuration (`10.0.2.2`) for local verification.
- [ ] 1.5 Android: native Classic and Daily screens driven by server-issued sessions through the shared hosted play logic, replacing the self-contained solo screens; hints, continue, skip and completion are server-confirmed.
- [ ] 1.6 Verification: backend unit tests for provisioning; `@qwordly/hosted` tests; adb suite running against the Firebase emulators with a seeded account.
- Owner prerequisites: Firebase Android app registration (`google-services.json` is not required for the JS SDK but is for Play Integrity), Play Integrity API enabled in Play Console, and an App Check exchange endpoint decision (see 1.7).
- [ ] 1.7 Attestation: `exchangeAndroidAttestation` verifies a Play Integrity verdict server-side and mints an App Check token (Admin SDK) for the Firebase JS `CustomProvider`; debug tokens for emulator runs only.

## Phase 2 — Multiplayer and profile

- [ ] 2.1 Shared: move `RaceSession`, race authority reconciliation, invitation polling and presentation logic into `@qwordly/hosted`.
- [ ] 2.2 Android: Race to 10 lobby, countdown, live gameplay, results; friend challenges through the Android share sheet and app links.
- [ ] 2.3 Android: profile, username and avatar, leaderboards, achievements, account deletion.
- [ ] 2.4 Android: notifications through Firebase Cloud Messaging for race invitations and daily reminders (native module required).
- [ ] 2.5 Verification: adb suite for lobby, invitation, live race against the emulators; two-device race via two emulators.

## Phase 3 — Commerce

- [ ] 3.1 Backend: server-authoritative, idempotent Google Play Billing grant (`grantAndroidPurchase`) verifying purchase tokens with the Play Developer API; subscription sync mirroring `syncJestSubscriptions`.
- [ ] 3.2 Android: shop with coin packs and Premium through the Play Billing library (native module), restore, and cancellation handling.
- [ ] 3.3 Verification: Play internal-testing licence testers; receipts replayed in backend tests.
- Owner prerequisites: Play Console products and subscriptions, service account for the Play Developer API, upload key.

## Phase 4 — Release

- [ ] 4.1 Retire the self-contained solo screens or keep them as the offline mode behind a connectivity check (decision recorded here).
- [ ] 4.2 Data safety form reflects account, purchases and analytics; privacy notice updated.
- [ ] 4.3 Full gate: unit, hosted emulator e2e, two-device race, Play internal testing.

## Evidence

Recorded per step as it completes.
