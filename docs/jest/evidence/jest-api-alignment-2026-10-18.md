# Jest API alignment, 18 October 2026

The Jest integration was compared with the current official HTML5 documentation and SDK runtime. The adapter now uses the official `@jest-com/types` package, pinned to `1.261015.4`, instead of an untyped SDK object.

## Corrections

- Guests can see subscription offers and enter Jest's checkout. Jest owns the signup gate; `guest_not_allowed` closes checkout without a second registration prompt or an entitlement change.
- The adapter maps the subscription catalog's documented `signed` field into the game's `subscriptionsSigned` field.
- Sandbox checkouts grant their items normally and do not emit purchase revenue events. Restoring an existing subscription also does not count as a new sale.
- Notification identifiers are required. Runtime notification assets accept HTTPS URLs up to 2,048 characters or supported image data URLs up to 2,097,152 encoded characters, matching the current SDK validator.
- Signed server payloads reject expired `exp` claims, future `nbf` claims, and malformed values for either claim. Existing HS256, audience, subject, and identity freshness checks remain in place.
- Optional screenshot capture loads when Jest requests it, and notification canvas rendering loads when reminders are prepared. Missing chunks or rendering failures return the existing fallback. User-triggered referral dialogs retain synchronous image preparation and SDK dispatch.

## Reviewed behavior

SDK initialization precedes platform reads. Manual loading uses progress updates and a bounded heartbeat until the game is interactive. Browser visibility listeners already own hide/show behavior; adding SDK visibility subscriptions would duplicate those signals.

Identity exchange, purchases, referrals, and subscriptions pass signed envelopes to the backend. Purchase grants are recorded idempotently before `completePurchase`, and startup recovery processes all incomplete-purchase pages. Profiles and avatars permit missing values. Registration dismissal and share-dialog completion do not imply successful registration or referral conversion.

## Verification and limits

Portal and Firebase Functions TypeScript compilation passed. The Functions build passed its capacity audit. Its prebuild hook also ran one module-cycle test unintentionally; no browser harness or gameplay test suite was run.

The client artifact passed the existing boundary, locale, license, Console manifest, size, and HTML checks. W3C validation reported zero findings. The checked ZIP is 2.74 MiB with SHA-256 `9836cb0f9bd27722e1d3c896ff955e8a781152429cc86d0b2168cd9feeca12bc`.

Jest processed version `1.0.0-dev.20261018-jest-api.mvddo5gk`, ID `01a14d75-2f66-701d-b326-3a1e3c3dab7c`, to `ready` with `isActive: false` and no processing error. [Preview the uploaded build](https://jest.com/g/riddle-q?versionId=01a14d75-2f66-701d-b326-3a1e3c3dab7c). The upload contains the current working tree at source commit `c1224fc18ff145d4d1d5ae34650ea075b378b6a5`, including pre-existing uncommitted work. No activation, publication, or review submission occurred.

The server verifier change was subsequently deployed on 18 October 2026 to `riddle-quest-ec2b2`. All five affected endpoints were independently confirmed ACTIVE on Node 22 with all traffic on their latest revisions. Exact revisions and the compiled runtime fingerprint are recorded in [deployment evidence](../../../artifacts/jest-api-deployment-2026-10-18.json).

Real sandbox settlement, messaging delivery, two-player referral attribution, and device performance remain outside this static review. Subscription tokens without validity claims have no documented freshness guarantee: `exp` and `nbf` validation protects tokens that carry those claims, but cannot prove that an old signed active snapshot without them still represents a current subscription. Resolving that limitation requires a platform freshness contract or trusted entitlement lookup.

## Sources

- [HTML5 SDK and official types](https://docs.jest.com/sdk/html5)
- [Launch checklist](https://docs.jest.com/launch-checklist)
- [Player identity and data](https://docs.jest.com/sdk/html5/player)
- [Payments](https://docs.jest.com/sdk/html5/payments)
- [Subscriptions](https://docs.jest.com/sdk/html5/subscriptions)
- [Notifications](https://docs.jest.com/sdk/html5/notifications)
- [Referrals](https://docs.jest.com/sdk/html5/referrals)
- [Social APIs](https://docs.jest.com/sdk/html5/social)
- [App lifecycle](https://docs.jest.com/sdk/html5/app-lifecycle)
- [Loading screen](https://docs.jest.com/sdk/html5/loading-screen)
- [Current CDN SDK](https://cdn.jest.com/sdk/latest/jestsdk.js)
