# Completion receipts follow the committed question

A suspended next-question render could overwrite the completion delivery hook's outcome ref while the visible game still showed the completed question. Its valid receipt was then consumed as stale: acknowledgement, reward presentation and loss recovery were suppressed. Updating only that ref restored acknowledgement and rewards, but loss recovery still failed because the game router read the same speculative question through its mutable state ref.

The delivery hook now updates its outcome ref during commit. The router separately retains a committed outcome for completion presentation and deciding whether an acknowledged loss should request another question. Other operation state reads retain their existing behavior, and ordinary updates preserve router/listener subscriptions. Account replacement still revokes old acknowledgements during rendering; the change does not defer that isolation rule.

## Reproduction and diagnosis

The fixture reaches a terminal outcome through the actual game reducer. A React transition closes the modal and loads the next question while a sibling suspends the replacement. The committed DOM still shows question `classic_1` and its loss. A native Deliver completion click injects a schema-valid success correlated with that question's actual delivery request. With original source, the hook reports false and produces no acknowledgement, reward or next request.

This captured-source minimal command was run after the fix and still exits 1, failing six of ten checks:

```sh
pnpm_config_verify_deps_before_run=false COMPLETION_COMMIT_REACT_MODE=production COMPLETION_COMMIT_QUICK=1 COMPLETION_COMMIT_CHANNELS=local COMPLETION_COMMIT_SCENARIOS=spec-loss COMPLETION_COMMIT_BASELINE_DIR=../../artifacts/completion-outcome-commit-2026-10-04 COMPLETION_COMMIT_REPORT_DIR=../../artifacts/completion-outcome-commit-2026-10-04/red-final pnpm --dir packages/portal exec node scripts/verify-completion-outcome-commit-browser.mjs
```

The ranked explanations were a speculative delivery outcome, speculative router state preventing loss recovery, and an invalid receipt. Live controls accept the same contract. Moving only the delivery outcome update into a layout effect restores acknowledgement/reward but leaves two next-request failures. Adding the router's committed outcome snapshot makes all ten minimal checks pass. The final original-source comparison fails 60 of 282 assertions; both fixed React modes pass all 282 each.

## Verification

| Check | Result |
| --- | --- |
| New committed-completion harness, both React modes | 564 assertions passed; 60 journeys across five scenarios, two channels and three viewports |
| Prior completion-listener retirement harness, both modes | 564 assertions passed |
| Existing bridge dispatch ownership harness, both modes | 168 assertions passed |
| Existing real host completion-effects harness | 46 structured checks passed |
| Firefox original/fixed visible loss | Native Prepare and Deliver clicks; original rejected receipt, fixed acknowledged, rewarded once and requested next once through A |
| Firefox fixed replay | No additional reward or next request |
| Firefox committed next question | Native Commit click; old receipt rejected with no presentation effects |
| Firefox account replacement during suspended rendering | Old receipt still rejected before account replacement commits |
| Targeted units | 24 tests passed in four suites |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,262 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The new regression covers suspended loss and win progression, actual committed next-question replacement, immediate account revocation during a suspended replacement, 32 ordinary parent updates, and replay. The two existing unit harnesses were adapted to model committed layout effects; the suspended-render regression uses actual React rather than mocked hooks. Existing tests preserve stable completion identities, retries, StrictMode replay, synchronous acknowledgement, late receipts, canonical Continue attempt reconciliation and host account/effect isolation. The verifier is registered as `test:completion-outcome-commit:browser` in the game browser chain.

The new fixture uses the actual reducer, completion delivery, schema-validating router and message listener. Terminal setup and receipts are injected controls, rather than native answer entry or a live provider backend. Native-channel `MessageEvent` objects carry the required origin and parent fields. The host-effects harness and built-game journeys provide broader integration coverage, but no live network latency benchmark is claimed. Server authority and grant idempotency remain unchanged. YouTube uses incomplete English fixture content, so release-content completeness remains unverified. No visible product copy changed. The broader improvement goal remains active.

Both owned Firefox fixtures stopped after tab cleanup (pnpm exit 130), and both exact scratch directories were removed. Four owned tabs were closed across original/fixed checks, preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as verification.

Evidence: [verification summary](../../../../artifacts/completion-outcome-commit-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/completion-outcome-commit-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/completion-outcome-commit-2026-10-04/firefox-verified.json). Original/final source captures, the isolated delivery-only probe, observations and gate logs are retained in the same artifact directory.
