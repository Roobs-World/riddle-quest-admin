# Deployed gameplay latency follow-up — 2026-10-02

## Deployment and routing

All eight solo callable endpoints were active in both `us-central1` and `europe-west1` when inspected. The solo endpoints had no reserved minimum instances. The live join and update endpoints had one minimum instance per region. See `artifacts/game-latency/deployed/functions.json` and `functions-after-preflight.json`.

The inspected, version-pinned Jest artifact was `1.0.0-dev.20261002181230.bde26d430c08.b0d01aba`, built from `bde26d430c08c6e136431fb236d498b9a1f18a75`. Its configuration left `gameplayRegion` unset and therefore used the US endpoint for solo gameplay. The downloaded public artifact and hash manifest are in `artifacts/game-latency/deployed/published/`. This inspection does not establish the version selected by every unversioned game launch.

The source now defaults Jest solo gameplay to the already deployed European endpoints, with an explicit `VITE_FIREBASE_GAMEPLAY_REGION=europe-west1` in the Jest build configuration. Other target defaults and the account/purchase endpoint region are preserved. The explicit US gameplay setting remains a rollback option. These source changes were included in main commit `f0d5dec7`; this follow-up did not publish a new client artifact.

## Observed latency

- European live updates on revision `updateliverace-00004-ces`: 1,132 successful POST requests, median 149 ms and p95 225 ms in the inspected window beginning 18:14 UTC. These are server request durations, not input-to-display latency. Polling intervals and the browser network remain additional costs. See `http-requests-latest.json`.
- A Jest identity request took 16.317 seconds. Its corresponding new-instance startup to successful TCP probe took 14.266 seconds. Later requests were shorter. This demonstrates an observed startup delay; it does not establish typical player latency. See `identity-http.json` and `identity-startup-events.json`.
- Cold OPTIONS probes reached all eight European solo endpoints successfully, with observed request times of roughly 5–8 seconds. Some US probes took roughly 12–14 seconds. OPTIONS probes verify reachability and CORS; they are not gameplay benchmarks. See `cors-probes.json`.

The production log samples include test traffic and do not provide a controlled before/after comparison. Host, database, authentication, startup, polling and browser latency should be measured separately when comparing alternative hosting.

## Protected European gameplay compatibility

An owned browser test temporarily redirected the eight solo endpoint URLs to their deployed European equivalents while retaining the normal signed-in Firebase authentication and App Check flow. A Classic answer, completion and refill succeeded with server HTTP 200 responses. The redirect setup produced three POST attempts per endpoint, so these timings are not a clean regional benchmark. The reward was granted once: 75 coins, with the displayed wallet changing from 11,115 to 11,190. The temporary network interception was disabled and the owned tab closed after verification.

Evidence: `artifacts/game-latency/deployed/europe-solo-signed-test.json` and `europe-solo-reward.jpg`.

## Cost decision

The proposed minimum-instance setting for all eight solo endpoints in two regions was not deployed. Firebase's CLI stopped the deployment at its minimum-bill acknowledgement gate before uploading the change. The user subsequently chose: “Keep current idle costs; leave warming undeployed.” The proposal was removed from the working source and reverted on the managed candidate branch in commit `b740a370`. No additional reserved capacity or DigitalOcean resources were created.

## Verification and remaining release limits

The managed candidate combined the published source with main commit `c79050f3` and preserved both the existing race recovery behavior and the incoming completion callback.

- Backend verification on Node 22: 126 suites, 1,532 tests passed; build, types and lint passed.
- Core: 32 suites, 297 tests passed with 100% configured coverage.
- Portal coverage: 261 suites, 2,194 tests passed and all configured coverage thresholds passed. Fifteen browser-only suites / 115 tests were skipped by that unit-test configuration.
- All six required isolated target artifacts built successfully, including provider-boundary and locale checks. The additional GameSnacks artifact also built.
- Injected live race browser checks passed at desktop and mobile widths, including opponent progress, completion, bot fallback and navigation.
- Nine targeted Jest authentication/startup/solo gameplay browser cases passed. This was a selected subset, not the complete browser suite.

The full production release gate remains unsuccessful: backend coverage was 69.02% statements against 71%, 71.87% lines against 72%, and race-engine branch coverage was 99.34% against 100%. A separate full Jest browser attempt passed 21 cases and failed an older recorded-race expectation. No thresholds were reduced and no new client was uploaded by this follow-up.

The managed candidate remains attached at `/home/craig-beswetherick/.codex/worktrees/gameplay-region-latency/riddle-quest`, branch `codex/jest-gameplay-region-latency`. Subsequent changes in the shared main checkout need their own verification.

## Hosting comparison

A persistent service can share warm runtime state, database connections and caches across gameplay routes. It can also support a future WebSocket push transport, which would reduce opponent-update polling delay. These benefits follow from the service architecture and require implementation and load testing.

DigitalOcean currently lists a 1 GiB basic Droplet at US$6/month and 1 GiB App Platform services at US$10/month fixed or US$12/month with manual scaling. These are compute examples, not equivalent replacements for sixteen independently scaling regional functions. Database, cross-provider transfer, backups and redundancy may add cost. App Platform inactivity sleep must be disabled if maintaining a warm service is the goal.

Primary references: [Droplet pricing](https://www.digitalocean.com/pricing/droplets), [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/), [App Platform limits](https://docs.digitalocean.com/products/app-platform/details/limits/).

A consolidated Google Cloud Run service is also worth comparing because it can share a minimum-instance pool across gameplay routes while staying in Google infrastructure alongside Firestore. It supports WebSockets, with connection timeouts and multi-instance synchronization requirements. See [minimum instances](https://docs.cloud.google.com/run/docs/configuring/min-instances) and [WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets).

The Reddit browser and Devvit gateway must retain the approved same-origin/Firebase-host boundary under the current repository contract. A direct DigitalOcean route is not an allowed drop-in change for Reddit. YouTube, Netflix and Yahoo artifacts remain self-contained.
