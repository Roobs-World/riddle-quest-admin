# Physical answer keys follow the visible editor

The physical keyboard hook shared by hosted solo play and live races wrote its callback and active-state ref during rendering. A suspended replacement could therefore route P, Backspace and Enter to replacement B while owner A remained visible. A speculative inactive replacement could also suppress input to the still-active visible editor. Abandoning the replacement did not reliably restore the ref when React skipped an unchanged-state render.

The hook now updates its options in a layout effect, so native events use the committed editor. Its listener also installs and retires in a layout effect. This closes two additional gaps: a removed editor could still consume a key during its parent's layout callback, and a newly active visible editor could lose its first key before passive listener setup. Ordinary callback changes and answer edits keep the same listener. Text fields, focused controls, consumed events, composition and modifier keys retain their existing admission rules.

## Diagnosis

This production reproduction was run before the fix and failed one of ten assertions:

```sh
pnpm_config_verify_deps_before_run=false ANSWER_COMMIT_REACT_MODE=production ANSWER_COMMIT_QUICK=1 ANSWER_COMMIT_SCENARIOS=spec-callbacks ANSWER_COMMIT_REPORT_DIR=../../artifacts/answer-keyboard-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-answer-keyboard-commit-browser.mjs
```

The fixture uses actual React and the actual `useAnswerKeyboard` hook. A native button starts a transition that renders replacement B and suspends it. A remains visible and retains its original DOM identity. Native physical P, Backspace and Enter nevertheless call B's callbacks in the original code. The ranked explanations were speculative ref publication, editor remounting and event duplication. The DOM/listener controls rule out remounting; live controls receive each key once. Updating only the ref during commit fixes speculative callbacks and activity but leaves three retirement assertions failing in the 85-check probe. Moving listener setup and cleanup to commit makes that probe pass.

The final captured-original matrix fails 27 of 282 assertions. The activation case observes an active visible A with zero listeners during its parent's layout callback, dropping the injected P event. Fixed code owns one listener and accepts that event once. Both fixed React modes pass all 282 assertions each across eleven scenarios and three viewports.

## Verification

| Check | Result |
| --- | --- |
| New keyboard commit harness, both React modes | 564 assertions passed across 66 journeys |
| Existing real solo/live keyboard lifetime harness, both modes | 376 assertions passed |
| Existing native cancelled-key harness, both modes | 396 assertions passed |
| Existing rapid-answer-edit harness, both modes | 768 assertions passed |
| Firefox suspended replacement, original/fixed | Native Prepare click followed by native Backspace/Enter; visible A receives B callbacks before the fix and A callbacks after it |
| Firefox committed replacement | Native Commit click; B receives Backspace/Enter once through the same listener with no registration churn |
| Firefox removal, original/fixed | Native Retire click triggers an injected parent-layout P event; original consumes it after DOM removal, fixed has zero listeners and no action |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,265 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The new harness covers suspended callback/activity changes, an abandoned replacement, committed replacement, removal, immediate removal/deactivation/replacement/activation at commit, 32 parent updates and native text-field editing. Critical commit-window events are explicitly injected `KeyboardEvent` controls; ordinary Chromium keys and Firefox Backspace/Enter use browser input tools. The new fixture observes hook callbacks rather than a backend. Existing real-game fixtures cover the actual solo and multiplayer call sites, answer drafting, single submission, stable subscriptions, retired callbacks, composition, cancellation, native controls and rapid edits. No live-provider network or wall-clock performance claim is made.

The verifier is registered as `test:answer-keyboard-commit:browser` in the game browser chain. No visible product copy changed. Provider isolation and server-authoritative scoring, grants and identity are unchanged. YouTube used incomplete English fixture content; release-content completeness is unverified. The broader improvement goal remains active.

The first original Firefox fixture stopped with exit 143 between checks; its terminal handle and a refused local connection were verified before restarting it to finish removal verification. The replacement original and fixed fixtures stopped with exit 130. All three exact scratch directories were removed, and four owned tabs were closed while preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as verification.

Evidence: [verification summary](../../../../artifacts/answer-keyboard-commit-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/answer-keyboard-commit-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/answer-keyboard-commit-2026-10-04/firefox-verified.json). Original/final source, the isolated committed-ref probe, screenshots, observations and gate logs are retained in the artifact directory.
