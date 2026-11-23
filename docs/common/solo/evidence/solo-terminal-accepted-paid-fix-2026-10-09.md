# Accepted terminal payment receipt ownership

Recovery retained unresolved paid actions after terminal confirmation, but accepted Hint and Skip replies still entered generic gameplay handlers. A late Hint changed terminal letters and hint locks and overwrote the current profile balance with an older receipt balance. A Skip reply could close the victory dialog while its successor delivery was still outstanding.

The recovery handler now consumes accepted Hint and Skip replies for the same confirmed terminal round after settling their durable delivery. It preserves the terminal presentation and avoids applying old Hint data to a finished round. Continue settlement, definitive rejections, exact request identity, account ownership and Skip successor correlation retain their existing paths. No server or locale code changed.

## Evidence

- Four permanent real-router/recovery/reducer tests cover accepted Hint and Skip replies after confirmed wins and losses. Hint tests preserve the current letters and balance; all tests preserve the canonical outcome and modal.
- The injected rendered browser harness covers 64 journeys and 672 assertions: Chromium 153 and Firefox 153, development and production, widths 390 and 1280, wins/losses, Hint/Skip, and hot/reload recovery. Original requests remain durable, retry exactly before completion acknowledgement, settle without terminal gameplay posts, and preserve terminal letters, hint locks and modal. Hint settlement retains the fresher current balance.
- The same Chromium development harness against the preceding recovery code fails 28 assertions across 16 journeys. This establishes that the rendered checks distinguish the fix from its baseline.
- Full portal suite: 3,186 tests in 312 suites pass; 96 gated tests in 16 suites skipped. Type checking, TSDoc and file-size audits pass.
- All six isolated game target builds and the Devvit server build pass. Archived 1,299 outputs and six dependency inventories; removed owned build outputs and scratch directories.
- All 2,551 selected source/config inputs match before, terminal and verified manifests. One recovery source file changed and one test file was added relative to the preceding verified cohort.

Artifacts and executable verifiers are in `artifacts/solo-terminal-accepted-paid-fix-2026-10-09/`. Initial sandbox attempts could not bind local fixtures or read the dependency license inventory; approved executions completed. The initial test declaration documentation omissions were corrected before the final frozen cohort. The exploratory diagnostic needed a missing closing brace corrected when promoted to the type-checked permanent test; the final permanent and browser verifiers both pass independently.

These are injected delivery-order tests, not live backend payment transactions. The Skip-plus-confirmed-win fixture checks defensive UI ownership and does not establish that the authoritative backend permits both actions to commit on one session. Arrival and ownership of Skip successor loads remain a separate audit target. No deployed latency claim is made. Nothing was deployed or published; the broader improvement goal remains active.
