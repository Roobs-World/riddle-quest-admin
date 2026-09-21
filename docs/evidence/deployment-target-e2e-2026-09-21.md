# Additional deployment targets and E2E verification

## New live hosting targets

| Target | Production URL | Live result |
| --- | --- | --- |
| Standalone web | https://riddle-quest-web.vercel.app/ | All 7 remote files match the locally tested artifact; play, reward and reload passed |
| Installable PWA | https://riddle-quest-pwa.vercel.app/ | All 10 remote files match the locally tested artifact; play, reward, reload, Chromium installability and offline reload passed |

Both deployments used the owner's existing authenticated Vercel account. No new credentials or identity documents were required. They are direct web hosting destinations, not partner store publications. Deployment scripts stage only the audited static game and retain the provider response for reconciliation. Unique Vercel deployment URLs may be protected; live tests use the assigned public production aliases.

The PWA E2E initially reproduced a real failure: offline reload returned `net::ERR_FAILED` because the existing worker never populated its cache. The release packager now creates a complete content-versioned precache and removes obsolete app caches. The final offline checks pass locally and remotely.

## Completed checks

- `pnpm verify:all-targets`: six isolated core builds/audits, supporting unit/release checks, and all 41 injected browser tests passed (hosted 1, Jest authentication 29, Facebook 1, Reddit 1, YouTube 9). Reddit client/server packaging also passed.
- `pnpm test:release-targets:e2e`: integrity records for all 55 tracked provider targets passed, followed by **48/48 actual packaged browser flows**. These cover 44 neutral distribution ZIPs, the GameSnacks ZIP with its injected SDK, the PWA ZIP, and Netflix/Yahoo directories. Each test uses a fresh mobile browser, solves ROME, verifies the 150-coin reward, reloads and confirms Classic 2/180 and 450 coins. GameSnacks load/readiness/save and pause/resume are checked; PWA additionally requires offline reload and Chromium installability.
- `pnpm test:deployments:live`: web, PWA and Yahoo production gameplay and persistence all passed with zero external resource requests. Observed startup times are samples, not a guaranteed latency bound.
- Exact active Jest version `1.0.0-dev.20260921203831.675d13051574.7b59232b`: fresh live test passed in 34.23 seconds using the owner's existing authenticated session and the dedicated test-only App Check credential. It verified real identity/riddle/referral traffic, mobile key sizing, multiplayer start, immediate server-authoritative skip, race abandonment, coin shop and subscriptions. No paid checkout was initiated in this run. The version remains the previously submitted build; it was not replaced.
- Release interface/package tests: **12 passed**. Source-size and TSDoc checks passed. No backend runtime changes were needed.

## Retained evidence

- [Packaged game browser results](../../artifacts/release-e2e/packaged-games.json)
- [Live web game results](../../artifacts/release-e2e/live-web-games.json)
- [Web deployment and exact-byte checks](../../artifacts/release-e2e/deploy-web.json)
- [PWA deployment and exact-byte checks](../../artifacts/release-e2e/deploy-pwa.json)
- [Web screenshot](../../artifacts/release-e2e/web-live.png)
- [PWA live win screenshot](../../artifacts/release-e2e/pwa-live.png)

The release CI workflow now runs the actual packaged browser flows and retains their reports. The earlier record/ZIP check is explicitly described as integrity validation, rather than claiming it plays the game.

## Unchanged provider boundaries

Facebook's earlier unresolved upload receipt, Reddit's missing approved contract fixtures/exact-byte ingestion proof, YouTube portal certification, and Netflix partner access remain outstanding as recorded in [the deployment report](deployment-verification-2026-09-21.md). Browser checks of neutral review ZIPs do not establish provider SDK compatibility, real provider publication, contract acceptance or messaging delivery. No upload barrier was removed or bypassed in this work.

Commands and reconciliation procedures: [standalone web deployments](../standalone-web-deployments.md).
