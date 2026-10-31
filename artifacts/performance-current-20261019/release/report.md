# Current matchmaking, subscriptions and Jest release audit

Runtime performance is inconclusive from this static audit. It identifies recurring work and release size pressure from the existing production artifact and source. It does not measure user latency, frame times, memory, billed Firestore operations, hosted Jest startup, or actual SMS delivery. The authorized checkout follow-up below ran focused unit checks. No browser profiling, builds, uploads, activation or deployments ran in this scope.

The final archive is the uploaded inactive `1.0.0-dev.20261019-performance.mvejisdk`, SHA-256 `23078e0758ddb8378318d9ec3f1933e23db32c34610a50c59b278b6e5b7d557a`. Its inventory and inspected source hashes are in [inventory.json](inventory.json). The original comparison artifact was inactive `1.0.0-dev.20261018-solo-wait-e2e.mvec8r8r`, SHA-256 `affb930bc94669069c5f12442c47a0c90c13a6bf613b32664fcefcb0cfea462a`; its exact original inventory remains in [inventory-baseline.json](inventory-baseline.json). Other agents may change source after these hashes were recorded. Artifact bytes describe the identified ZIP, not any later working-tree build.

## Baseline findings

1. A successful new subscription checkout performs two serial signed catalog reads and two server entitlement synchronizations before opening provider checkout. `useJestPurchase.ts:58` refreshes holdings and `subscriptionCheckout.ts:27` repeats it under the player Web Lock. Each existing-account sync reads the user and deletion documents and writes the user, even when holdings are unchanged, at `jestEndpoints.ts:478-506`. The second read protects the checkout after acquiring the cross-tab lock. Root owns evaluating removal of the outer redundant read while preserving UI refresh, cancellation behavior and that protected read. Saving one complete serial SDK/backend round trip is a control-flow reduction; its milliseconds require representative measurement.

2. Public search and private waiting poll every second even with a healthy revision stream. Hidden documents have the same one-second interval. `liveRacePolling.ts:9` returns before the healthy-stream branch in both cases. A full 15-minute wait has a theoretical upper bound of 900 polls per client before request duration, background browser throttling, failures and lifecycle events reduce or alter that count. Public search transactions reconcile the queue, profile, canonical seat and candidate eligibility. The queue reads at most 40 ticket snapshots and five authority documents per valid candidate, with transaction retries adding work. A healthy waiting cadence below the queue's 10-second freshness limit is worth measuring. Private waiting can have a separate cadence because it does not keep a public queue seat. Preserve immediate push wake-up, offline recovery, countdown boundary reconciliation and requeue semantics. Do not simply increase the interval beyond the lease.

3. The baseline ZIP had almost no room under either existing release budget. Its extracted bytes were 4,716,830 against 4,718,592, leaving 1,762 bytes. Its local files referenced directly by entry HTML totaled 575,132 against the 576,716.8-byte initial budget, leaving 1,584.8 bytes. The final ZIP has 4,716,907 extracted bytes, leaving 1,685 bytes. Its entry resources total 575,141 bytes, leaving 1,575.8 bytes. Both existing budgets are unchanged. These are exact file inventory arithmetic. Future code can pass TypeScript yet exceed upload budgets. Build the actual requested target before upload and compare both budgets after any optimization.

4. `useJestProductCatalog.ts:53-57` serializes independent consumable and subscription catalog reads. It already uses `withBackgroundPlatformActivity` at `JestPlayApp.tsx:253`, so it does not impose the foreground operation spinner. Loading the two independent results concurrently could reduce time to a complete shop catalog, with each failure still handled independently. It would not remove the subscription backend verification or change first-play authority. Root owns this candidate; it needs measured completion/error paths before claiming improvement.

## Stream lifecycle and recurring work

The source has a bounded, account-scoped admission design. Two active leases permit at most six live Firestore listeners per account from this handler. Each connection has one 45-second expiry timer, one 10-second heartbeat timer, and listeners for user existence, account deletion and the private ticket signal. The handler attaches no query or collection scan.

