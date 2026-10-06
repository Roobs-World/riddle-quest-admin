# Read-only native tournament lookup has a bounded projection wait

Background native tournament projection now bounds its metadata query to eight seconds. Expiry completes the local projection through the existing optional failure boundary, releases its pending coalescing entry, and permits a fresh official board to start a new lookup before the original SDK query returns. The original SDK promise retains its observer. Its late success cannot admit a score post, and its late rejection cannot escape or add another failure diagnostic.

The deadline applies only to an admitted read-only projection lookup. Early success, failure and native absence clear it. Coalesced improvements, profile updates and abandoned renders retain the original lookup deadline. A native score post that has already started keeps its original promise and serial barrier: neither deadline expiry nor a better official snapshot can race that admitted write.

## Reproduction

The first adapter regression admits a held SDK metadata query and advances the actual timer clock to 7,999ms and then 8,000ms. The original projection remains pending at 8,000ms, so the test fails before its controlled cleanup releases the original SDK result. The corrected projection completes locally at that boundary, admits a fresh authoritative 7s best through a new lookup, and ignores the later original metadata result.

The injected browser harness imports the real race entry and Facebook tournament adapter. Official board reads follow the production path and render before native projection completes. It captures actual eight-second timer callbacks, clearing normal UI read timers as the product does, then advances the remaining lookup deadline without waiting eight wall-clock seconds. Native tab actions reopen the official board while the original SDK promise remains held. It checks local completion, fresh lookup/score admission before original settlement, late-result containment, original score ordering, context ownership, fixed diagnostics, timer cleanup and absence of external traffic or unhandled errors.

Both minimized development and production baselines execute two cases and 34 assertions, with 13 failed assertions each. The original lookup prevents local completion and fresh native recovery until it finally resolves or rejects. Final exact original-source replays retain those failures; the final source passes both cases in both modes.

The expanded harness covers timeout, late rejection, a coalesced improvement, profile refresh, abandoned render, context change, account/locale retirement, window expiry, early lookup success/failure, and successful/failed admitted score posts. The maintained package command runs both React modes and is registered in the game-browser chain.

## Verification

- 156 new cases, 2,712 assertions and screenshots across Chromium 153 and native Firefox 153, development and production, at 390×568, 390×844 and 1280×844.
- 162 adjacent tournament-projection and tournament-share cases with 2,610 assertions across both Chromium modes.
- Four final minimized green cases with 68 assertions. Total final browser scope: 322 cases and 5,390 assertions. Intentionally red baselines are excluded.
- Four added adapter tests cover the exact 7,999ms/8,000ms boundary, fresh recovery before original settlement, late SDK rejection after recovery, and preservation of admitted post ordering through both success and failure. All 28 tournament adapter tests pass.
- All 2,924 portal tests pass; 93 tests and 15 suites remain explicitly skipped. 301 suites pass.
- 23 built-artifact browser tests pass across Jest, Reddit and the injected Facebook fixture.
- All six isolated target builds and the Devvit server build pass. YouTube uses its fixture build, which does not certify partner release acceptance.
- Types, target boundaries, security configuration, documentation (26,743 declarations) and file-size checks pass.
- The source freeze covers 2,462 selected inputs and four owned records with before/after hashes and a reversible diff. All 17 final tracked jobs terminate, including two intentionally red baselines.
- Existing backend/Firebase SDK authority evidence is reused only after confirming all 824 selected inputs and 24 compiled core copies remain byte-identical. Those suites were not freshly rerun for this client-only change.
- 1,301 output files, six isolated dependency inventories and the extra Facebook fixture inventory are preserved and hashed before exact owned temporary build roots and metadata are removed. Owned browser scratch directories are removed after their jobs terminate.

Run `python3 artifacts/live-tournament-lookup-deadline-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifacts and cleanup. This is a local projection deadline, not remote cancellation of the SDK query. Admitted score posts retain their original ordering. Firefox coverage uses the native executable and does not claim Firefox MCP coverage. No visible production text, score/reward authority, commit or deployment changed. The full improvement goal remains active; the earlier multiplayer retirement callable/Devvit-route/TTL deployment prerequisite remains in force before releasing those clients.
