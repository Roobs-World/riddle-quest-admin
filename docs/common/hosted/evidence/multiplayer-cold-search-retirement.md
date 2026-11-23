# Cold unavailable search retirement

Cold startup previously left an observed search journal intact when its current provider was unavailable or capability lookup failed. A later reopening under a newly available adapter could automatically revive that old receipt even though the preceding visit had retired to the catalog.

The unavailable-provider branch now clears only its observed recovery revision before catalog loading. Cleanup is best effort and obeys the existing owner/revision checks. Account-generation checks prevent a cleanup notification that installs another account from issuing duplicate old-entry work. Confirmed run pointers still take precedence over saved search hints.

The two unavailable-provider regressions failed before the fix; available-provider recovery and newer-journal preservation controls passed. Six focused cases now pass, including confirmed-run precedence and replacement-account cleanup. Eight rendered desktop/mobile browser cases verify real browser storage retirement, later provider availability, fresh explicit receipt issuance, newer-journal preservation and valid same-provider cold recovery.

The full client suite passes 1,797 tests across 216 suites (103 tests across 14 suites skipped). Retained resolver failure and shared-journal browser gates passed. Failure presentation construction was extracted into the discovery recovery helper, which copies guidance and preserves the private policy boundary while keeping the session within its maintainable-size limit. Client types, documentation, file-size, security and scalability checks passed independently.

The guarded manifest `docs/common/development/development-tasks/race-cold-search-retirement.json` retains 86 preceding checks and adds cold search retirement. All seven isolated target builds and dependency evidence, all retained tests, source stability and HEAD stability are required before the dashboard records completion. Hosted E2E evidence remains untouched; the ongoing multiplayer audit is not complete.

Jest remains unpublished. This checkpoint does not deploy Functions or publish any game.
