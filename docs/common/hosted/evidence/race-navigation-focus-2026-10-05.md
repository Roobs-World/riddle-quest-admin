# Multiplayer navigation retains later native focus

`RaceTournamentEntry` now preserves an eligible control already focused inside the current dialog when its deferred tab-selection frame runs. A player can switch destination, Tab to Close, and press Enter without the queued selection focus pulling them back to the tab. Ordinary arrow/Home selection still focuses the newly mounted selected tab.

## Diagnosis

The minimized real-component reproduction held the selection frame, used native ArrowLeft from Tournaments to Activity, then native Tab. Close became focused. Releasing the frame moved focus back to Activity. The initial reproduction failed one of five assertions twice, in about half a second per run. Waiting for the frame before Tab and omitting Tab were passing controls (nine assertions combined).

The ranked hypotheses were an unconditional queued selection frame overriding later intent, the dialog-opening focus effect running after Tab, and replacement of the Close button during the board read. Dropping only queued frame execution passed all six instrumented assertions. Close retained the same connected DOM identity, excluding replacement. A captured-source guard retaining current eligible dialog controls passed 16 assertions across early, late, and no-Tab cases; the expanded activation probe also passed.

The production change guards the existing animation-frame callback using the current selected tab's containing dialog and `document.activeElement`. An eligible focused control inside that dialog retains focus. Otherwise the selected tab receives focus as before. Effect dependencies and frame cancellation remain unchanged. No new render-time callback mutation, subscription, provider call, visible copy, scoring, economy, or persistence behavior was introduced.

## Regression harness

`verify-race-navigation-focus-browser.mjs` uses actual `RaceTournamentEntry`, validated empty tournament standings, and a null context-board result. Play exercises the existing capability-gap presentation with gameplay controls disabled. Native navigation never issues gameplay commands or records scores.

The final harness holds only the selection callback in the unminified injected artifact, identified by its `tabs.current` reference. It verifies that exactly one selection frame is pending. Other animation frames continue normally. This instrumentation distinguishes the timing boundary without copying the production guard into the assertion: outcomes are native focus and native Enter activation on the real component.

An earlier controller held all animation frames. Its Chromium comparisons passed, but Firefox's automation frame waits timed out despite issuing the native keys and reproducing the symptom. Those diagnostic results are preserved separately under `pre-frame-scope-*`. The final controller and original/repaired comparisons were rerun after scoping the held frame, and Firefox completed without timeout.

Four scenarios cover early Tab, early Tab followed by Enter after frame release, Tab after frame release, and selection without Tab. They run across Play, Activity, and Tournaments at 390×568, 390×844, and 1280×844 in both React modes: 72 journeys and 1,044 assertions. Cases additionally check 32 native parent updates without keyboard registration churn, no pending selection frame on ordinary updates, one current keyboard listener, reverse Tab, and inactive tabs remaining outside the native Tab sequence. The package command runs both modes and is included in the main browser command.

The captured original component failed 27 of 522 assertions. The frozen minimal original failed one of eight; the repaired component passed all eight. Reproduce the original from `packages/portal`:

```sh
RACE_NAV_BASELINE_DIR=../../artifacts/race-navigation-focus-2026-10-05 RACE_NAV_QUICK=1 RACE_NAV_DESTINATIONS=activity RACE_NAV_SCENARIOS=early-tab RACE_NAV_SMOKE=1 node scripts/verify-race-navigation-focus-browser.mjs
```

Firefox independently verified original focus loss and zero Close activations on Enter. It verified repaired early Tab retaining Close and Enter activating it exactly once for all three destinations, plus ordinary arrow selection focusing Activity. Browser errors, unhandled promises, gameplay commands, and score records remained empty.

## Final verification

| Check | Result |
| --- | --- |
| New navigation focus, both modes | 1,044 assertions |
| Roving Tab order, both modes | 216 assertions |
| Race keyboard activation/retirement, both modes | 1,296 assertions |
| Live race action/focus, both modes | 684 assertions |
| Combined browser assertions | 3,240, zero failures |
| Portal units | 2,756 tests across 297 suites |
| Built-game browser batch | 38 tests across eight suites |
| Portal types | Passed |
| TSDoc | 25,184 documented declarations across 1,139 files |
| Isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Source inventory | All 766 inputs unchanged during verification |

The YouTube fixture build does not establish release readiness. This pass demonstrates focus intent and input correctness; it does not provide a frame-rate or network-latency benchmark. The preceding roving-tab correction and its wider offline regressions are recorded in `race-tab-order-2026-10-04.md`.

All terminal sessions completed, owned Firefox tabs closed, and the original blank tab remained. No owned verifier processes remained. All four current fixture cache directories and both preceding tab-order fixture directories were absent at cleanup. The production, package, and final verifier snapshots matched their live files; `git diff --check` passed.

Evidence is under `artifacts/race-navigation-focus-2026-10-05/`, including minimal failures/repeat/controls, source probes, original/final observations, screenshots, Firefox proof, frozen source/verifier captures, inventories, `owned.diff`, gate/build logs, and `verification-summary.json`. No commit, push, or deployment was performed in this pass. The broader improvement goal remains active.
