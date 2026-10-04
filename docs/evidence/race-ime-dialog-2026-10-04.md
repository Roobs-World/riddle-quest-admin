# Preserve multiplayer matches during IME boundary keys — 4 October 2026

The actual two-player live game sent an authoritative `leave` request when a native editor composition delivered Escape with `keyCode: 229` and `isComposing: false`. The answer editor already recognized this IME boundary, but the bubbling document-level race dialog listener did not. This lost a live match while the player was using their device keyboard. The same missing guard also allowed the dialog focus trap to consume an IME Tab boundary at its focus edge.

`useRaceDialogFocus` now leaves keys marked 229 with the editor, alongside its existing composition and previously handled event guards. Ordinary Escape continues to send one leave request and return to the multiplayer intro. Ordinary Tab still moves focus. Draft editing, material command delivery, target adapters, and economy authority are unchanged.

## Evidence

Artifacts are in `artifacts/race-ime-dialog-2026-10-04`. `verification-summary.json` records asserted totals and owned source hashes.

| Verification | Result |
| --- | --- |
| Original actual-app browser control | IME Escape sent one unintended leave request, expected zero |
| Final harness with original source substituted | Same failure in production React |
| Original hook regression | Two failures: Escape closes; Tab consumes the key |
| Full portal units | 2,712 cases pass in 296 suites; 121 browser cases skipped in this unit run |
| New actual-app browser matrix | 348 checks across 30 journeys, development and production React, Strict Mode wrappers |
| New scenarios | Escape 229, Tab 229, reverse Tab 229, explicitly composing Escape, ordinary Escape |
| Viewports | 390×568, 390×844, 1280×844 |
| Question-transition regression | 438 checks pass |
| Pending-receipt and reconnect draft regression | 708 checks pass |
| Total injected checks | 1,494 pass |
| Built journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube, and standalone candidate suites |
| Types / TSDoc | Passed; 25,113 documented declarations across 1,136 files |
| Target builds and audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Source stability | All 763 source-input paths unchanged through final build and journey verification |

The browser regression renders the actual `RaceTo10Game` and uses two human fixtures over a local injected multiplayer transport. It verifies that an IME key sends no leave command, preserves focus and the draft, commits Japanese text once, allows native Backspace and typing, and submits only an explicit subsequent answer. The hook cases exercise the focus trap at its edge. `test:race-ime-dialog:browser` runs both React modes and is included in the existing browser chain. `RACE_IME_DIALOG_BASELINE_FILE` substitutes the captured original hook for a reproducible red control.

Firefox MCP independently joined Alice and Bob at 390×568, typed a native draft, delivered an injected Escape-229 composition boundary, and confirmed no consumed event, lost focus, leave request, or browser error. A settled composition populated the same answer once. Native Backspace, typing, and Enter subsequently advanced two questions with exactly two `test` guesses. A final native Escape sent one leave request and returned to the multiplayer intro. `firefox-mcp-proof.json` contains asserted raw and parsed observations. Owned tabs and the fixture server were closed; the original Firefox tab remained open.

One browser fixture assertion initially expected Escape to call the outer close callback. The current game instead returns to the multiplayer intro after an acknowledged leave. The fixture was corrected to assert this existing behavior and rerun successfully. This changed no product behavior.

DOM composition events were injected; joins, typing, Backspace, Enter, and ordinary Escape used native Firefox MCP interaction. This does not certify an operating-system IME or measure production network latency. No visible copy, translation key, provider SDK, or backend contract changed. No commit or deployment was performed. The wider improvement goal remains active.