A healthy complete connection executes four document reads and one ledger write during admission, three initial document snapshot listeners, then one ledger read and one cleanup write. Firestore transaction retries, subsequent document changes, rollout-cache misses, and SDK framing are additional. These are source-level operations, not a bill. A full uninterrupted 15-minute wait nominally renews about 20 streams, with 160 read/initial-snapshot operations and 40 ledger writes before those additions. Renewal starts after a 50-millisecond client timer; actual timing depends on transport and scheduling.

The stream avoids game-state serialization. Each chunk contains only a revision UUID or null; a non-null `JSON.stringify({revision: uuid})` payload is 51 bytes before Firebase framing. Heartbeats do not mutate Firestore. Every revision wake-up prompts a separate authenticated canonical read in the client. The client remembers the last revision across renewals, so reconnect snapshots and unchanged heartbeats do not independently reread game state.

Abort, account deletion, missing user, send failure and normal expiry all stop observers and clear timers. Setup consumes the original lease. If a callback synchronously ends the stream before listener attachment returns, the newly returned unsubscribe is called. Cleanup removes only its own UUID, so a delayed cleanup cannot remove a replacement lease. Cleanup failure leaves admission occupied only until its stored expiry. The client has a 15-second heartbeat watchdog, retires the failed transport, and backs off reconnects from 500 milliseconds to 8 seconds. `useLiveRaceSignals` disposes on terminal state, changed ticket or unmount.

This audit found no unbounded listener or timer allocation in these paths. It does not establish absence of a runtime leak. Real repeated connect/abort/renewal measurements should count attach/dispose calls and pending transports, and sample heap after garbage collection across a representative series. Increasing stream lifetime to reduce ledger work would change credential, timeout and failure behavior; measure actual recurring cost before considering it.

The account existence listener also receives ordinary user document updates. Subscription synchronization writes that document on every successful sync. Removing the redundant checkout preflight would therefore reduce two kinds of work while retaining the existence listener's immediate deletion behavior. Do not remove deletion/account checks to optimize reads.

## Artifact inventory and startup interpretation

The final ZIP contains 419 files and is 2,875,267 compressed bytes. It contains 384 JavaScript files totaling 2,659,040 bytes. That file count describes the whole deferred artifact, not 384 startup requests. Major byte costs are:

| File or group | Bytes | Scope |
| --- | ---: | --- |
| Music WebM | 1,139,484 | Whole artifact; actual first-play fetch not measured |
| Firebase vendor chunk | 397,082 | Dynamic import warmed during authenticated startup |
| Jest entry chunk | 255,576 | Entry HTML preload |
| React vendor chunk | 219,007 | Entry HTML preload |
| Twelve Three.js chunks | 571,144 | Deferred game presentation modules |
| Four font files | 203,252 | CSS declarations; browser fetch depends on used glyphs/fonts |
| Race schema chunk | 108,431 | Deferred competitive feature validation |
| Sentry chunk | 90,589 | Dynamic import initialized by Jest entry |

The current initial-resource audit counts only local `src`/`href` files explicitly present in entry HTML. It excludes the HTML itself, the async external Jest SDK, CSS font and image URLs, dynamic imports and Firebase startup warmups, HTTP encoding/headers and provider/network overhead. Four fonts and three SVGs are referenced by the entry CSS. Fonts already use `font-display: swap`. The Firebase warmup starts during the startup effect and deliberately overlaps SDK initialization; its cost remains part of the actual network and CPU work a player experiences.

The bundle boundary configuration remains target-specific. Jest's audit forbids other provider SDK markers, advertising integrations, source maps and external identity providers. The supplied upload receipt records the prior audit pass. This scope did not rebuild or rerun that audit and makes no new boundary-pass claim for source subsequently changed by other agents.

