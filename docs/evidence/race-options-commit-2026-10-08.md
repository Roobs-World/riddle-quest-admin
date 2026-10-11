# Race callback commit ownership

The retained `useRaceSession` API now installs host callbacks in a layout effect, so a suspended render cannot replace callbacks belonging to the committed session. Initial options remain available for mount; committed replacements become visible before passive entry effects. This protects all three wrappers (host delivery, effects and matchmaking) through their shared options reference.

Important scope correction: a current-source search finds no production caller of this hook. The current `RaceTo10Game` opens live multiplayer directly. This is a retained API reliability fix, not evidence of a current single-player latency improvement. The previous reproduction characterized the hook correctly but initially overstated its current player-path relevance.

## Reproduction and regression

A real React Suspense transition attempts a speculative callback, then suspends indefinitely. The original committed Retry button remains visible. Before the fix its catalog retry reached the speculative callback; after the fix it reaches the original callback. A subsequent committed replacement receives the next retry. Both development and production React baseline probes failed; fixture-only candidates passed. The permanent harness runs against actual production source without candidate injection and passes both modes (four explicit ownership assertions). Its opt-in original-source override reproduces the failure in production, confirming the regression remains red-capable.

The permanent script is `packages/portal/scripts/verify-race-options-commit-browser.mjs`, registered as `test:race-options-commit:browser` and included in the full browser chain. The initial diagnostic harness required a Playwright CommonJS import correction before reproduction; it is retained as evidence, not the permanent test. No visible product text was added.

## Verification

- Portal: 2,992 tests across 304 passing suites; 96 tests in 16 suites remain skipped under the standard configuration. Types, TSDoc and file-size audits pass.
- Eight session resource matrices cover development/production, ordinary/Strict Mode and desktop/mobile. Entry changes, unmount/remount and replay retain exactly one owned interval/bridge/visibility listener set and release retired resources.
- All six isolated targets and Devvit server build and artifact audit pass. YouTube uses the self-contained fixture and is not partner release acceptance.
- Exact rebuilt Jest/Reddit/ Facebook browser cohorts pass 23 checks, including rendered standards checks.
- 1,299 built files and seven exact output inventories are preserved; their owned temporary output roots and inventory records were removed afterward.
- 2,488 selected source inputs are immutable across verification; only the hook, permanent regression and portal package scripts differ from the preceding 2,487-input snapshot. The owned patch reverse-check passes.

An additional historical `verify-race-tick-browser.mjs` run failed at a disabled category click. Its fixture supplies no live adapter and assumes the current live entry still launches recorded races. This check does not exercise `useRaceSession` in the current UI and was excluded from positive verification. It needs retirement or migration in a separate current-surface cleanup; no failure was concealed or claimed green. Its original session module expiry probe completed before the obsolete UI step.

All launched jobs are terminal. Nothing was deployed. Existing server-authoritative ownership protocol rollout prerequisites remain unchanged. No timing or bundle reduction is claimed.

Evidence: `artifacts/race-options-commit-2026-10-08/`, including original bytes, red observations, permanent observations, build outputs, resource logs, source hashes, owned patch and `verification.json`. Recheck with `python3 artifacts/race-options-commit-2026-10-08/verify.py`. The overall improvement goal remains active; the next useful work is to audit the current production surface rather than infer impact from retained APIs.
