# Jest backend deployment and subscription checkout protection

The five Jest endpoints using the updated signed-token verifier were deployed to `riddle-quest-ec2b2` on 18 October 2026. Independent Cloud Functions v2 metadata reads confirmed every endpoint ACTIVE on Node 22, with all traffic on its latest revision. The endpoint names, revision IDs, update times, and compiled runtime fingerprint are in [deployment evidence](../../../artifacts/jest-api-deployment-2026-10-18.json).

The deployment used a verified copy of compiled runtime files and the existing production environment. Direct compilation and static deployment validators avoided the repository's test-running build hooks. No other functions, rules, indexes, or hosting resources were deployed.

## Subscription behavior

- Any active subscription reported by Jest or verified by the backend suppresses every inactive subscription offer.
- The checkout coordinator refreshes the signed subscription catalog before calling `beginSubscription`, including callers that bypass the shop hook. An active or unavailable offer cancels checkout.
- A pending flag prevents overlapping checkouts in one coordinator. A per-player exclusive Web Lock prevents overlapping checkouts across tabs on the same game origin. Checkout cancels when the lock is unavailable or unsupported.
- The lock remains held until Jest returns the actual checkout result and backend entitlement synchronization settles. A local timer cannot release it while the provider might still complete billing. Cancellation confirmation retains its separate timeout.
- An already-active click or restored subscription does not report a new successful purchase or revenue event. Guest subscription offers still reach Jest's own signup gate.

## Verification and upload

Backend and portal TypeScript compilation passed. Static capacity, deployment environment, module-cycle, target-boundary, locale, license, Console manifest, artifact size, and HTML checks passed. Independent source review confirmed that both the unsupported-lock fallback and premature checkout timeout were removed. No test suites or browser harnesses ran for this request. Existing fixtures were updated without execution.

Jest processed client version `1.0.0-dev.20261018-subscription-guard.mvdt3mni`, ID `01a14f00-adc6-7073-9808-2039fc4897f9`, to `ready`, with `isActive: false` and no processing error. [Preview this build](https://jest.com/g/riddle-q?versionId=01a14f00-adc6-7073-9808-2039fc4897f9). Its ZIP SHA-256 is `03e019dfe806f40de8fdefa1f71c239ac347228c7bf8fe62acb2b754a1bb7a73`.

The backend is deployed. The client checkout protection takes effect for the active game after this build is activated. No activation, publication, or review submission was requested or performed.

The current Jest contract requires suppressing alternative offers for equivalent subscriptions because each SKU can bill independently. See [the official subscription lifecycle](https://docs.jest.com/sdk/html5/subscriptions#subscription-lifecycle). Signed subscription-token freshness remains subject to the limitation recorded in the [API alignment audit](jest-api-alignment-2026-10-18.md).
