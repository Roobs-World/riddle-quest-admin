# Private challenge acceptance routing

Four baseline regressions showed that rewriting exposed viewer/invitation roles or clearing the public entry could enable a creator to accept their own recording, while rewriting a recipient's role could deny acceptance. Acceptance now uses privately retained server-confirmed entry facts. Its default challenge ID also remains pinned when the exposed active ID is overwritten.

The actual challenge card renders a copy of those private facts. Creators continue to Check Results in Activity; recipients retain Accept Challenge even when an observer changes the public snapshot. The copied view cannot mutate the retained authority facts. No visible text or locale keys changed.

The complete client suite passes 1,714 tests across 200 suites, with 102 tests and 13 suites skipped. Ten new injected-browser cases verify creator viewer/invitation roles, cleared entries, overwritten identity and recipient role rewrites through actual card clicks at desktop/mobile widths. Sixty retained cases pass across private entry selection, existing attempt/opponent authority and rendered journey ownership.

All seven isolated target builds, exact dependency evidence, portal types, security and scalability pass. Global TSDoc and hosted E2E file-size gates remain pending in concurrently edited files. The dashboard manifest preserves all preceding checks and adds the acceptance gate, for 70 checks. The held verification record contains focused source, log and artifact hashes at `artifacts/race-private-creator-acceptance/verification-held.json`.

The recheck of 333 previously captured backend files found four changed solo gameplay files from concurrent work; captured race files are unchanged. Earlier backend coverage is retained evidence, not a fresh full-backend verification claim.

The other chat's hosted Jest E2E run is allowed to finish without interruption. No dashboard completion receipt, hosted draft update, Jest publication or Firebase deployment occurred in this batch. The broader multiplayer reliability audit remains active.
