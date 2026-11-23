# Game bridge listeners follow committed ownership

A game removed from React could still process a completion receipt during its parent's layout effect, before passive cleanup removed its message listeners. For a loss, that receipt acknowledged and rewarded the retired game and requested another question. A receipt during callback replacement used the previous router. Initial synchronous completion replies could also arrive before passive listener setup and wait for delivery retry.

`useGameMessageListener` now installs and retires both validated channels in `useLayoutEffect`. The listener is ready before passive completion delivery runs. Removal disables its retained callbacks and detaches both channels during commit. Replacement installs the current router before the parent's layout callback. Schema validation, native origin/source checks and asynchronous error ownership remain in the existing routing path.

## Reproduction and diagnosis

The fixture uses the actual game reducer to reach a terminal loss, together with `useCompletionDelivery`, `useGameMessageRouter` and `useGameMessageListener`. Removing the game triggers a parent's layout effect that injects a correlated, schema-valid completion receipt. The original code records removed DOM with two old listeners still attached, dispatches completion acknowledgement/reward, and requests the next question through router A. The fixed code records zero listeners and produces no effects or request.

The minimal original-source reproduction exited 1 with three failures among six checks:

```sh
pnpm_config_verify_deps_before_run=false GAME_RETIRE_REACT_MODE=production GAME_RETIRE_QUICK=1 GAME_RETIRE_CHANNELS=local GAME_RETIRE_SCENARIOS=retire GAME_RETIRE_BASELINE_DIR=../../artifacts/game-bridge-retirement-2026-10-04 GAME_RETIRE_REPORT_DIR=../../artifacts/game-bridge-retirement-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-game-bridge-retirement-browser.mjs
```

Three ranked explanations were tested: passive listener activity surviving commit, an invalid completion acknowledgement, and router continuations bypassing listener ownership. Live/replay controls accept one current receipt. Moving only listener setup/cleanup fixes removal, replacement and immediate setup failures. The final original-source comparison fails 72 of 282 assertions; development and production fixes pass all 282 each.

## Verification

| Check | Result |
| --- | --- |
| New listener harness, development and production React | 564 assertions passed; 84 journeys across seven scenarios, two channels and three viewports |
| Existing bridge dispatch ownership, both modes | 168 assertions passed |
| Existing game error ownership, both modes | 128 assertions passed |
| Firefox removal, captured original and fixed source | Native Retire clicks; original requested next through A, fixed had zero listeners at removal and no effects or next request |
| Firefox replacement | Native Replace click; injected native-channel receipt reached B, rewarded once and requested next once; replay did not add another request |
| Firefox synchronous initial reply | Acknowledgement observed before the host-send function returned; next question requested once |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped in this command |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,252 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The regression covers removal, committed replacement, suspended replacement, live delivery, 32 ordinary parent updates, immediate first replies and remount with retained old callbacks. Both same-origin local and injected native-message channels run under development/production StrictMode. Existing regressions cover held schema loading, immediate warm dispatch, asynchronous continuations and error ownership. The new verifier is registered as `test:game-bridge-retirement:browser` in the game browser chain.

An initial Firefox replacement assertion expected exactly one acknowledgement action and failed. Inspection showed only B effects: one reward/next request and an additional acknowledgement restored by the completion hook's existing completed-key logic after callback replacement. The corrected assertion checks committed ownership, one reward/next request and replay idempotency. This did not require another production change.

Receipts and terminal setup are injected controls; the new fixture uses real hooks and reducer, rather than the complete `GameFrameApp` UI or a live provider backend. Native-channel `MessageEvent` objects carry the required same-origin/parent fields but do not measure actual network delivery. The immediate acknowledgement flag establishes same-call-stack delivery, without claiming a network latency improvement. The YouTube build uses the incomplete English content fixture; release-content completeness remains unverified. Already admitted backend operations are unchanged. The broader improvement goal remains active.

An interruption left dispatch checks incomplete and an owned Firefox fixture scratch directory behind. Host process inspection confirmed the old processes were absent before resuming missing checks. Completed gate evidence was preserved after verifying unchanged source inputs. Both resumed Firefox fixtures were stopped after tab cleanup (pnpm exit 130), their scratch directories were removed by the verifier, and the exact abandoned scratch directory was removed after confirming no owning process remained. Four owned Firefox tabs were closed, preserving the original blank tab.

Evidence: [verification summary](../../../../artifacts/game-bridge-retirement-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/game-bridge-retirement-2026-10-04/owned-source.diff), and [asserted Firefox observations](../../../../artifacts/game-bridge-retirement-2026-10-04/firefox-verified.json). Original/final source captures, observations and gate logs are retained in that artifact directory.
