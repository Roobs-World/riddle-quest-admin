# Offline alert keyboard and focus lifecycle

The offline alert now installs and retires its capture guards in the committed layout phase. Disconnect immediately owns focus and gameplay keys; reconnect immediately releases them. A removed guard cannot cancel a later key even if its callback was captured before retirement. Queued focus work also checks its current connected alert and local lifetime.

## Diagnosis

The investigation first checked competition between ordinary game modals and multiplayer. The current `GameSurfaceBoundary` removes hidden children, and `GameFrameApp` marks the ordinary modal invisible while multiplayer is open. That path did not justify a change.

The actual offline hook registered its key/focus guards in a passive effect. A minimized reconnect/Tab run against the real `PlayHostApp` failed 3 of 6 assertions: the alert was gone, but its capture guards remained and cancelled Tab during parent layout work. Two runs after excluding the independent music-unlock listener produced the same result. Delaying the identical key until two animation frames passed all 6 assertions; omitting the key passed all 4 applicable assertions.

The frozen final verifier retained this distinction: two original runs failed 3 of 6; repaired, delayed-key, and omitted-key runs passed. This command, run from `packages/portal`, completed in 0.68 seconds with exit 1 and the expected 3 assertion failures:

```sh
OFFLINE_BOUNDARY_BASELINE_DIR=../../artifacts/offline-keyboard-boundary-2026-10-04 OFFLINE_BOUNDARY_QUICK=1 OFFLINE_BOUNDARY_SURFACES=game OFFLINE_BOUNDARY_SCENARIOS=reconnect OFFLINE_BOUNDARY_KEYS=Tab OFFLINE_BOUNDARY_SMOKE=1 OFFLINE_BOUNDARY_REPORT_DIR=../../artifacts/offline-keyboard-boundary-2026-10-04/final-red node scripts/verify-offline-keyboard-boundary-browser.mjs
```

The ranked hypotheses were deferred guard cleanup, a still-visible alert, and another capture listener claiming Tab. The committed DOM showed the alert was removed; excluding the music listener retained the failure. Changing only the effect phase passed ordinary disconnect/reconnect but left 1 of 19 assertions failing when directly invoking a captured retired listener. A local revocation flag plus current-ref/connected-DOM admission fixed that case; the focused solo/Settings run passed 38 of 38.

## Change and regression seam

- `useOfflineDialog.ts` uses `useLayoutEffect` for its existing subscription/focus lifetime. Cleanup revokes the local lifetime before cancelling the frame, removing both native capture listeners, and restoring the connected prior focus target.
- Both native handlers and deferred focus work check the exact current connected alert. No render-time mutations, callback refs, extra subscriptions, or new state were added. The dependency list and existing offline key policy remain unchanged.
- `verify-offline-keyboard-boundary-browser.mjs` uses the real hosted game, fake authoritative host services, actual game/Settings/multiplayer intro surfaces, and native browser input. It observes capture registrations, supplies real online/offline browser events, and emits the boundary event after the committed child DOM but before passive effects. It preserves a `PI` draft and verifies admitted edits after reconnect, with no unintended authoritative guesses, completions, or coin spends.
- Three scenarios cover disconnect, reconnect, and direct invocation of the captured retired guard. Six inputs cover Tab, Escape, Enter, Backspace, a letter, and a focus event. Tab cases also perform 32 native parent updates and forward/reverse native navigation without registration churn.
- The new package command runs both React modes and is included in the main browser command. Visible game copy, adapters, persistence, scoring, and economy behavior were not changed.

## Evidence

The repaired final verifier passed 1,719 assertions per React mode: 3,438 total over 324 journeys at 390×568, 390×844, and 1280×844. The captured original hook failed 483 of 1,719 assertions. These include missed initial keyboard/focus ownership, retained capture subscriptions after reconnect, captured retired callbacks, and lost admitted draft edits.

Firefox independently reproduced the original first-disconnect and reconnect/Tab gaps. It verified repaired first-Tab ownership, native forward/reverse Tab confinement, Escape retention while offline, immediate guard removal on multiplayer reconnect, ordinary Escape returning to interactive solo play, and a fresh letter producing a saved `P` draft without submitting, completing, or spending.

Both owned Firefox tabs closed and both fixture servers stopped; the original blank tab was preserved. Their scratch directories were removed. The final offline verifier and its owned servers had no remaining processes.

All six isolated builds and audits passed (Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo). The YouTube fixture build does not establish release readiness. Built-game browser validation passed 38 tests across 8 suites in two invocations. The general gates passed 2,756 unit tests across 297 suites, portal types, and the TSDoc audit (25,179 declarations across 1,139 files).

Related verifiers also passed in both React modes:

| Check | Assertions |
| --- | ---: |
| Offline keyboard/focus boundary | 3,438 |
| Optional interactive surface recovery | 824 |
| Multiplayer keyboard boundary | 1,296 |
| Modal keyboard boundary | 1,272 |
| Live match action/focus | 684 |
| Total, zero failures | 7,514 |

The recovery checks exercise the actual offline cover/reconnect path over failed modal and multiplayer code; live action checks use two players and a validated mocked authoritative server. Every owned terminal session completed successfully, all owned verifier processes exited, and final source/package/verifier snapshots matched. The last 766-file comparison remained unchanged from the gate recheck.

The initial 766-file frozen inventory detected independent changes to two authentication browser test files. All runtime/build inputs and the owned production/package/verifier snapshots remained unchanged. The unit, type, and documentation gates were rerun against the updated tests; all 766 inputs remained unchanged during that final recheck. These independently edited authentication tests were preserved.

Evidence is under `artifacts/offline-keyboard-boundary-2026-10-04/`: original/repaired observations, screenshots, Firefox proof, source inventories, captured source, the final verifier snapshot, and gate/build logs. Early broader diagnostic runs that omitted the multiplayer harness rollout timed out at the missing Multiplayer button; their partial observations are retained and excluded from final passing totals.

The initial package capture also preceded an independent addition of the achievement milestone suite to `test:youtube:playwright`. That registration was preserved. `owned.diff` uses the explicitly reconstructed `package.owned-base.txt` to isolate only this pass's two browser-command changes; `package.before.txt` retains the unmodified original capture and `independent-package-change.json` records the distinction.

This pass did not commit, push, or deploy. The broader improvement goal remains active. The evidence establishes keyboard/focus lifecycle correctness and stable capture registrations, without claiming a network latency or frame-rate benchmark.
