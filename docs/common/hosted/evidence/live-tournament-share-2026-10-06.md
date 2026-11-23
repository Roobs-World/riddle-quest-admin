# Tournament share feedback follows committed provider operations

The active tournament board now captures the initiating native share method and provider receiver. A committed provider or share-method change retires that operation's feedback. Its late success cannot refresh standings, and its late failure cannot add an error to the current board. Replacing and then restoring the original method also retires the earlier operation.

Share-method changes retain the existing board, row, read lifetime and pending-dialog barrier. The original share promise releases that barrier when it settles. Profile updates and abandoned replacement renders preserve committed ownership, so valid success still refreshes the official board and valid failure still receives the existing localized guidance. The Facebook adapter's existing SDK-instance dialog gate continues to prevent overlap across replacement providers.

## Reproduction

The injected harness imports the actual `RaceTournamentEntry` and `createFacebookTournamentPresentation`. It uses validated official UTC standings and the real Facebook dialog gate, with a controlled native SDK share promise. A native click starts sharing, another native click replaces the share method on the same capability, then the original SDK promise resolves or rejects.

The minimized development and production baselines each execute two cases and 36 assertions. Both fail four assertions: old success adds one authority read (also reflected in receiver and subsequent read-count assertions), and old failure displays an obsolete error. The final exact original-source replays retain those failures. The corrected source passes both cases in both modes.

The expanded harness covers replacement success/failure/cancellation, a rejected provider promise, withdrawal, replacement then restoration, valid profile updates, abandoned renders, stable ownership, and replacement providers sharing the same SDK gate. It asserts board/row identity, exact read and native-call counts, original receivers, pending-action exclusion, fresh-operation recovery, and absence of external traffic or unhandled errors. The maintained package command runs both React modes and is registered in the game-browser command chain.

## Verification

- 180 new cases, 3,120 assertions and screenshots across Chromium 153 and native Firefox 153, development and production, at 390×568, 390×844 and 1280×844.
- 132 adjacent tournament-owner and context-chooser cases with 1,860 assertions across both Chromium modes.
- Four final minimized green cases with 72 assertions. Total final browser scope: 316 cases and 5,052 assertions. Intentionally red baselines are excluded.
- All 2,910 portal tests pass; 93 tests and 15 suites remain explicitly skipped. 301 suites pass.
- 23 built-artifact browser tests pass across Jest, Reddit and the injected Facebook fixture.
- All six isolated target builds and the Devvit server build pass. YouTube uses its fixture build, which does not certify partner release acceptance.
- Types, target boundaries, security configuration, documentation (26,673 declarations) and file-size checks pass.
- The source freeze covers 2,460 selected inputs and three owned records with before/after hashes and a reversible diff. All 17 final tracked jobs terminate, including two intentionally red baselines.
- Existing backend/Firebase SDK authority evidence is reused only after confirming all 824 selected inputs and 24 compiled core copies remain byte-identical. Those suites were not freshly rerun for this client-only change.
- 1,301 output files, six isolated dependency inventories and the extra Facebook fixture inventory are preserved and hashed before exact owned temporary build roots and metadata are removed. Owned browser scratch directories are removed after their jobs terminate.

Two fixture diagnostics are retained. The first synthetic tournament ID failed the adapter's exact day/locale validation, so it timed out before native admission; it was corrected before reproducing the production defect. A later synthetic provider rejection consumed no SDK call, but the fixture then held the next valid SDK call as though it were the original pending dialog. That caused one failed fresh-read assertion; the corrected 15-case preflight passes all 260 assertions. Neither fixture issue was treated as a production failure.

Run `python3 artifacts/live-tournament-share-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifacts and cleanup. Firefox coverage uses the native executable and does not claim Firefox MCP coverage. No visible production text, score/reward authority, commit or deployment changed. The full improvement goal remains active; the earlier multiplayer retirement callable/Devvit-route/TTL deployment prerequisite remains in force before releasing those clients.
