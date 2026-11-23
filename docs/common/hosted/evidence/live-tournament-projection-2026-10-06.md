# Native tournament projection coalesces pending authoritative boards

Concurrent recovery reads now share one native lookup within the same native context, official tournament and locale. While that lookup is pending, the adapter retains the lowest validated official best. It posts that best once instead of sending each intermediate score. A post already admitted to the SDK retains its original promise and serial ordering; better scores arriving during that post share one queued improvement. Equal or slower snapshots observe the admitted operation without duplicating it.

Context identity is captured before queuing and revalidated before lookup and score admission. A replacement context owns separate work. Settlement removes only the original map entry, preserving a newer queued improvement. Failure releases in-flight coalescing so a fresh authoritative read can retry. Optional guard and SDK failures remain contained, independent of the successful official board response. Scores and rewards remain server-authoritative.

## Measured reproduction

The injected browser harness imports the actual race entry and Facebook tournament presentation adapter. Its capability follows the production read path: official standings return to the UI while native projection proceeds in the background. Native tab actions reopen the board and obtain further independently validated snapshots while a native lookup or score post remains held.

The minimized development and production baselines each execute two cases and 30 assertions. Five recovery reads cause five native lookups. When official snapshots improve from 9s to 8s to 7s, with a later older 8.5s snapshot, the original code posts 9s, 8s and 7s. Both baselines fail seven measured assertions. Final exact original-source replays retain those failures. The corrected source uses one lookup and posts only 7s. In this measured burst, that is 80% fewer native lookups and two fewer score posts. A later fresh read still obtains current native metadata and respects the successful-post cache.

The expanded harness covers duplicate reads, improving and out-of-order official snapshots, an admitted native post, post and lookup failure, context replacement, account/locale retirement, expiry, foreign native metadata, profile updates and abandoned renders. It separately checks that all local projection promises settle, optional failures leave the official board usable, original native operations remain ordered, and fresh recovery works after settlement. External traffic is rejected; browser errors and unhandled rejections are recorded. The maintained package command runs both React modes and is registered in the game-browser chain.

## Verification

- 144 new cases, 2,100 assertions and screenshots across Chromium 153 and native Firefox 153, development and production, at 390×568, 390×844 and 1280×844.
- 162 adjacent tournament-owner and tournament-share cases with 2,496 assertions across both Chromium modes.
- Four final minimized green cases with 60 assertions. Total final browser scope: 310 cases and 4,656 assertions. Intentionally red baselines are excluded.
- Ten added adapter tests cover concurrent lookup sharing, the best received during a held lookup, improvements queued during successful/failed admitted posts, context changes returning new native metadata, recovery after coalesced lookup failure, native context-getter failure, and all three optional guard callback faults. All 24 tournament adapter tests pass.
- All 2,920 portal tests pass; 93 tests and 15 suites remain explicitly skipped. 301 suites pass.
- 23 built-artifact browser tests pass across Jest, Reddit and the injected Facebook fixture.
- All six isolated target builds and the Devvit server build pass. YouTube uses its fixture build, which does not certify partner release acceptance.
- Types, target boundaries, security configuration, documentation (26,717 declarations) and file-size checks pass.
- The source freeze covers 2,461 selected inputs and four owned records with before/after hashes and a reversible diff. All 17 final tracked jobs terminate, including two intentionally red baselines.
- Existing backend/Firebase SDK authority evidence is reused only after confirming all 824 selected inputs and 24 compiled core copies remain byte-identical. Those suites were not freshly rerun for this client-only change.
- 1,301 output files, six isolated dependency inventories and the extra Facebook fixture inventory are preserved and hashed before exact owned temporary build roots and metadata are removed. Owned browser scratch directories are removed after their jobs terminate.

The first two adapter regressions fail against the original implementation and pass after coalescing. A preflight inspection then caught an introduced regression: moving the initial guard ahead of the asynchronous queue let a throwing guard escape synchronously. Three explicit callback-fault tests reproduced it. Initial guard admission is now inside the same optional failure boundary, and all 24 tests pass. The failing intermediate source, tests and diagnostic log are retained. No final source changed after the verification freeze.

This change reduces redundant pending work; it does not remotely cancel an admitted SDK operation or bypass serial ordering for a stalled native score post. Run `python3 artifacts/live-tournament-projection-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifacts and cleanup. Firefox coverage uses the native executable and does not claim Firefox MCP coverage. No visible production text, commit or deployment changed. The full improvement goal remains active; the earlier multiplayer retirement callable/Devvit-route/TTL deployment prerequisite remains in force before releasing those clients.
