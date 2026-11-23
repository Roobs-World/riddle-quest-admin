# Readiness and resize callbacks follow committed game state

A suspended render could write `initialized=true` into the readiness reporter's shared ref while the committed game remained visibly uninitialized. Its existing retry callback then stopped sending readiness. During removal or sender replacement, queued timer and resize callbacks could also emit through an old sender before passive cleanup.

`useGameReadyReporter` now updates its initialization ref during commit. Readiness and resize subscriptions each receive a distinct committed ownership token. Layout cleanup revokes the old token immediately; passive setup captures the current token, and every delivery checks it. Timer cancellation and observer disconnection remain in passive cleanup. Callback replacement for readiness leaves resize observation independent. StrictMode replay gets a fresh ownership token and cannot revive old callbacks.

## Reproduction and diagnosis

The fixture mounts the actual readiness hook inside React StrictMode. A transition renders an initialized replacement alongside a suspended sibling. The visible committed game remains A and waiting. Delivering the captured active retry callback produces no readiness signal with the original source, and produces A with the fixed source. A native Retire click injects the saved callbacks from a parent's layout effect after the game DOM disappears. Original callbacks send readiness and changed dimensions through A; fixed callbacks send neither. A native Replace click similarly delivers old callbacks before passive cleanup: only the new B sender reports under the fix.

The minimal command was run against original source and exited 1: one of six checks failed because the readiness list was empty instead of `["A"]`.

```sh
pnpm_config_verify_deps_before_run=false READY_COMMIT_REACT_MODE=production READY_COMMIT_QUICK=1 READY_COMMIT_SCENARIOS=speculative READY_COMMIT_REPORT_DIR=../../artifacts/game-ready-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-game-ready-commit-browser.mjs
```

The ranked explanations were an initialization ref changed by an uncommitted render, early callback retirement, and the game actually having initialized. DOM evidence still showed waiting, while the active timer and observer remained owned. Changing only the initialization ref to a layout update made that minimal case pass. Removal/replacement controls independently exposed the passive-cleanup gap. The final original-source comparison fails 21 of 138 assertions; the final fix passes all 138 in each React mode.

An intermediate approach moved timer and observer setup into layout effects. The existing development regression caught two initial readiness sends instead of one, and a remount fixture timed out under that approach. It was replaced by commit-time ownership guards with passive resource setup. Those early results and gates are retained under `layout-setup-probe`; they are not evidence for the final implementation.

## Verification

| Check | Result |
| --- | --- |
| New committed-readiness harness, both React modes | 276 assertions passed; 42 journeys across seven scenarios and three viewports |
| Existing readiness/resize harness, both modes | 120 assertions passed |
| Prior completion-listener retirement harness, both modes | 564 assertions passed |
| Firefox suspended render, original/fixed comparison | Visible A remained waiting; original retry was suppressed, fixed retry reported A |
| Firefox removal, original/fixed comparison | Native Retire click; original sent through A after DOM removal, fixed delivered no readiness or resize messages |
| Firefox replacement | Native Replace click; only B sent readiness and dimensions; one current interval and observer remained |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Portal types and TSDoc | Passed; 25,258 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | 766 inventoried source inputs identical before and after final verification |

The existing readiness regression verifies the immediate signal, 750 ms retry cadence, stopped timers after initialization, recovery, changed viewport delivery, deduplication, independent callback replacement, and cleanup using controlled browser time and real viewport changes. The new harness adds suspended initialization, removal, replacement, committed initialization, live delivery, 32 ordinary parent updates, and remount with retained old callbacks. It is registered as `test:game-ready-commit:browser` in the game browser chain.

The new fixture holds real hook timer callbacks for deterministic delivery and injects one dimension change through a controlled `clientWidth` getter. It does not measure real timer scheduling or provider network latency. The existing harness separately verifies actual viewport dimensions and the retry schedule. Firefox's parent layout still observes one physical interval/observer before passive cleanup in both versions; the fixed ownership guards block their callbacks at that point, and subsequent cleanup releases both. The fixture uses the actual hook with a representative React parent and suspended sibling, rather than full game initialization or a live provider backend. The YouTube artifact uses incomplete English fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

Evidence: [verification summary](../../../../artifacts/game-ready-commit-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/game-ready-commit-2026-10-04/owned-source.diff), and [asserted Firefox observations](../../../../artifacts/game-ready-commit-2026-10-04/firefox-verified.json). Final source captures, original/final observations and gate logs are retained in that directory.

All three owned Firefox fixtures stopped and their exact scratch directories were removed. Their pnpm termination codes were 130, 143 and 130; serve-only output with zero automated checks is not counted as browser verification. Five owned tabs were closed across the original/final comparison, preserving the initial blank tab.
