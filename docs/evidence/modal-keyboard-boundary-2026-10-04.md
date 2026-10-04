# Modal keyboard policy and registration commit with the UI

The normal modal's Escape listener captured its dismissal policy in a passive effect. A newly committed pending Continue or victory page could therefore still use an older unlocked policy until that effect ran. Conversely, newly unlocked dialogs could retain the old lock. The normal and recovery dialogs also registered their native listeners after commit, missing keys dispatched from parent layout callbacks during their initial activation. Normal modal lock changes repeatedly tore down and replaced the document listener.

The normal modal now publishes callback, modal kind, guess/continuation readiness, and interaction ownership in one committed ref. Both dialog listeners register and retire in layout effects. The normal listener remains stable while readiness and page state change, querying the current modal DOM and committed policy. Recovery retains its existing committed Close lock. Scroll, deferred focus work, focus return, external notice masking, and fanfare state retain their passive timing. No visible copy, public props, provider APIs, network calls, or economy authority changed.

## Reproduction and diagnosis

The harness imports actual `GameModalView` and `GameSurfaceRecovery`. A native Commit button updates modal state; the parent's layout callback immediately dispatches Escape or Tab after the child DOM commits and before passive effects. It observes Close calls, listener inventory, default prevention, visible Close controls, and focus. It does not substitute either implementation or instrument their hooks. Boundary events are injected JavaScript keyboard events; native buttons initiate the updates.

The minimal pending command ran twice before repair:

```sh
cd packages/portal
MODAL_BOUNDARY_QUICK=1 MODAL_BOUNDARY_SMOKE=1 MODAL_BOUNDARY_SCENARIOS=pending-commit MODAL_BOUNDARY_REPORT_DIR=../../artifacts/modal-keyboard-boundary-2026-10-04/minimal-repeat node scripts/verify-modal-keyboard-boundary-browser.mjs
```

Both runs produced five observations and one failure: the committed modal was pending, but Close was called. Removing the boundary event passed five controls; retaining an unlocked modal also passed five. Firefox confirmed the pending modal had committed, its Close control was hidden, and one native listener nevertheless called the new callback with `guessPending: true`.

Ranked hypotheses, shown before repair:

1. Passive listener policy is stale. A committed policy snapshot should fix lock/unlock cases while leaving initial activation gaps.
2. The key precedes DOM commit. The boundary should still expose the old Close control.
3. StrictMode leaves duplicate handlers. The inventory should show multiple live listeners.

The Firefox observation contradicted the second and third hypotheses. Publishing policy alone fixed every pending, continuation, and victory lock/unlock case. The quick run retained 14 failed assertions among 106 observations, all in activation/blocking/retirement/registration-work cases. Separating native registration into a layout effect then passed 318 normal-modal observations in each React mode.

The same activation probe was extended to recovery. Its first Escape missed the dialog in two repeated five-check runs, with three failed assertions each: no Close call, no prevention, and no registered listener at the boundary. Sending the same event after two animation frames passed all five checks. Recovery keyboard registration was then separated from its passive focus effect. The final harness against both captured originals recorded 636 observations with 108 failures.

One production run of the expanded harness reported two ordinary post-update Tab failures. The ranked alternatives were an unsettled existing focus frame, stale keyboard policy, or a canceled Tab. Waiting for the retained focus frame before ordinary navigation cleared both failures without a product-source change. Immediate parent-layout probes still run without that wait. The final original-source comparison remains red with the same 108 failures. The failed run and final observations are retained, rather than overwriting that evidence.

## Verification

| Evidence | Result |
| --- | --- |
| Committed boundary harness, development React | 636 assertions, zero failures |
| Committed boundary harness, production React | 636 assertions, zero failures |
| Canceled/composing/inert/detached key admission, both modes | 744 assertions, zero failures |
| Suspended callbacks and Close locks, both modes | 456 assertions, zero failures |
| Full-game surface recovery, both modes | 824 assertions, zero failures |
| Modal focus-chain and compiled retained-modal journeys | 18 + six passed |
| Portal unit suite | 2,756 tests in 297 suites passed |
| Built-game browser suite | 37 tests in seven suites passed |
| Types and TSDoc | Passed; 25,280 declarations across 1,139 files |
| Six builds and artifact audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Source inventory | 766 inputs unchanged throughout final verification |

The new harness runs 156 journeys: 13 scenarios × two actual dialogs × three viewports × two React modes, under StrictMode. It covers pending guess/continuation commits, a transition into Continue, victory commits, all corresponding unlocks, first Escape/Tab, interaction blocking/unblocking, retirement, and 32 ordinary parent/lock updates. Fresh native Escape and forward/reverse Tab confirm normal post-update behavior. The script is registered as `test:modal-keyboard-boundary:browser` and in `test:game-browser:playwright`, running both modes.

For 32 pending-lock updates, the captured normal modal added and removed its listener 32 times at each viewport. The fixed component performed zero adds or removes in both React modes. This is a measured reduction in listener registration work; it is not a new frame-rate, network-latency, or hardware input-latency benchmark.

Native Firefox verification separately confirmed the original pending-policy failure and initial listener gap. The fixed modal prevented dismissal at the pending boundary and handled its first committed Escape. Recovery handled its first committed Tab, wrapping to the first available control, and subsequently accepted ordinary Escape. Four native lock-update clicks kept the same single document listener with unchanged registration/removal counters.

Related full-game checks retain offline overlay priority, failed lazy download/render recovery, paid Continue/Skip/Hint authority, draft preservation, and terminal Next readiness. Compiled confirmation/focus checks retain profile delete-dialog ownership and original trigger focus. The final observation files contain 3,296 assertions; the 24 focus/compiled-modal journeys, Firefox traces, and 37 built-game tests are tracked separately.

Evidence is in `artifacts/modal-keyboard-boundary-2026-10-04`, including source snapshots and owned diff, original/probe/final observations, screenshots, the pre-settle production failure, native Firefox traces, gate/build logs, source inventories, React review, and verification summary. Three owned serve-only fixtures and two Firefox tabs were closed; their scratch directories and verifier processes were removed. The existing blank Firefox tab remains.

The broader improvement goal remains active. Existing deferred-focus behavior was preserved in this pass; its interaction with native text-field autofocus remains a separate candidate for investigation.
