# Multiplayer discovery provider ownership

Discovery previously accepted a retired adapter's late result and retried a failed search through that adapter after capability removal or replacement. Four baseline regressions reproduced those failures; four existing account-replacement controls passed.

Provider invocation now checks the live capability selection before calling its SDK. After a response or the original delivery deadline, the session checks that selection again before parsing receipts or navigating. Retired results become cancellation, including rejected promises and fallback offers. Retry cannot invoke the retired provider. Replacement requires another explicit player search and receives a fresh request receipt. Provider invocation and schema/preference validation now reside in the focused `raceMatchDiscovery` helper.

The full client suite passes 1,674 tests across 193 suites, with 99 tests and 13 suites skipped. A never-returning removed provider settles at its existing 30-second deadline without showing a failure or retaining the search. This change does not immediately cancel a never-settling provider promise when its capability disappears.

Twenty-four injected-browser cases exercise the actual multiplayer search button across desktop/mobile, removed/replaced providers, and matched, fallback, empty, failed, cancelled and rejected results. Each replacement can perform a subsequent explicit search through its new adapter. A negative test-bundle control disables the selection guard and fails on the first retired matched result. Initial browser setup did not wait for the capability replacement to render; that fixture failure is retained separately and is not counted as a passing or negative-control result.

Eight retained browser cases pass for account/storage discovery ownership, denied search-journal observation and fallback rematches. The denied-journal harness now supplies its injected matcher through actual host props. The older storage probe now retains its saved journal so it can observe the revision before triggering a replacement during completion; its stale-fixture failure is preserved separately.

All seven isolated builds, exact target dependency evidence, portal types, security and scalability pass. Global documentation and file-size checks still report concurrently edited files outside this focused change. Logs, source hashes and artifact hashes are in `artifacts/race-discovery-provider-ownership/verification-held.json`. The manifest retains preceding gates and adds both discovery browser checks, for 59 checks.

Full-source dashboard completion remains pending while the user-owned Jest pathway E2E chat finishes. No hosted Jest update, game publication or Firebase deployment occurred. The broader multiplayer reliability audit remains active.
