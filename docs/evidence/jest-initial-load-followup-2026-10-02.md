# Deployed Jest startup follow-up — 2026-10-02

The active uploaded Jest build was verified through the developer connector and opened in the existing registered sandbox browser session:

- Version ID: `01a0fdd1-98b5-750e-ab1c-f83cb6536155`
- Version: `1.0.0-dev.20261002181230.bde26d430c08.b0d01aba`
- Build status: ready, active since 18:12:54 UTC (19:12:54 London).
- [Launch this version](https://jest.com/g/riddle-q?versionId=01a0fdd1-98b5-750e-ab1c-f83cb6536155).

The earlier overlap changes are present: Daily, the Classic buffer, and server profile reads begin together after authentication. The first observed iframe paint was 112 ms and DOMContentLoaded 87.3 ms. Identity took 745.6 ms, Daily 707.1 ms, the current Classic read 1588.7 ms, and the future-question buffer 2784.9 ms. Current Classic began at 2852.2 ms, immediately after Daily completed at 2849.7 ms. Its response arrived at 4440.9 ms. A reload showed the same waterfall: Daily completed at 3431.5 ms, Classic began at 3444.8 ms, and returned at 5130.9 ms.

These are two observational traces with a shared browser cache and existing sandbox account. They establish the request ordering; they are not a controlled production benchmark or exact time-to-play measurements. Cross-origin resource timing restricts response detail. No account data, signed payloads, credentials, or query parameters are retained in the evidence.

## Additional code improvement

`startupRiddlePreload.ts` wraps only Jest's existing host services. Once the mandatory authoritative profile supplies the current Classic index, it prepares that issued question while Daily's launch decision is pending. If Daily is already completed, the normal Classic request consumes the matching pending response once. An available Daily remains the selected mode and never waits for Classic.

The preload is retired on startup cleanup/retry or after 30 seconds. Different locales/indexes and authoritative or token-based recovery requests bypass it and discard it. Optional preload failure uses the ordinary authority request. SDK initialization, identity, App Check, purchase recovery, mandatory balances, deletion gates, and server-side gameplay/grant decisions retain their existing order and authority. No visible strings or console settings changed.

This follow-up is verified locally and **has not been uploaded or activated**. The deployed version above remains the before-change observation. The audited 406-file Jest artifact was packaged as `/tmp/riddle-quest-jest-initial-load-followup.zip`; archive integrity passed and its SHA-256 is recorded in `artifacts/jest-initial-load-followup/package.json`.

## Controlled comparison

The reproducible browser fixture uses the actual new adapter with 200 ms for the authoritative profile, 700 ms for Daily, and 1600 ms for Classic. It begins after successful authentication/attestation, uses five fresh Chromium contexts per scenario, a 390 × 844 viewport, and identical delays for both versions. The baseline uses the previous direct host-services path.

| Launch decision | Before median | After median | Difference |
| --- | ---: | ---: | ---: |
| Daily completed, enter Classic | 2300.6 ms | 1800.3 ms | 500.3 ms faster (21.7%) |
| Daily available | 700.1 ms | 700.2 ms | Essentially unchanged |

This fixture isolates scheduling after authentication. It excludes real provider/backend variability and initial bundle downloads, so the 500 ms improvement is not a production guarantee. The trace contains one Classic request in both versions; the after version starts it before Daily finishes and never reports playable readiness before required content arrives.

## Validation

- 55 unit tests passed across the preload, startup, and session-preparation suites. They cover pending-request reuse, one-time consumption, locale/index mismatch, authoritative recovery, expiry, retired attempts, invalid profile indexes, optional failures, deletion, identity, purchase ordering, and heartbeat behavior.
- 11 injected-SDK browser checks passed against the updated production Jest artifact: guest/registered startup, restored locale/reload, delayed SDK handshake, optional social failure, pending social request, Daily unavailability, short phone preview, background product catalog, terminal deletion, and startup retry.
- Shared-workspace portal type checking passed after the implementation.
- All six production target builds and artifact isolation audits passed in a source snapshot containing this follow-up and the current shared gameplay work. The Jest audit reports 0.49 MB initial resources.
- All six initial surfaces were measured again under the existing five-run, mobile, 4× CPU, uncompressed local-asset, 300 ms injected-SDK fixture. Median FCP: Jest 88 ms, Facebook 428 ms, Reddit 160 ms, YouTube 340 ms, Netflix/Yahoo 32 ms. These are current render measurements; concurrent content/UI changes prevent attributing comparisons with older snapshots to this follow-up. Real authenticated startup remains dominated by provider/backend work, and the targets do not all load under 50 ms.

Raw traces, controlled comparisons, source hashes, and verification logs are in `artifacts/jest-initial-load-followup`.

```sh
pnpm --filter @qwordly/portal measure:jest-classic-startup --baseline /tmp/jest-classic-before.json
pnpm --filter @qwordly/portal measure:jest-classic-startup /tmp/jest-classic-after.json
pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/jest/__tests__/startupRiddlePreload.test.ts src/jest/__tests__/startup.test.ts src/jest/__tests__/startupPreparation.test.ts
```
