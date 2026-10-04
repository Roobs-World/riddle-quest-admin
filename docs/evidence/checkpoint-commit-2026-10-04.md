# Background checkpoints preserve committed progress

The hosted solo persistence hook read a mutable render-time state ref when the page backgrounded. A suspended next-question render could therefore save question B with an empty draft while question A and `PIAN` remained visible. A suspended completion acknowledgement could prematurely clear the saved completion intent. The installed visibility callback also retained an old save adapter until passive effects ran, allowing a committed replacement's progress to be sent through the previous adapter.

Background saving now uses a committed state-and-adapter snapshot. A layout-owned token revokes saving when the game retires, before passive listener cleanup. Render-time account UID and generation remain an immediate revocation boundary: an account replacement cannot save through the previous committed adapter while its replacement is still suspended. The visibility listener keeps its registration across ordinary save-callback changes. Passive registration preserves startup restoration ordering; the checkpoint module's restore, confirmed-progress projection and rollback policies are unchanged.

## Reproduction and diagnosis

This command was run before the fix and failed one of eight assertions:

```sh
pnpm_config_verify_deps_before_run=false CHECKPOINT_COMMIT_REACT_MODE=production CHECKPOINT_COMMIT_QUICK=1 CHECKPOINT_COMMIT_SCENARIOS=spec-state CHECKPOINT_COMMIT_REPORT_DIR=../../artifacts/checkpoint-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-checkpoint-commit-browser.mjs
```

The fixture uses the actual game reducer, persistence hook and checkpoint module. A native Prepare button starts a next-question transition while a sibling suspends its commit. The DOM retains question A, its `PIAN` draft and its identity. A Background button injects a hidden-document visibility signal. Original code writes question B's empty draft through adapter A. The ranked explanations were render-time state publication, stale save-adapter ownership and checkpoint-module question handling. The module correctly projects the supplied state; the adapter supplied the speculative state.

Publishing only a committed snapshot fixes question/terminal progress and callback selection, but the corrected 60-check probe still has three account/retirement failures. The final account and lifetime guards resolve them. An early terminal fixture expectation was corrected to use the reducer's empty post-win draft while retaining its pending-win intent. Final captured-original comparisons fail 27 of 180 assertions; fixed development and production each pass all 180 across nine scenarios and three viewports.

## Verification

| Check | Result |
| --- | --- |
| New committed-checkpoint harness, both React modes | 360 assertions passed across 54 journeys |
| Existing real hosted checkpoint-work harness, both modes | 64 assertions passed |
| Existing saved-game recovery harness, both modes | 584 assertions passed |
| Existing cold-draft recovery harness, both modes | 732 assertions passed |
| Firefox captured original/fixed background save | Native Prepare and Background clicks; visible A/PIAN saves B/empty before the fix and A/PIAN after it |
| Firefox committed replacement | Native Commit and Background clicks; B saves its own question through adapter B without listener replacement |
| Firefox suspended account replacement | Visible A retains its draft; Background click produces no write through the old adapter |
| Firefox retirement | Native Retire click triggers an injected parent-layout visibility signal; removed game produces no save and its listener is subsequently removed |
| Targeted persistence units | 48 tests passed in three suites |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,273 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after final verification |

The new matrix covers suspended question and completion changes, suspended account/generation replacement, committed state and adapter changes before passive cleanup, retirement during a parent layout callback, 32 ordinary parent updates, and startup restoration. Original production code removes and reinstalls the visibility listener 32 times during the parent-update control; fixed code performs no additional registration changes. This measures subscription work rather than elapsed time.

The legacy confirmed-guess unit mock now commits queued layout work before running passive persistence. Existing recovery fixtures cover actual hosted typing, durable edits, isolated background snapshots, confirmed-row persistence, completion intent before clearing, reload/reconnect recovery and provider save failures. Visibility and critical commit-window signals are explicitly injected controls; Firefox button interactions are native. The new fixture observes saved payloads rather than a live provider store. No live network latency benchmark is claimed.

The initial documentation audit flagged one missing declaration comment. That comment was added, then final gates and all six builds were rerun; both final new browser modes and the built-artifact journeys also passed. The verifier is registered as `test:checkpoint-commit:browser` in the game browser chain. No visible product copy changed. Server-authoritative grants, identity and scoring and target isolation remain intact. YouTube uses incomplete English fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

Both owned Firefox fixture servers stopped with exit 130 and both exact scratch directories were removed. Four owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as verification.

Evidence: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/checkpoint-commit-2026-10-04/verification-summary.json), [owned source diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/checkpoint-commit-2026-10-04/owned-source.diff), and [asserted Firefox traces](/home/craig-beswetherick/Documents/riddle-quest/artifacts/checkpoint-commit-2026-10-04/firefox-verified.json). Original/final source, the isolated snapshot-only probe, screenshots, observations and initial/final gate logs are retained in the artifact directory.
