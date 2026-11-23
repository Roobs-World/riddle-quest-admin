# Multiplayer roving tabs and dialog focus

The multiplayer focus loop now excludes controls with a negative `tabIndex`. Activity and Play can therefore wrap Tab/Shift+Tab between the selected navigation tab and Close while leaving inactive tabs available to arrow-key navigation.

## Diagnosis

The actual `RaceTournamentEntry` Activity destination reproduced native Tab escaping to a button outside the dialog. Its selected Activity button was focused and had `tabIndex=0`; inactive Play and Tournaments had `tabIndex=-1`. The focus trap's `button:not([disabled])` selector included those inactive buttons and treated Tournaments as its last control even though the browser skipped it.

The minimized real-component run failed 1 of 4 assertions on two runs (about half a second each). A diagnostic control disabling the already-skipped tabs passed all four. Ranked hypotheses were a mismatch with the native Tab sequence, failure of arrow-key selection to focus Activity, and the browser ignoring the trap. The selected-tab assertion passed, and removing skipped candidates restored trapping, supporting the first hypothesis.

The production change adds one `tabIndex >= 0` filter to the existing candidate list in `useRaceDialogFocus`. The existing composition/cancelled-event guards, connected/inert admission, committed listener lifetime, and focus restoration remain intact. The transparent native answer input retains its ordinary nonnegative tab index; it was not removed from the sequence. No visible text, target API, scoring, economy, or persistence behavior changed.

The existing unit adapter's `TestElement` now supplies the ordinary default `tabIndex=0`; all 18 existing focused layout-hook tests passed. The new verifier runs both React modes through its own package command and the main browser command.

## Fixture validation

The first broader probe supplied `currentPlayer: null` for empty tournament standings. The strict schema permits an omitted score, so this correctly exposed Retry and invalidated the probe's assumption that the selected tab was last. The fixture now omits that optional field and explicitly verifies healthy tournament/Activity reads. With validated empty standings, the focused run passed 30 assertions; the original hook failed four, while Tournaments acted as a passing control.

The existing `verify-race-keyboard-boundary-browser.mjs` had the same invalid fixture field and was corrected to omit it. Its complete keyboard-lifetime checks were rerun against the healthy board. Historical captures remain unchanged to preserve their original evidence; the earlier keyboard-boundary report records this clarification.

## Final regression and Firefox

The frozen `verify-race-tab-order-browser.mjs` exercises actual arrow/Home destination selection and native forward/reverse Tab over Play, Activity, and Tournaments at 390×568, 390×844, and 1280×844. It checks skipped-tab attributes, healthy read presentation, 32 native parent updates without subscription churn, one current keyboard listener, and no gameplay commands, score records, or close actions.

Both React modes passed 108 assertions each (216 total over 18 journeys). The captured original focus hook failed 12 of 108. The frozen minimal Activity reproduction failed 1 of 5 with the original hook and passed all five with the repair; its extra assertion checks the validated board presentation.

From `packages/portal`:

```sh
RACE_TAB_BASELINE_DIR=../../artifacts/race-tab-order-2026-10-04 RACE_TAB_QUICK=1 RACE_TAB_DESTINATIONS=activity RACE_TAB_SMOKE=1 RACE_TAB_REPORT_DIR=../../artifacts/race-tab-order-2026-10-04/final-minimal-original node scripts/verify-race-tab-order-browser.mjs
```

Firefox independently reproduced original forward Tab reaching the outside button. It verified repaired Activity and Play wrapping in both directions, selected tabs retaining index zero, inactive tabs retaining negative indices, and no commands/records/closes or browser errors.

All six isolated artifacts and audits passed: Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo. The YouTube fixture does not establish release readiness. General gates passed 2,756 unit tests across 297 suites, portal types, and TSDoc (25,181 declarations across 1,139 files). The rebuilt-game browser batch passed all 38 tests across eight suites.

All 766 source inputs remained frozen during verification, and the production/test/package and both browser-verifier snapshots matched their live files. Both owned Firefox tabs closed and the original blank tab remained; both fixture servers stopped. Evidence is under `artifacts/race-tab-order-2026-10-04/`, including failures, controls, original/final observations, screenshots, Firefox proof, captured source, `owned.diff`, inventories, and gate/build logs. This pass did not commit, push, or deploy. The broader improvement goal remains active; this evidence concerns keyboard navigation rather than a network latency or frame-rate benchmark.

## Related regression completion

| Check | Assertions |
| --- | ---: |
| Roving tab order, both React modes | 216 |
| Corrected race keyboard boundary, both modes | 1,296 |
| Live race action and focus, both modes | 684 |
| Offline cover/reconnect keyboard boundary, both modes | 3,438 |
| Total | 5,634 |

All observations matched their expectations. All terminal processes completed; no owned verifier process remained. Both Firefox scratch directories were absent, and Firefox retained only its original blank tab. The final inventory matched all 766 frozen inputs, and all five source/verifier snapshots matched the live files. `verification-summary.json` records the final results.
