# Multiplayer keyboard activation and retirement

The live intro, context board, and tournament board now register Escape/Tab handling in the committed layout phase. Covered or detached dialogs yield input. Removed subscriptions immediately revoke even a previously captured listener. Ordinary callback updates continue through the existing committed Effect Event without rebuilding the subscription. Focus capture/restoration remains in its independent passive effect.

## Diagnosis

The original first-open reproduction failed 3 of 5 assertions on two runs. The visible dialog had no keyboard listener during the parent layout effect, so the first Escape was lost. Delaying the same key until after two animation frames passed all 5 assertions. A no-key control passed all 4 applicable assertions; an earlier diagnostic incorrectly retained the listener-readiness assertion when emission was disabled and is retained separately in the evidence.

The ranked hypotheses were deferred listener registration, an event preceding visible DOM, and stale callback state. Visible committed DOM contradicted the second hypothesis; the later identical key reaching the correct callback contradicted the third. Moving only registration/retirement to the layout phase fixed activation but left 3 of 51 assertions failing: an inert dialog still consumed Escape. Connected/inert admission and local listener revocation then passed 51 of 51.

The final original-source comparison failed 189 of 648 assertions across the three actual production surfaces. The repaired source passed 648 in each React mode. Firefox independently reproduced the original first-open, inert-cover, and retirement failures. It verified repaired activation, first-Tab wrapping, latest callback after four native parent updates without registration churn, inert-cover admission, and tournament retirement.

## Implementation and review

- `useRaceDialogFocus.ts`: a small layout effect installs a local, revocable native listener. It delegates to the existing Effect Event and retires before parent layout work. Escape/Tab admission requires a connected dialog outside an inert subtree.
- `raceLayoutHooks.test.ts`: the existing React mock now separates layout subscriptions from passive focus work. Existing focus/confirmation cases continue to run; 18 focused tests passed.
- `verify-race-keyboard-boundary-browser.mjs`: uses actual `RaceTo10Game`, `RaceContextBoard`, and `RaceTournamentEntry` components in StrictMode. Eight scenarios exercise first Escape, first Tab, cover/uncover, retirement, captured retired listeners, keyed replacement, and stable parent updates. Full cases use 32 native parent clicks, exact latest committed callback checks, and native forward/reverse Tab checks.
- The verifier runs in both React modes through its package command and the main browser command. The final verifier is preserved separately because scripts are outside the source inventory.

React review: no render-time callback mutation was introduced. The Effect Event retains current committed routing, effect dependencies preserve stable registration, and synchronous cleanup revokes captured listeners. The change preserves public props, current focus restoration, composition/default-prevented guards, target isolation, visible text, and server authority. Current production callers pass `quitConfirmationOpen: false`; the existing unit compatibility cases still cover the optional confirmation API.

## Verification

| Check | Result |
| --- | --- |
| New keyboard boundary verifier | 1,296 assertions, 144 journeys, zero failures |
| Live race action/focus | 684 assertions |
| Live poll retirement | 114 assertions |
| Modal keyboard boundary | 1,272 assertions |
| Modal keyboard admission | 744 assertions |
| Profile confirmation keyboard | 756 assertions |
| New and related browser assertions | 4,866, zero failures |
| Portal units | 2,756 tests across 297 suites |
| Built game browser tests | 38 tests across 8 suites |
| Portal types | Passed |
| TSDoc | 25,292 documented nodes across 1,139 files |
| Isolated artifacts and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Frozen source inventory | All 766 source inputs unchanged during final verification |

The new verifier covers three viewport sizes (390×568, 390×844, 1280×844). Injected provider replies supply capability/catalog fixtures; see the tournament fixture clarification below. Live action regressions use their existing mocked authoritative server. This evidence establishes keyboard lifecycle correctness and stable registrations, not a network latency, frame-rate, or live-provider benchmark. The YouTube build uses fixture content and does not establish release readiness.

All terminal sessions completed successfully. Both owned Firefox fixture servers stopped, their temporary directories were removed, and both owned Firefox tabs closed; the original blank tab was preserved. No owned verifier processes remained. Source snapshots and the frozen verifier matched their live files after verification.

Evidence is under `artifacts/race-keyboard-boundary-2026-10-04/`: `owned.diff`, `firefox-native.json`, `verification-summary.json`, source inventories, original/repaired observations, screenshots, and gate/build logs. This pass did not run a commit, push, or deployment. The shared checkout advanced independently during the ongoing work; its final HEAD was `d6f85ff4e` (`Capture final browser verification artifacts`). The frozen-source comparison still passed. The broader improvement goal remains active.

## Tournament fixture clarification (tab-order follow-up)

The historical tournament fixture supplied `currentPlayer: null`, although the strict standings schema permits an omitted optional score and rejects null. Its tournament cases therefore exercised the mounted board error/recovery branch. The keyboard lifetime findings and captured observations remain valid for that branch; the earlier captures are unchanged. The tab-order follow-up removed the invalid optional field and reran all 648 assertions in each React mode against healthy empty standings, with zero failures. Evidence is in `artifacts/race-tab-order-2026-10-04/race-boundary-development/` and `race-boundary-production/`.