For actual startup measurements, use the unpublished hosted Jest preview with a dedicated player session. Record cache state, device/CPU and network profile, render milestone, first playable input, all request successes/failures, transferred versus decoded bytes, startup dynamic imports and third-party SDK time. Alternate before/after runs at least five times per side and report median and range. The local file-byte budget is a release gate, not a first-play latency result. Do not raise the existing budgets to make an optimization pass.

## Smallest safe next steps

Root can first measure removal of one duplicate checkout preflight and concurrent catalog loading, preserving the lock-protected signed verification. The multiplayer owners can measure a slower healthy waiting watchdog within public queue lease constraints. Retain the bounded stream admission and deletion listeners while measuring actual listener churn. Bundle work should target a measured first-play or release-byte limiter; music is the largest artifact byte cost, but no audio quality reduction, content removal or speculative asset rewrite is justified by this read-only inventory alone.

## Implemented checkout follow-up

The delegated follow-up changed `purchases.ts`, `useJestPurchase.ts` and `useJestProductCatalog.ts`. Subscription checkout now publishes its fresh signed, server-verified catalog through an optional callback while holding the existing player Web Lock. The UI reuses that result, so a successful new subscription needs one SDK holdings read and one preflight synchronization before provider checkout. The distinct post-checkout entitlement verification remains. The lock helper, SKU suppression rules, signed verification, monthly grant authority and cross-tab exclusion are unchanged.

The callback updates current offers and emits `begin_checkout` only when the requested offer is present and inactive. An already-active plan, missing offer or busy lock cannot emit that event. Failure before verified catalog publication retains translated shop-load copy. Provider or entitlement failures after preflight retain their prior messages. Restored existing access and sandbox subscriptions do not report new revenue. The existing catalog refresh generation checks still reject superseded or departed-session responses.

Independent consumable and subscription catalog requests now start concurrently in the same existing background operation. Neither result publishes an unverified subscription. This removes their sequential dependency; it does not prove a particular latency improvement or alter first-play identity requirements.

All three focused suites passed, with 64 tests and zero failures. The actual hook and coordinator were exercised together with controlled external SDK/backend responses. A held signed verification proved that payment, catalog publication and checkout analytics wait for verification. It then asserted one holdings read, one preflight sync, one provider checkout and one distinct post-checkout verification. Further cases covered active holdings, missing offers, failed verification, busy lock, locale formatting, restored/sandbox revenue exclusion, concurrent catalog start and existing catalog session cleanup. These are behavioral and operation-count checks, not network latency measurements. See [checkout-units.log](checkout-units.log) and [checkout-unit-results.json](checkout-unit-results.json).

Command run from `packages/portal`:

```sh
pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath src/jest/__tests__/purchases.test.ts src/jest/__tests__/useJestPurchase.test.ts src/jest/__tests__/useJestProductCatalog.test.ts --json --outputFile=../../artifacts/performance-current-20261019/release/checkout-unit-results.json
```

Root owns compilation and any prescribed hosted verification after integrating parallel work. The required inactive Jest upload finished processing, as independently verified below. This follow-up did not change visible copy or add a provider dependency.

## Independent final upload readback

A fresh read-only `list_game_versions` call confirmed version `01a151a5-c1d5-77f8-b24e-7a6370b86a20` is `ready`, inactive, and has no processing error. Its platform-reported extracted file size is 4,716,907 bytes. The prior version `01a15052-3421-7521-9513-070facc7e3a1` remains the sole active build returned by the API. See [upload-readback.json](upload-readback.json).

Independent local checksum and ZIP central-directory reads matched the requested gate exactly: SHA-256 `23078e0758ddb8378318d9ec3f1933e23db32c34610a50c59b278b6e5b7d557a`, 419 files and 4,716,907 extracted bytes. Both byte budgets retain their original values. Only the entry HTML and its stylesheet were decompressed to enumerate their referenced resources; no compression, build, test, browser operation or performance sample ran during this final readback.
