# Skip successor delivery ownership audit

Ten type-checked injected-hook diagnostics exercise the actual recovery handler against the real reducer and durable journal. Four fail and six pass on the current worktree.

Failing cases:

- Before the payment reply, the correctly correlated old successor is admitted even when the current host-loaded Classic round has advanced from index 1 to index 3.
- After the accepted payment reply, a correlated index-4 delivery is admitted for a skip of index 1.
- After the accepted payment reply, a correlated Challenge-mode delivery is admitted for that Classic skip.
- After the accepted payment reply, the old index-2 successor is admitted while index 3 is current.

Controls pass for valid early and late index-2 successors and their duplicate suppression, same-origin replies, and early wrong-index/wrong-mode rejection. This narrows the fault to inconsistent validation of the early and post-receipt delivery paths and missing freshness ownership in both paths.

The host handler posts the successful operation result before loading the successor using the receipt's newProgress.classicIndex. Delayed loads can therefore remain outstanding after the journal payment is settled. The recovery ref retains requestId and predecessor sessionToken but no predecessor index or current-round bound. Its post-receipt path clears that ref before validating the target.

Executable diagnostics, Jest results, and reviewed production source hashes are in artifacts/solo-skip-successor-ownership-audit-2026-10-09/. These checks establish local admission behavior, not production incident frequency or backend permission to generate malformed replies. No production files changed. The next implementation must reject stale and foreign target loads without consuming a legitimate outstanding successor, preserve optional preview handling, and verify both delivery orders in rendered browsers and all six builds. The broader goal remains active.
