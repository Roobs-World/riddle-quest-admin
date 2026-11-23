# Suspend hidden live race clock animation — 4 October 2026

The actual two-player live game kept its elapsed-time animation interval running after the document became hidden. The original clock retained one 100 ms interval and, in the final regression's 650 ms hidden window, performed seven animation state updates. This presentation work did not contribute to hidden gameplay or server authority.

`LiveRaceElapsedTime` now owns an interval only while the document is visible. Hiding clears the interval and invalidates its callbacks. Foregrounding samples the existing monotonic clock immediately and starts one interval, so elapsed match time includes the hidden duration. Retired effects and cancelled timer generations cannot publish samples after a resume or unmount. Server observation, command delivery, penalties, and scoring continue independently.

## Verification

Artifacts are under `artifacts/live-clock-visibility-2026-10-04`; `verification-summary.json` records asserted totals and owned source hashes.

| Check | Result |
| --- | --- |
| Original actual-game reproduction | One clock animation interval remains installed after hiding |
| Final harness with original source | Seven hidden animation state updates in 650 ms, expected zero |
| New actual-app matrix | 396 checks across 18 journeys in development and production React, with Strict Mode wrappers |
| Scenarios | Repeated hide/resume, mount while hidden, and unmount while hidden |
| Viewports | 390×568, 390×844, 1280×844 |
| Updated hidden animation | Zero installed clock intervals and zero animation state updates |
| Foreground recovery | Immediate catch-up, one timer after repeated signals, and unchanged native draft |
| Retained callback ownership | Cancelled generations cannot join a resumed clock; unmounted callbacks make zero updates |
| Question-transition regression | 438 checks pass |
| Pending receipt / reconnect draft regression | 708 checks pass |
| Total injected checks | 1,542 pass |
| Portal units | 2,717 pass across 296 suites; 121 browser cases skipped in this unit run |
| Built journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube, and standalone candidate suites |
| Types / TSDoc | Passed; 25,122 documented declarations across 1,136 files |
| Target builds and audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Artifact instrumentation | Private clock and visibility probe markers absent from all six JavaScript artifacts |
| Source stability | All 763 tracked input paths unchanged throughout final builds and journey verification |

The regression renders the actual `RaceTo10Game`, with two human fixtures over an injected local transport. A build-only probe counts the real clock's sampling calls and installed intervals. Native draft typing, deletion, Enter submission, and ordinary close behavior remain on the actual UI paths. Controlled visibility events exercise animation ownership; retained browser timer callbacks exercise cancellation and disposal. The test checks continuous elapsed time against the fixture's authoritative start and verifies the subsequent native answer advances once. These are browser regressions at the actual rendering/lifecycle seam; no shallow replacement clock is used.

`test:live-clock:browser` runs both React modes and is included in the existing browser chain. `LIVE_CLOCK_BASELINE_FILE` substitutes the captured original clock component, giving a reproducible production-React red control.

## Firefox MCP

Firefox independently joined Alice and Bob at 390×568 and typed `te` through native MCP input. During **41,786 ms** of injected hidden visibility, the clock made **zero** animation state updates and retained **zero** clock intervals, while **40** background reconciliation polls continued. Foregrounding immediately sampled elapsed time, started one interval, and preserved the draft. Invoking all retained interval callbacks admitted only the current generation once. After settlement, displayed elapsed time advanced 44,300 ms over 44,248 ms of monotonic elapsed time, within display rounding and observation timing.

Native `st` and Enter then submitted exactly one `test` answer and advanced to 1/10. Native Escape sent one leave command and returned to the intro. Subsequent visibility events and retained clock callbacks made zero updates and installed no interval. No page error or unhandled promise occurred. `firefox-mcp-proof.json` records asserted raw and parsed observations. Owned tabs and the fixture server were closed; the original Firefox tab remained open.

Visibility state and retained callbacks were injected. This verifies avoided presentation work and correct lifecycle recovery, not operating-system background scheduling, measured battery savings, full frame/input latency, or production network behavior. Background authority receipts may still render confirmed state; only the dedicated clock animation is suspended. No visible copy, translation key, provider SDK, target adapter, or backend contract changed. No commit or deployment was performed. The wider improvement goal remains active.
