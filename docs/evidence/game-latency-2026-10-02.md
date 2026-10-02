# Single-player and live multiplayer latency — 2026-10-02

## Implemented improvements

Live multiplayer's elapsed clock renders independently of the keyboard and riddle board. Normal racing no longer updates the full game owner every 100 ms. Countdown transitions, authoritative action deadlines, device clock changes, visibility recovery, and completion cleanup retain their existing gates.

Live command receipts and rival privacy/deletion checks share one database-read wave. Current rollout authorization overlaps initial ticket/account-deletion reads, and must succeed before any transaction mutation. Access is checked on each request; no cross-request authorization cache is introduced. Queue transaction retries reuse one validated deterministic deck within that join invocation; restored seats still skip the content query.

Ordinary Daily and Classic loads use one accepted session snapshot instead of immediately reading the same session twice. Terminal completion and entitlement rotation still fetch the replacement session. Classic's three future catalog reads run concurrently, remain bounded, and stop issuing sessions at the first missing canonical position. Failures beyond a gap cannot invalidate the contiguous buffer.

Completion's leaderboard and Classic-supply projections run concurrently after authoritative grants commit. Both settle before the response ends, and a rejected leaderboard projection does not suppress the supply projection. Purchases, progression, referral rewards, identity, live results and coins remain server-authoritative and idempotent.

The self-contained artifacts ship all 16 locale packs and fetch/evaluate only the selected local pack. This work also verifies the existing startup/content optimizations described in [initial-load evidence](initial-load-performance-2026-10-02.md) and [Jest startup evidence](jest-initial-load-performance-2026-10-02.md); those concurrent changes are not attributed solely to this latency pass.

## Controlled measurements

| Measured work | Before | After | Conditions |
| --- | ---: | ---: | --- |
| Human guess database-read phase | 800 ms | 600 ms | Fixed 200 ms per database RPC; real action engine and safe projection; seven reads retained |
| Classic's three successor catalog reads | 600 ms | 200 ms | Fixed 200 ms reads; normal callable response and session ordering |
| Completion projection phase | 650 ms | 400 ms | Independent 250 ms leaderboard and 400 ms supply delays; both awaited |
| Gameplay renders during 2.1 seconds | 23 | 2 | Injected live browser harness; desktop baseline; after verified at 1280 and 390 px |
| Session reads on ordinary Daily/Classic load | 2 | 1 | Evaluation enabled and disabled; terminal-loss rotation also tested |
| Catalog reads across two join transaction attempts | 2 | 1 | Real content validation and deterministic deck construction |

The updated human poll/guess test includes a 200 ms rollout-authorization delay within its 600 ms total. The earlier 800 ms guess baseline excludes that authorization gate; these figures must not be presented as a measured production request comparison. Network transit, Firestore commit cost, real contention and cold starts are outside the fixed-RPC measurements.

Startup measurements use five cold Chromium contexts per target, mobile 390 × 844, 4× CPU slowdown, 200 KiB/s download, 80 ms RTT, uncompressed local assets, and 300 ms injected SDK responses. YouTube uses French; Netflix/Yahoo use English. Cached compiled artifact snapshots prevent concurrent builds from changing the comparison.

| Target | Initial JavaScript before → after | Median interactive before → after | Median YouTube gameReady before → after |
| --- | ---: | ---: | ---: |
| YouTube | 1,096,676 → 324,253 bytes | 5,781 → 2,768 ms | 5,749 → 2,278 ms |
| Netflix | 1,096,037 → 323,614 bytes | 5,783 → 2,737 ms | — |
| Yahoo | 1,096,033 → 323,610 bytes | 5,835 → 2,747 ms | — |

Initial JavaScript falls about 70.4%; including the selected local pack, startup JavaScript falls about 66.3%. First paint is largely unchanged. These are controlled engineering measurements, not production time-to-play guarantees. Raw results and immutable snapshot hashes are in `artifacts/game-latency/initial-{monolithic,split}-network.json` and `startup-snapshot-manifest.json`.

## Production observation and rollout preparation

A read-only Cloud Logging query retrieved 4,042 HTTP request records from 2026-10-01 through 2026-10-02 15:32 UTC, below the 5,000-row query limit. Successful POSTs, excluding CORS OPTIONS, have these existing processing latencies:

| Endpoint | Successful POSTs | Median | p95 |
| --- | ---: | ---: | ---: |
| Current Daily | 546 | 1,099 ms | 2,788 ms |
| Current Classic | 473 | 1,586 ms | 4,438 ms |
| Classic buffer | 765 | 3,565 ms | 7,791 ms |
| Single-player guess | 132 | 1,834 ms | 6,256 ms |
| Completion | 134 | 4,307 ms | 7,482 ms |

