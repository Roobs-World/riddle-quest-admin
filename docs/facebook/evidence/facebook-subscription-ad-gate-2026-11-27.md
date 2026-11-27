# Subscription ad gate correction — 27 November 2026

The [deployed source comparison](facebook-deployed-source-comparison-2026-11-27.md) found that the active Facebook configuration endpoint can enable ads without reading the player's subscription status. This client correction independently reads the authenticated account's existing server-owned subscription field and combines it with the existing ad configuration. It does not change or deploy Firebase code, rules, configuration or provider server modules.

## Behavior and review

- Verified subscribers cannot acquire or display rewarded, interstitial or banner ads, even when the legacy endpoint enables those formats.
- An unknown entitlement suppresses native ad calls while retaining an eligible rewarded retry action. Startup, coin continuation and skip remain available.
- A fresh read is required before acquisition and after native preparation. An older pending resume read cannot authorize a later impression.
- Banners hide when authorization is lost and can retry once on a later eligible visit. Existing display ownership and hide-failure handling remain intact.
- Account deletion and unmount immediately retire entitlement reads. Late credentials or responses cannot authorize a request for a retired account.

The [ad eligibility contract](../facebook-ad-eligibility.md) documents the single-field HTTPS read, existing ID-token/App Check authority, eight-second deadline, 8 KiB streamed response bound, exact owner-document validation and sanitized failures. Independent read-only security review found no blocking issue in the completed transport, policy, entry/deletion wiring or banner lifecycle.

## Local verification

Meaningful failing behavior tests preceded implementation for subscriber suppression despite permissive flags, unknown-eligibility retry, banner recovery and the new entitlement transport. Final focused runs passed **122 tests across seven suites**:

- 74 tests: ad configuration, ad capability, expanded banner, ad preparation and rewarded continuation.
- 48 tests: subscription entitlement and the existing Facebook App Check adapter.

Transport cases include active/inactive and legacy omitted fields, wrong or missing documents, malformed values, denied access, credential failures, response limits, deadlines, pending-only coalescing, retirement and late completion. Policy tests cover durable interstitial removal separately from optional rewarded ads, subscriber changes during preparation, and current-account ownership.

Shared TypeScript checking and the security configuration, Facebook profile boundary, visible-copy and secret-boundary audits passed. The visible-copy audit checked 688 required translations across 16 locales. The reviewed protected backend diff against `2834dc910a39aa9add734440ddfb8dfd533d30dc` remained empty.

The final injected-SDK browser journey passed in **30.907 seconds**. It exercised unavailable entitlement reads without native acquisition, retry recovery, subscriber startup suppression, fresh resume reads restoring the offer, and a subscription acquired while native loading was held. That last case made no display call and allowed an ordinary 50-coin continuation. Existing cancellation, no-fill, preparation timeout, claim-retry, tournament and account-cleanup checks stayed green. The isolated build audit covered 420 files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming SDK, native-module or secret leakage.

The exact browser command was:

```sh
PORTAL_BROWSER_TESTS=1 pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts
```

Intermediate browser runs exposed fixture assumptions about repeated onboarding and restored progress. The final scenario reuses the subscribed loss session and drives the injected SDK's resume callback; it does not weaken the display or economy assertions. No production change was needed for those fixture failures. Historical screenshots overwritten by the harness were restored.

Local logs are `/tmp/facebook-subscription-transport-final.log` and `/tmp/facebook-subscription-browser-final.log`. The [exact version 13 acceptance](facebook-testing-version-13-2026-11-27.json) and [native nonsubscriber continuation](facebook-native-subscription-version-13-2026-11-27.md) are recorded separately. Controlled local subscriber fixtures do not establish behavior on an untested live subscriber account.
