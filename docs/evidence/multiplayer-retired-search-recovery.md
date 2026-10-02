# Retiring settled matchmaking recovery

Failed and empty-pool discovery retained their old provider's error and recovery journal after that provider disappeared or was replaced. Loading had already stopped, so the preceding wait-cancellation guard did not handle these states. Eight baseline regressions failed across removed/replaced providers, failed/empty results and category/tournament hubs.

The session now retires any privately retained discovery intent whose adapter is no longer selected. One retirement transition invalidates the discovery generation, cancels its wait if present, clears its owned journal and attribution, and resets discovery UI while preserving the selected hub. Pending search and completion cleanup use the same transition. The corresponding state patch is named in the initial-state module; the session remains at 498 equivalent lines.

Forty-two focused unit tests pass, including the new eight regressions and previous active-gameplay, typed-input, resolver-reentrancy, account callback, late response, rematch and deadline controls. The full client suite passes 1,692 tests across 196 suites, with 101 tests and 13 suites skipped.

Eight injected-browser cases complete an actual search as failed or empty before removing or replacing its provider. The stale recovery state clears within the 1.5-second observation budget, with no automatic replacement search. A replacement still supports an explicit new search with a fresh receipt. Fifty-four retained browser cases pass across prompt stalled-search cancellation, late responses, synchronous completion callbacks, denied journal reads and fallback rematches. The cancellation verifier's negative-injection anchor now follows the shared retirement transition; its positive assertions are unchanged.

All seven isolated builds, exact dependency evidence after build completion, portal types, security and scalability pass. Global documentation and file-size checks still report concurrent files outside this change. Logs and hashes are held in `artifacts/race-retired-search-recovery/verification-held.json`; the manifest preserves preceding gates and adds settled recovery, for 62 checks.

Full-source dashboard completion remains pending during the other user-owned chat's work. No hosted Jest update, game publication or Firebase deployment occurred in this batch. The broader reliability audit remains active.
