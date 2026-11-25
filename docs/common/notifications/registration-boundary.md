# Registration and device ownership

Games save account consent and request a manager handoff. The manager's device page handles operating-system permission, subscription registration and completion. Its service worker or the Android native receiver handles received pushes, display and taps. Game startup after a notification tap is ordinary startup.

## Caller contract

```ts
const registration = createManagerNotificationProvider({
  preferences,
  saveConsent,
  registerAccount,
  available: registeredAccount,
});
await registration.register();
```

The resulting `kind: "manager"` snapshot contains `registration`, with unavailable, available, handoff or failure states. The handoff contains a private URL and expiry. It never contains device delivery readiness. Only a `kind: "device"` provider exposes `requestPermission`, `recordActivity` and delivery state. Shared Settings chooses its behavior at this boundary.

The registration callback uses the existing `createNotificationEnrollment` callable. It validates the active authenticated UID, account operation gate and exact manager handoff URL. The manager provider serializes consent writes and invalidates old operations on account retirement or consent changes. Consent-save and registration failures remain distinct. Off, expiry and retirement remove the local handoff.

## Design decision

Two designs were compared: a small registration adapter over the existing endpoint, and a complete separation of manager and device capabilities. The implementation keeps the first design's endpoint scope and expected-UID validation, with the second design's provider-kind union and method separation. This removes the old enrollment controller, popup ownership, pairing-code persistence, completion-message listener and game-driven device-status polling.

A user-only Supabase installation row was rejected because an account identifier cannot receive push. Canonical Firebase profiles remain the account authority; manager installations remain actual device routes. No server endpoint, manager deployment or database migration is required. The deployed status callable and manager completion message remain available to older uploaded clients, but new game artifacts may not reference either. Artifact audits enforce that restriction.

Device-owned registration on the manager page remains necessary for browser permission and push subscriptions. Native Android retains its native token and permission adapter. Browser leases currently renew on manager-page visits and can expire after 30 days without one. Adding automatic worker renewal requires a separate revision-preserving server design; incrementing the registration revision while checking an incoming push would invalidate that push.

Jest uploads follow the standing release authorization after builds. Manager website deployment remains a separate release. Unit tests and browser harnesses run only when explicitly requested.

The [November 25 release record](../../jest/evidence/jest-manager-registration-only-2026-11-25.json) confirms the registration-only Jest build is ready and active. The affected web builds, native/shared type checks and compiled game boundary audits pass. Regression specifications were updated and type-checked without executing tests or browser harnesses.
