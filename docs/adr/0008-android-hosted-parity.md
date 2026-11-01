---
status: accepted
supersedes: 0007
---

# Bring the Android app to parity with the hosted Jest game, natively

The Android app will become a full hosted Riddle Quest client with the same product surface as the Jest Web Target: a Global Game Account with server-confirmed progress and server-issued Classic and Daily content, Race to 10 live multiplayer with friend challenges, profiles, referrals, notifications, and a shop. It will be built natively in React Native rather than by wrapping the browser build. Identity starts as Firebase anonymous authentication provisioned by a new Android identity callable, upgradeable to Google sign-in later.

## Considered options

- Keeping Android self-contained (ADR 0007) was rejected by the owner: the first release must match the hosted game.
- Loading the hosted web bundle in a WebView was rejected by the owner in favour of a native user interface, accepting the longer schedule.
- Reusing the browser host layer as-is was rejected because it is bound to the iframe bridge and DOM; its provider-neutral state machines are moved into shared packages instead, following the pattern already used for solo play (`@qwordly/solo`).

## Consequences

- The program runs in phases recorded in `docs/android-parity-plan.md`; each phase ships behind the existing adb end-to-end gate and the unit gates before the next starts.
- Phase 1 reverses the "no network" property of ADR 0007: release builds gain `INTERNET`, Firebase Auth, Functions, and App Check. The self-contained solo app remains the offline fallback until confirmed progress replaces it, then is retired.
- Backend callables require App Check in production, so Android needs Play Integrity attestation exchanged for App Check tokens through a new server endpoint; until the owner configures Play Integrity, hosted Android play is verified only against the Firebase emulators.
- Google Play Billing stays a Capability Gap until Phase 3 delivers a server-authoritative, idempotent grant; no purchase surface appears before that.
- Browser-only host code (bridge router, iframe lifecycle, DOM input) stays in the portal; everything the native app and the web share moves to packages the Web Target boundary audit already permits.
