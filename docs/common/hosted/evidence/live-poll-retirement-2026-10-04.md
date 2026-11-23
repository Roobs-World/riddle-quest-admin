# Retired multiplayer races stop polling timers

A race's polling callback could remove or replace its own game through a synchronous transport callback. Cleanup cleared the timeout that had already fired. The callback then resumed and scheduled another timeout after its effect had retired. Network delivery already rejected inactive owners, but the orphan timer kept waking the browser every 500 milliseconds.

The polling effect now has a local lifetime flag. Cleanup revokes it before clearing the timeout. Both timeout execution and rescheduling check that flag, the active owner and the closed-game flag. A replacement race keeps its independently owned timer and can submit answers normally.

## Diagnosis

The minimal original-source reproduction failed two of six checks: one timeout remained after removal and it fired twice over the next 1.1 seconds. The ranked explanations were rescheduling after reentrant retirement, cleanup cancelling the wrong timeout, and a replacement owner accounting for the remaining timeout. The timer instrumentation tags each native timeout with its owner and removes fired IDs before invoking the actual callback. It identifies an Alice-owned timeout allocated after Alice's cleanup, including when Bob has a separate active timer.

```sh
pnpm_config_verify_deps_before_run=false LIVE_POLL_REACT_MODE=production LIVE_POLL_QUICK=1 LIVE_POLL_SCENARIOS=retire LIVE_POLL_BASELINE_DIR=../../artifacts/live-poll-retirement-2026-10-04 LIVE_POLL_REPORT_DIR=../../artifacts/live-poll-retirement-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-live-poll-retirement-browser.mjs
```

The complete captured-original matrix fails 12 of 57 assertions across removal, replacement and stable gameplay at three viewports. Both fixed React modes pass all 57 assertions each. The replacement and stable controls submit `piano` through native input and advance the actual race UI to one completed riddle.

## Verification

| Check | Result |
| --- | --- |
| New native polling harness, both React modes | 114 assertions passed across 18 journeys |
| Existing live callback lifetime harness, both modes | 1,116 assertions passed |
| Existing live provider retirement harness, both modes | 1,206 assertions passed |
| Existing solo/live keyboard lifetime harness, both modes | 376 assertions passed |
| Firefox original removal | Native Arm click; one retired Alice timeout remains and fires twice over 1.1 seconds |
| Firefox fixed removal | Native Arm click; zero Alice timeouts and zero further Alice ticks over 1.1 seconds |
| Firefox fixed replacement | Zero Alice timeouts/ticks, one Bob timeout; native input fill and Enter advance Bob exactly once |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,274 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The fixture uses the actual LiveRaceGame, reducer, input and polling effects under React StrictMode. Its injected transport synchronously removes or replaces the game with React `flushSync` when a real timer delivers a poll after a native Arm click. Native timers are wrapped only to count allocations, pending owner IDs and callbacks; callbacks are never manually replayed. The transport supplies validated authoritative fixture views rather than a remote service. Leave deliveries retain one idempotency identity. Browser errors and unhandled promises are checked separately. This demonstrates timer lifetime and avoidable browser wakeups; it does not measure production network latency or battery use.

The verifier is registered as `test:live-poll-retirement:browser` in the game browser chain. No visible product copy changed. The YouTube artifact uses incomplete fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

The first unit invocation hit sandbox `EPERM` errors opening loopback listeners in Reddit redirect tests. The unchanged suite passed with loopback access allowed; both logs are retained. Both owned Firefox fixture servers stopped with exit 130, their exact scratch directories were removed, and all three owned tabs were closed while preserving the original blank tab. Serve-only shutdown output with zero automated checks is excluded from assertion totals.

Evidence: [verification summary](../../../../artifacts/live-poll-retirement-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/live-poll-retirement-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/live-poll-retirement-2026-10-04/firefox-verified.json). Captured source, observations, screenshots, source inventories and gate logs are retained in the artifact directory.