All observed gameplay requests ran in `us-central1`. The authoritative database metadata reports `eur3`. No multiplayer HTTP requests were observed in this sample, so it cannot establish production multiplayer latency. The query retains only timestamps, service/region, HTTP method/status and latency; no player IDs, tokens, bodies or guesses. Aggregates are in `production-summary.json`.

Firebase recommends `europe-west1` for Firestore `eur3` and notes that separating function/resource locations can increase latency and billing costs. This supports a regional rollout, but does not measure its benefit for this game. [Official Firebase locations guidance](https://firebase.google.com/docs/functions/locations).

The eight solo endpoints now declare both `us-central1` and `europe-west1`. Existing endpoints are retained. The Jest-only `VITE_FIREBASE_GAMEPLAY_REGION=europe-west1` build setting selects the new region for Daily, Classic, buffer, guess, completion, hint, continue and skip. Without that setting, existing routing remains in place. Other capabilities and providers retain their own routing. Reddit browser traffic still uses same-origin `/api/*` and the existing single approved backend host.

Live join/update now declare a minimum of one warm instance in each of their two supported regions, matching the existing recorded-race policy. Deploying this adds four warm instances and associated ongoing billing. Invitation preview keeps scale-to-zero provisioning.

**No production service, database, deployment configuration or hosted artifact was changed by this latency pass.** Deploy the European solo endpoints before enabling the Jest build setting; verify App Check, all session actions, replay/idempotency, progress recovery and rollback routing before release. Real production p50/p95 improvement remains unverified until that rollout.

## Validation

- Seven focused backend suites: 183 passing tests, including rollout denial before writes, replay/authority, Daily/Classic recovery, projection failure handling, contiguous buffering and transaction retry work.
- Regional client adapter and session buffer checks: 11 passing tests.
- Playable content/save/authority and game presentation checks: 63 passing tests.
- Eight current injected browser suites: 29 passing cases across Facebook, Reddit, YouTube, standalone candidates and Jest solo input, coins, viewport, music and instructions flows.
- Real Firestore emulator transaction suites: 36 passing cases, covering live authority, invitations, penalties, privacy and rewards.
- Desktop and mobile live clock instrumentation: advancing clock and two gameplay renders per 2.1 seconds; command submission still obtains a confirmed server score.
- Dedicated live delivery/lifecycle checks cover hung joins, lost/late progress polls, command bypass, reconnect/unmount and device wall-clock changes.
- All six target production builds and artifact isolation audits pass. Portal type checking, Functions build/module-cycle checks and changed-file TSDoc/file-size checks pass.

The earlier broad browser invocation retained failures for obsolete recorded-race hub expectations, including the large hosted Jest scenario. A final hosted-only rerun still fails its retired-run storage expectation (`hosted-current-browser.log`). Current dedicated flows and migrated Facebook/Reddit suites pass; the obsolete hosted scenario is not claimed as passing. The concurrent live penalty work initially caused emulator failures while its implementation and fixtures were changing. The final real-authority browser run passes at both viewports, including hint and skip deadlines, fresh questions after skipped/exhausted attempts, replay-safe rewards and bot fallback. The final emulator rerun passes all 36 cases; results are recorded in `live-transactions.log`.

## Reproduce

```sh
pnpm --dir firebase-functions test --runInBand --runTestsByPath src/__tests__/gameplayDeploymentOptions.test.ts src/__tests__/dailyChallenge.test.ts src/__tests__/race/raceLiveLatency.test.ts src/__tests__/classicRiddleBufferLatency.test.ts src/__tests__/completeGameTransaction.test.ts src/__tests__/singlePlayerSessionTransactions.test.ts src/__tests__/race/raceCallables.test.ts
LIVE_RACE_RENDER_ONLY=1 LIVE_RACE_EXPECT_ISOLATED_CLOCK=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs
node packages/portal/scripts/measure-content-baseline.mjs
LOAD_ARTIFACT_ROOT=artifacts/game-latency/monolithic-builds LOAD_TARGETS=youtube,netflix,yahoo LOAD_DOWNLOAD_KBPS=200 node packages/portal/scripts/measure-initial-load.mjs /tmp/latency-before.json --expect-monolithic-content
# Restore normal target builds before measuring the split-content artifacts.
```

`LOAD_ARTIFACT_ROOT` must be an absolute path when running the measurement script from a different working directory. The baseline script temporarily rebuilds the three candidate artifacts as monolithic content; normal builds restore the release format. Preserve snapshots before another process rebuilds those directories.
