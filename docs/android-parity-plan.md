# Android parity plan

Tracks [ADR 0008](adr/0008-android-hosted-parity.md): bringing `packages/android` to the Jest Web Target's product surface with native screens. Completion of a step requires implementation plus recorded verification (unit gates, the adb device suite, and where applicable the Firebase emulators). Owner prerequisites are listed per phase; nothing in this plan authorizes a Play upload.

Scale for context: the hosted browser game is roughly 36,000 lines of host, play, race, commerce, profile and notification code with ~150 browser harnesses. The shared-logic/native-views pattern from `@riddle-quest/solo` is applied phase by phase so logic moves once and only views are written twice.

## Phase 1 — Account and confirmed solo play

- [x] 1.1 Backend: `provisionAndroidAccount` callable creates the Global Game Account for an authenticated Firebase user whose sign-in provider is `anonymous` (later also `google.com`), idempotently, with the same reserved-username and starting-balance rules as Jest. App Check enforced like every other callable.
- [x] 1.2 Shared: the typed callable surface of `packages/portal/src/firebase.ts` (protected-content decoding, region binding) now lives in `@riddle-quest/hosted` as `createGameFunctionsClient`; the portal keeps module-level re-exports and still owns Firebase initialization, auth persistence and App Check. Android-only callables are bound separately (`createAndroidAccountFunctions`) so web targets keep their exact surface.
- [x] 1.3a Shared: the `HostServices` contract, its Firebase implementation (`createFirebaseHostServices` with injected auth, callables, profile reads and copy), and its helpers (authority delivery, profile and riddle mapping, completion reward parsing) now live in `@riddle-quest/hosted` subpaths; portal modules import them directly. Android can create the same services against its React Native auth.
- [x] 1.3b Shared: the DOM-free hosted play session logic now lives under `@riddle-quest/hosted/play`: the session reducer and its types, `SavedGame` checkpoints (`GameSessionCheckpoints`), the Provisional Play journal (writer, reader, reconciliation, paid settlement, lease), confirmed-outcome recovery and completion presentation ordering; the portal imports them by subpath and keeps only its browser adapters (`localStorage`, `window` timers) and React hooks. `HostedPlaySession` itself stays in the portal because it assembles target-owned facts (platform capabilities, presence, referral sharing). Android journals every hosted draft and in-flight guess through the same journal over AsyncStorage (`createAndroidPendingPlayStorage`): a guess that fails in transit is redelivered with its original request id on the next launch, an edited answer cancels the redelivery, a rejected guess is dropped, and a journal left by another question is discarded.
- [x] 1.4 Android: Firebase JS SDK with AsyncStorage auth persistence, anonymous sign-in, account provisioning, and an account screen showing the confirmed balance; emulator configuration (`10.0.2.2`) for local verification. App Check (1.7) is still required before production calls succeed.
- [x] 1.5 Android: hosted-first launch (`AndroidApp`): the device connects on start, lands on a hosted home with server-issued Classic and Daily (`HostedGameScreen` + `useHostedGame`; guesses, hints, continue, skip and completion are server-confirmed and the balance comes from the account document), the Account screen, and Play offline. Copy comes from the shared `@riddle-quest/solo` tables plus a hosted-only table covering every supported locale. The self-contained game is the offline surface, reachable from the connect screen and the home and returning through Play online; the choice is per session (4.1 decides whether it stays). Provisional Play buffering arrived with 1.3b.
- [ ] 1.6 Verification: backend unit tests for provisioning; `@riddle-quest/hosted` tests; adb suite running against the Firebase emulators with a seeded account.
- Owner prerequisites: Firebase Android app registration (`google-services.json` is not required for the JS SDK but is for Play Integrity), Play Integrity API enabled in Play Console, and an App Check exchange endpoint decision (see 1.7).
- [ ] 1.7 Attestation: `exchangeAndroidAttestation` verifies a Play Integrity verdict server-side and mints an App Check token (Admin SDK) for the Firebase JS `CustomProvider`; debug tokens for emulator runs only.

## Phase 2 — Multiplayer and profile

- [ ] 2.1 Shared: move `RaceSession`, race authority reconciliation, invitation polling and presentation logic into `@riddle-quest/hosted`.
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

- 2026-11-02, step 1.5 (hosted-first, localized): Android unit suite 95 tests above the coverage thresholds (`androidApp.test.tsx` covers auto-connect, routing, offline fallback and retry, Spanish copy and the English fallback; `hostedCopy.test.ts` enforces every locale and key). On the `Medium_Phone` emulator against the seeded Auth, Functions and Firestore emulators, the full adb suite passed 9/9 with nothing skipped: the cold launch provisioned the account and showed the hosted home with 300 coins, the account round-tripped through the offline menu and back without reconnecting, a relaunch confirmed the account, and the server-issued Classic solved and advanced; the offline scenarios reach the menu through Play offline (`tapIdUntil` in the driver tolerates the connect-to-home transition under the tap). TSDoc and file-size audits pass; no shared package or Web Target source changed in this step.

- 2026-11-01, step 1.1: `provisionAndroidAccount` unit tests (6) pass with the backend type check, lint, export audits and the export-list test.
- 2026-11-01, step 1.2: `@riddle-quest/hosted` unit tests (5) pass; the portal type check, its full unit suite (3,392 tests), the Web Target boundary audit and a Jest target build with the artifact audit (0.55 MB initial resources, unchanged) pass against the shared client; the Android unit suite and the emulator account scenario pass with the Android client built on it.
- 2026-11-01, step 1.3a: portal type check, the four host-services suites and the Firebase adapter suite (64 tests), the full portal unit suite, the boundary audit and a Jest target build pass with the shared services; the Jest entry graph stays within its 0.55 MB budget (subpath imports keep `@riddle-quest/core/validation` out of the Firebase chunk's preloads).
- 2026-11-01, step 1.5 (slice): with the Firestore emulator seeded from the bundled pack (`packages/android/scripts/seed-emulator-classic.mjs`), the release APK connected, loaded `race:history:01` through `getClassicRiddleBuffer`, submitted "rome" through `submitSinglePlayerGuess`, settled through `completeGame` ("Solved!", coins earned), and loaded the next issued riddle with the confirmed balance above 300. Content protection is a host option now; Android opts out because Hermes has no `crypto.subtle`. Scenario: `plays a server-issued Classic riddle` in the adb suite; 10 unit scenarios in `hostedGame.test.tsx`.
- 2026-11-01, step 1.4: on the `Medium_Phone` emulator against the local Auth, Functions and Firestore emulators, the release APK signed in anonymously, `provisionAndroidAccount` executed in the Functions emulator, and the Account screen showed "Account created." with 300 server coins; a cold relaunch confirmed the existing account. Scenario: `signs in anonymously and provisions a hosted account` in `packages/android/scripts/android-device/e2e.test.mjs`.
