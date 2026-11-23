# Buffered terminal recovery — 3 October 2026

Verified progress on the active reliability, performance, playability and latency goal. Recovery now retires a host-confirmed completed predecessor while preserving later issued questions, exact request identities, unsubmitted drafts and their selected slots. The broader goal remains active.

## Reproductions

The mounted game originally replayed the completed predecessor when its durable journal also contained a successor: **one outgoing predecessor guess instead of zero**. The quick reproduction takes less than one second. The final red control substitutes only the captured original recovery hook and still detects that replay.

After prefix retirement was fixed, the actual victory-to-next transition exposed a second failure: the successor's queued wrong row and CL draft remained absent because restoration had already been attempted while victory prevented the question change. A further browser check and native Firefox then exposed a profile rollback: restoring the journal's older profile changed the displayed acknowledged balance from **325 to 300**. All failing logs and the Firefox balance observation are retained.

Run `pnpm_config_verify_deps_before_run=false pnpm --filter @qwordly/portal test:buffered-terminal-recovery:browser`. For the fast reproduction, invoke its verifier with `BUFFERED_TERMINAL_QUICK=1`; add `BUFFERED_TERMINAL_BASELINE_DIR` pointing to this pass's artifact directory to exercise the original hook.

## Final behavior

- Reconciliation requires host-winning proof and the exact root question identity. Later segments must be distinct, consecutive Classic sessions within the existing three-successor bound. Unknown or reordered deliveries retain the original journal.
- A proved completed prefix is removed without mutating the original record. The next issued segment becomes the durable root, retaining later request IDs, ordering, paid actions, drafts and legacy cursor behavior. Only paid actions belonging to the completed predecessor are retired.
- Successor delivery waits for predecessor completion acknowledgement. Victory remains visible until the normal native fanfare navigation finishes.
- The newly displayed successor restores its rows, draft and selection once. Its pre-restoration empty render cannot overwrite the durable draft. Draft-only journals also retain subsequent typing.
- Journal restoration preserves the current host profile, including its acknowledged balance and progress. An older journal profile cannot supply a profile when the host has none. Economy grants remain authoritative and idempotent through the existing host boundary.

No visible copy, locale key or provider SDK was added. This removes demonstrated redundant delivery and lost-draft behavior; it does not claim a measured production network-latency improvement.

## Verification

The [verification summary](../../../../artifacts/buffered-terminal-recovery-2026-10-03/verification-summary.json) records final source fingerprints and cleanup status.

- **2,627 portal unit checks in 294 suites**, with 120 skipped. Twelve new regressions exercise immutable prefix promotion across multiple successors, queued and draft-only journals, paid-action ownership, foreign/reordered delivery, invalid successor bounds and authoritative profile preservation.
- **1,008 injected browser assertions:** 111 buffered-recovery assertions in each development and production React mode; 690 prior native terminal-journal assertions; and 96 guest terminal-checkpoint assertions.
- Buffered scenarios cover queued successor guesses and draft-only successors at 390×568, 390×844 and 1280×844. They assert completion ordering, original receipt identity, durable draft/cursor, native reward collection/Next, restored rows, preserved balance, once-only progression, continued native typing and no browser errors.
- **22 final built journeys in four suites** cover Reddit guest/authenticated play, hosted play, profile guidance and queued coin-action recovery.
- Final native Firefox at 390×568 verifies the retained successor request, zero predecessor replays, held completion, native chest/fanfare navigation, a single restored wrong row, CL at slot 3, and the unchanged acknowledged balance of 325. Releasing the held successor receipt clears its journal. Native O typing continues the draft to CLO without duplicating the row.
- All six isolated artifacts build and pass their audits. Jest remains at **0.53 MB initial resources against the unchanged 0.55 MB budget**. Types, TSDoc (24,980 declarations), whitespace checks and the React recovery review pass.

The fixture uses actual fake-authority answer/completion methods, a cached issued successor and an explicit idempotent receipt wrapper. Completion and successor replies are independently held. These are injected-provider checks, not live remote-provider or production-network measurements. One fixture assertion initially compared layout-generated line breaks with an unbroken word; final checks read and normalize the actual cells.

All owned validation processes are terminal. Both owned fixture servers were stopped and their Firefox tabs closed, preserving the original about:blank tab. No commit, push or deployment was performed.

Next investigation: rejected successor delivery and rollback after predecessor completion, including profile and draft ownership.
