# Profile confirmation dismissal restores focus during its commit

`ProfileModalPage` now returns focus to its Delete trigger during the confirmation's closing commit. Subsequent native Tab reaches the outer Close button, Enter activates Close, and rapid confirmation reopen keeps focus on its safe Cancel action. Dismissal no longer schedules a delayed trigger-focus frame.

## Diagnosis

The real `GameModalView` and registered Profile reproduced two failures among six assertions on two minimized runs, each taking about 0.6–0.7 seconds. Holding only the dismissal restoration frame, dismissing with native Escape, and pressing native Tab let focus leave the outer dialog. Releasing the queued frame then pulled focus back to Delete. Waiting for restoration before Tab and omitting Tab passed 11 initial control assertions.

The ranked hypotheses were a gap caused by deferred restoration, a missing outer keyboard listener, and replacement of the controls during refresh. Instrumentation found one current outer listener and the same connected Profile/dialog controls before the subsequent native input. Dropping only the restoration frame left the initial focus escape (one failure among eight assertions). A deferred guard retaining eligible controls inside the dialog left both failures, because the earlier Tab had already escaped the dialog. A captured-source probe restoring focus during the closing commit passed all 23 assertions across early, late, and no-Tab cases. The expanded activation/reopen/retirement probe passed all 64 assertions.

Firefox independently reproduced the original sequence. Focus was on `BODY` immediately after dismissal, with one restoration frame and one outer keyboard listener. Native Tab moved outside Profile. The queued callback returned focus to Delete, and native Enter reopened the confirmation instead of closing Profile. No deletion callback ran.

## Implementation and regression

The dismissal handler records its restoration intent in a ref and closes the confirmation. A layout effect consumes that intent only after the closed state commits, clears it, and focuses the trigger with `preventScroll`. Initial mounting and confirmed account deletion do not authorize this restoration. No timer, frame, new public prop, provider call, server-authority change, or visible text was added. Existing Escape/Tab cancellation and composition guards remain intact.

The intent ref is written in the event handler and consumed after commit; it is not read to change rendering. StrictMode replay cannot repeat a consumed restoration. Unmounting retires the page without a queued callback. The regression crosses the actual modal/page interface rather than mocking React's focus behavior; existing server-rendered Profile checks remain unchanged.

`verify-profile-dismiss-focus-browser.mjs` exercises native Escape and native Cancel clicks, each with six subsequent actions: early Tab, early Tab followed by Enter, Tab after frame release, no later input, rapid reopen, and outer Escape. It runs three viewport sizes (390×568, 390×844, 1280×844) in both React modes, for 72 journeys and 948 assertions. It additionally checks committed trigger focus before delayed work, control identity, current keyboard ownership, exact Close counts, 32 native game updates preserving focus and subscription registration, confirmation lifetime, and zero deletion calls/errors/unhandled promises.

The injected unminified fixture holds only the original trigger-restoration callback, identified by its `deleteTriggerRef.current` reference. Browser and unrelated modal animation frames continue normally. The repaired page has no such queued callback; its focus return is observed before any held restoration can run. The assertions check real native focus and activation outcomes. The verifier is registered in both React modes and in the main browser command.

The captured original recorded 90 failures among 474 assertions. The final minimal comparison failed three of 11 with the original and passed all 11 with the repair. Its extra committed-focus assertion explicitly covers the gap before frame release, whereas the initial no-Tab control checked focus after restoration. From `packages/portal`, reproduce the original:

```sh
PROFILE_RESTORE_BASELINE_DIR=../../artifacts/profile-dismiss-focus-2026-10-05 PROFILE_RESTORE_QUICK=1 PROFILE_RESTORE_METHODS=escape PROFILE_RESTORE_SCENARIOS=early-tab PROFILE_RESTORE_SMOKE=1 node scripts/verify-profile-dismiss-focus-browser.mjs
```

Firefox verified repaired native Escape returning focus immediately with zero pending restoration frames; Tab reaching Close and retaining it; Enter closing Profile exactly once and returning focus to the game trigger. Native Enter on Cancel also returned focus immediately, and a rapid native reopen kept its Cancel button focused after frame release. Subsequent nested/outer Escape restored the game trigger. All Firefox observations recorded zero account-deletion callbacks and no browser or promise errors.

## Final verification

| Check | Result |
| --- | --- |
| New profile dismissal, both React modes | 948 assertions |
| Confirmation key ownership, both modes | 756 assertions |
| Modal editor/caret/focus, both modes | 384 assertions |
| Modal keyboard activation/retirement, both modes | 1,272 assertions |
| Modal key admission, both modes | 744 assertions |
| Combined browser assertions | 4,104, zero failures |
| Portal units | 2,756 tests across 297 suites |
| Built-game browser batch | 38 tests across eight suites |
| Portal types | Passed |
| TSDoc | 25,185 documented declarations across 1,139 files |
| Isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Source inventory | All 766 inputs unchanged during verification |

The YouTube fixture build does not establish release readiness. The focus-order evidence proves removal of deferred restoration from this interaction; no network-latency or frame-rate benchmark is claimed. No locale keys changed.

All terminal sessions completed. Owned Firefox tabs closed and the original blank tab remained. Both fixture directories in the workspace cache were removed, and no owned profile/modal verifier process remained. The production/package/verifier captures and all four related verifier snapshots matched their live files. `git diff --check` passed.

Evidence is under `artifacts/profile-dismiss-focus-2026-10-05/`: original/repaired observations, minimal failures/repeat/controls, captured source probes, screenshots, Firefox proof, frozen inputs and verifier snapshots, `owned.diff`, gate/build logs, and `verification-summary.json`. No commit, push, or deployment was performed in this pass. The broader improvement goal remains active.
