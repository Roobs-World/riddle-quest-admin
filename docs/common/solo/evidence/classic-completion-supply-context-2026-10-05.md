# Reuse committed Classic progress for content preparation — 5 October 2026

Classic wins now check content supply using the progress index returned by their committed completion transaction, removing a second account fetch after reward settlement. The index stays internal: public responses and stored receipt results retain their existing shape. The atomic leaderboard writer retains its own current-account transaction, so this also removes the extra Classic lookup introduced by the previous ranking reliability fix.

The transaction returns its public result and supply index as one internal object. A normal win returns the advanced progress. A superseded completion returns the current progress without re-awarding the win. Receipt replay returns progress from that attempt's fresh account snapshot and profile repair, rather than the old session or original receipt. Missing-account replay returns the original result with no supply index, so it skips content work. Only the final successful transaction attempt returns the context used after commit; nothing is stored in mutable state outside the callback.

Required Facebook/Reddit referral settlement remains before projections. Ranking and supply tasks remain independently awaited, and recoverable projection failures retain the same handling. Losses and anonymous Daily wins retain their empty-projection fast path. The global supply check uses this committed snapshot; it does not claim to observe unrelated progress mutations that commit later during referral settlement.

## Evidence

A matching red/fixed probe uses the actual completion, profile preparation and atomic leaderboard writer with injected persistence. Each document read costs 200 ms, content preparation is stubbed at 400 ms, and terminal session finalization is a trusted winning fixture. Both complete and legacy profiles fail on the old completion service: five document reads and 800 ms. The fixed service makes four reads and takes 600 ms. The completion and ranking account reads remain, while the standalone content-profile lookup disappears.

The timing model omits Firestore commit cost and real network variability. Its 200 ms saving identifies the removed sequential read; it is not a measured production request-latency improvement. The initial narrower red probe stubbed ranking; the final matching probe includes the real atomic writer on both sides.

The eight-case mode/win/identity matrix proves projection eligibility and unchanged balances/statistics on receipt replay. Its ranking task is mocked at 250 ms and supply at 400 ms. All cases make zero standalone profile reads. Classic supply work remains awaited at 400 ms in that orchestration-only model; named Daily ranking retains its own task. These matrix times do not account for the writer's real transaction I/O.

Four additional transaction controls verify replay after progress advances to seven, superseded completion at index seven, missing-account replay, and an explicitly discarded attempt followed by a retry at index nine. The retry fixture rolls back all first-attempt Map writes before invoking the second attempt; only index nine reaches supply, once, and no discarded grant remains. Independent failure controls verify that neither ranking nor supply can suppress the other or leave it running beyond the response.

The real Firestore single-player fixture now contains 12 tests. All eight mode/win/identity cases retain actual opaque session issuance, authoritative guesses, legacy repair, four concurrent completions and receipt replay. Supply is stubbed, with its received index asserted on every winning Classic call. An added real receipt replay after a later index-seven account update supplies seven while preserving the original response and profile. Missing-account replay explicitly verifies no content call. Corrupt-receipt rollback and concurrent purchase/progression preservation remain covered. The full emulator gate also retains the separate real atomic leaderboard probes.

## Final verification

- **1,617 backend unit tests / 131 suites passed**.
- **237 real Firestore/Realtime Database emulator tests / 14 suites passed**, including the 12 single-player cases, atomic leaderboard refresh, live multiplayer, deletion, Facebook context and Facebook/Reddit referral ledgers.
- **40 focused tests / four suites passed**, with separate unchanged trace runs for both timing cases and all eight eligibility cases.
- Backend TypeScript, targeted lint and TSDoc passed: **25,643 declarations / 1,149 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**. The buffered single-player transition threshold remains 100 ms.
- **2,347 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Only private outputs and matching metadata were removed after the gates. All 13 tracked jobs completed, and owned emulators stopped.

No final gate failed. No UI text, translations, target adapters, public schema or deployment changed. The previous goal turn made progress by eliminating stale ranking writes; this turn removes the duplicate Classic transport stage while retaining that protection. The broader improvement goal remains active.

Evidence is in `artifacts/classic-completion-supply-context-2026-10-05/`. `report-generation.py` re-enumerates current source inputs and checks paired real-writer traces, eligibility traces, gate counts, build hashes, cleanup, exact owned source snapshots and reverse applicability of the patch before generating `verification-summary.json`.
