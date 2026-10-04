# Optional live race push failures preserve polling and the game

A failed push registration reset the connection flag but left its callback lifetime active. An imperfect adapter retaining its callbacks could subsequently mark that failed subscription connected. The live race then switched human foreground fallback polling from 500 milliseconds to five seconds even though push registration had failed. An exception from a successful subscription's cleanup also escaped React's passive effect cleanup and removed the surrounding UI.

Registration failure now revokes the callback lifetime before restoring disconnected polling. Cleanup revokes callbacks and connection state before invoking the adapter, containing any cleanup exception so the parent game can finish retirement. Successful push notifications, disconnect refresh, normal cleanup and replacement players keep their existing behavior.

## Diagnosis

The minimal original-source reproduction failed three of six checks:

```sh
pnpm_config_verify_deps_before_run=false LIVE_SIGNAL_REACT_MODE=production LIVE_SIGNAL_QUICK=1 LIVE_SIGNAL_SMOKE=1 LIVE_SIGNAL_SCENARIOS=register LIVE_SIGNAL_BASELINE_DIR=../../artifacts/live-signal-failures-2026-10-04 LIVE_SIGNAL_REPORT_DIR=../../artifacts/live-signal-failures-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-live-signal-failures-browser.mjs
```

A native Emit retained signals click caused one rejected subscription refresh, changed its connection flag to true and selected a 5,000 ms polling interval instead of 500 ms. The ranked explanations were an active callback lifetime after registration failure, an incorrect disconnected cadence calculation, and a stale React effect replay observer. Revoking the registration lifetime resolved the registration checks in production, but the 44-check intermediate probe still failed two cleanup checks: the parent disappeared and a browser error reported the injected cleanup failure. Containing that exception resolved the remaining failures.

The captured-original matrix fails 18 of 132 assertions at three viewports. Both fixed React modes pass all 132 each, covering failed registration, throwing cleanup, normal push/disconnect, replacement and ordinary retirement. Native answer submission remains usable after registration failure, and eight ordinary parent updates do not restart subscriptions.

## Verification

| Check | Result |
| --- | --- |
| New optional push failure harness, both React modes | 264 assertions passed across 30 journeys |
| Existing live callback lifetime harness, both modes | 1,116 assertions passed |
| Existing live provider retirement harness, both modes | 1,206 assertions passed |
| Existing native poll retirement harness, both modes | 114 assertions passed |
| Firefox original failed registration | Retained callbacks claim connected push and a 5,000 ms interval; no additional polls over the next 1.1 seconds |
| Firefox fixed failed registration | Rejected callbacks cannot refresh or claim connected push; 500 ms fallback delivers two polls over the next 1.1 seconds |
| Firefox fixed native answer | Input fill and Enter submit once and advance to one completed riddle |
| Firefox original/fixed cleanup failure | Native Retire removes the entire parent before the fix; afterward retirement preserves the parent with no browser error |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,274 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The fixture uses the actual LiveRaceGame, useLiveRaceSignals hook, reducer, native answer editor and polling helper. Adapter registration intentionally retains callbacks and throws; a separate scenario intentionally throws on cleanup. Emit and Retire controls are native clicks. Instrumentation exposes the existing connection reference and counts refresh admission while executing the real callbacks. Actual native polling continues to call the validated-view fixture transport. These are controlled adapter faults rather than observed production provider outages. The 500 ms versus 5,000 ms values are polling cadence, not measured remote network or end-to-end latency.

The verifier is self-contained and registered as `test:live-signal-failures:browser` in the game browser chain. No visible product copy changed. YouTube uses incomplete fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

Both owned Firefox fixture servers stopped with exit 130 and their exact scratch directories were removed. Four owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is excluded from assertion totals. Existing regression runners used their default report directories; their completed observations were copied into this pass's evidence directory alongside this pass's command logs.

Evidence: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-signal-failures-2026-10-04/verification-summary.json), [owned source diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-signal-failures-2026-10-04/owned-source.diff), and [asserted Firefox traces](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-signal-failures-2026-10-04/firefox-verified.json). Captured original/fixed and intermediate source, observations, screenshots, gate logs and source inventories are retained in the artifact directory.
