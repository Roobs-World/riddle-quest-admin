# Entry recovery callback ownership

Two baseline regressions reproduced retired entry processing after optional analytics delivery. Opening Activity from the callback still resumed the original recording and replaced the pending inbox read. Entering another account's challenge from that callback caused two resume commands for the replacement recording. Throwing analytics already preserved legitimate recovery.

Entry processing now rechecks its original journey after analytics delivery and terminal-entry journal cleanup. Navigation retains its inbox request, and replacement entries issue only their own resume. The public session tests also cover replacement during expired-entry journal cleanup. No visible copy changed.

The full client suite passes 1,718 tests across 201 suites, with 102 tests and 13 suites skipped. Eight injected-browser cases exercise actual rendered-game bridge delivery at desktop/mobile widths, including valid and throwing analytics controls. Removing the post-analytics guard in the injected bundle fails on the unwanted original-run resume, confirming the gate detects the regression. Thirty-four retained browser cases pass across private entry selection, creator acceptance, existing attempt authority and analytics failure isolation.

All seven isolated platform builds, exact dependency evidence, portal types, security and scalability pass. Global documentation and hosted E2E file-size failures remain outside the focused files. The manifest retains preceding checks and adds the entry effect gate, for 71 checks. Source, artifact and log hashes are retained in `artifacts/race-entry-effect-ownership/verification-held.json`.

The previously captured backend-file recheck still shows four concurrent solo gameplay changes; captured race files are unchanged. Earlier backend coverage remains historical evidence rather than a fresh full-backend claim.

The other chat's hosted Jest Hint/Skip E2E work continues uninterrupted. Dashboard completion remains pending stable source and global gates. This batch performs no hosted draft update, Jest publication or Firebase deployment. The broader multiplayer reliability audit remains active.
