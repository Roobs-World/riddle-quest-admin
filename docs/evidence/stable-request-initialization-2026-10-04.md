# Mounted request identity initialization — 4 October 2026

Single-player recovery and live multiplayer now initialize their mounted request identities lazily. Ordinary typing and parent updates no longer generate unused session, journal-owner, join or leave IDs. The identities retained by each mounted journey and the generation rules for actual operations are preserved.

## Reproduction and diagnosis

The browser fixture mounts the actual `PlayHostApp`, `LiveRaceGame` and `YouTubePlayableApp`. A transparent wrapper records the original `createRequestId` result and prefix, preserving its native crypto/fallback algorithm. The YouTube app is a negative control. Measurements begin after startup and the initial answer prefix.

```sh
pnpm_config_verify_deps_before_run=false STABLE_REQUEST_QUICK=1 \
  STABLE_REQUEST_TARGETS=solo,race STABLE_REQUEST_SCENARIOS=typing \
  STABLE_REQUEST_REPORT_DIR=artifacts/stable-request-initialization-2026-10-04/red-typing \
  node packages/portal/scripts/verify-stable-request-initialization-browser.mjs
```

The original development loop failed after two physical edits with four extra `pending-owner` IDs. A separate race loop failed with four extra join IDs and four leave IDs. Minimizing to one parent update, without further typing, retained the failure: two session IDs and two pending-owner IDs. Removing that update leaves the observation window empty.

Three ranked explanations were recorded: eager ref arguments repeat initialization; legitimate operations need new IDs; or StrictMode alone creates the work. Parent-only updates ruled out a necessary user operation. Production reproduced 32 extra pending-owner IDs for 32 typing transitions, and 32 join plus 32 leave IDs in the race. The local playable control generated none of these identities. Distinct remount identities passed before and after the change.

The implementation changes exactly four initializers from eager `useRef(createRequestId(...))` to lazy `useState(() => ({current: createRequestId(...)}))`. Existing read sites and stable holder identity remain unchanged. These holders were never written after initialization. No operation ID cache, callback dependency change, visible text or provider integration was added.

## Verification

The captured original and updated production surveys contain identical keys for all 582 assertions. The original fails 24 repeated-initialization assertions; all other controls pass. Updated development StrictMode and production pass every assertion. Each mount must initialize the expected identity prefixes, so missing instrumentation cannot pass silently. Remounts create distinct values. Race joins and retirement leaves each deliver once with their original mounted IDs.

| Check | Result |
| --- | --- |
| New browser coverage | 84 journeys / 1,164 assertions |
| React modes and viewports | Development StrictMode and production; 390×568, 390×844, 1280×844 |
| Input coverage | Physical typing, shortcut click, parent updates, feedback, remount and explicit submission |
| Cold draft and journal restoration regressions | 732 assertions |
| Live reconnect regressions | 708 assertions |
| Callback lifetime regressions | 1,116 assertions |
| Fixed keyboard regressions | 708 assertions |
| Total injected browser assertions | 4,428 |
| Portal unit suite | 2,727 passed in 296 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,177 declarations documented across 1,138 files |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Source stability | Independently collected 765-path input inventories and hashes match |

Native Firefox at 390×568 typed and edited `pian` in the actual race editor. A parent update preserved draft, DOM identity and focus while generating zero extra join/leave IDs. Native `o` and Enter advanced once to 1/10. Retirement delivered one leave with the original leave ID, distinct from the join ID. In the actual hosted single-player app, native typing and a parent update preserved `pian` without recreating session or pending-owner IDs; `o` and Enter delivered one guess and one completion. Seven final raw observations were parsed and asserted, with no browser errors or unhandled promises.

The two owned Firefox tabs were closed, the original blank tab preserved, and the fixture stopped with its scratch directory removed. Fixture-only teardown originally overwrote the production report; reporting now excludes serve-only sessions, and the complete production survey was rerun and independently compared afterward.

Captures, failed loops, baseline comparison, screenshots, exact owned-source diff, asserted Firefox proof and verification summary are under `artifacts/stable-request-initialization-2026-10-04`. The new regression is registered in the game browser verification chain. The probe is confined to the fixture; production `requestIds.ts` is unchanged.

These are local operation-count measurements. No measured frame-rate or live provider latency improvement is claimed. The broader improvement goal remains active.
