# Atomic leaderboard refresh — 5 October 2026

Delayed single-player completion callbacks now refresh leaderboard rows from the current canonical account inside a Firestore transaction. They cannot overwrite newer scores or copied identity fields with an earlier caller snapshot. Each retry re-reads the account, missing accounts are skipped, and the public row is replaced so an avatar removed from the account is also removed from the projection.

The writer takes only the account ID. Completion no longer obtains a profile solely to pass it into the writer. Classic content preparation retains its own fresh progress lookup and runs independently, with all required tasks awaited before the response. Completion rewards, receipt replay, referral settlement, anonymous eligibility and recoverable projection failure handling retain their existing boundaries.

## Reproduced failures

Five unchanged probes use the real Admin SDK on a private loopback demo Firestore emulator. A compatibility-typed test caller deliberately retains the old name, avatar and score arguments. The old implementation uses these arguments; the fixed implementation ignores extra JavaScript arguments and reads current authority.

1. A delayed completion regresses level 3 / 100 XP / five wins to level 2 / 50 XP / four wins, including the indexed progression score.
2. A delayed completion restores an older name and avatar after a successful canonical and public profile change.
3. A removed canonical avatar remains on the public row.
4. A delayed completion recreates a public row after both the account and row were removed.
5. Concurrent refresh and canonical account transactions followed by receipt-style replay leave the old win count and omit the current multiplayer total.

All five fail before the fix and pass afterwards. The last test proves eventual refresh from committed authority with real transactions; it does not claim every concurrent schedule triggers an SDK retry. A separate unit fixture explicitly invokes a second transaction attempt with changed canonical data, verifies a fresh read and replacement, and checks that success is logged only once after the final commit. Read failures publish no partial row.

The completion matrix retains all eight mode/win/identity combinations, account balance/statistics and receipt replay. A new failure control verifies that a failed Classic content-profile lookup cannot suppress or leave the independent leaderboard task running beyond the response. Existing controls retain independent content waiting when ranking fails.

## Performance qualification

The projection matrix uses a 200 ms content-profile lookup, a mocked 250 ms leaderboard task and a 400 ms content task. Named Daily caller profile reads change from one to zero; the orchestration model changes from 450 to 250 ms. **This is not an end-to-end speedup measurement:** the leaderboard mock hides the new transaction's canonical account read. In the actual implementation, Daily moves its existing profile read into the atomic writer rather than removing a total database read.

Named Classic wins add one concurrent canonical account read because ranking must validate its own transaction while content preparation remains independent. The matrix keeps Classic's modeled 600 ms critical path. This deliberate read cost prevents stale score/identity rollback without serializing content behind the leaderboard commit. Losses and anonymous Daily wins retain their empty-projection fast path. No production network latency claim is made.

This change protects completion refreshes. Other best-effort display-field synchronization and the bounded leaderboard fallback retain their existing behavior; this pass does not migrate historical projections or guarantee a globally instantaneous ranking after every account mutation.

## Final verification

- **1,611 backend unit tests / 130 suites passed**.
- **236 real Firestore/Realtime Database emulator tests / 14 suites passed**, including five new writer probes and existing real single-player completion, live multiplayer, deletion, Facebook context and Facebook/Reddit referral coverage.
- **58 focused tests / four suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,618 declarations / 1,148 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**; the buffered single-player transition threshold remains 100 ms.
- **2,346 freshly enumerated source inputs** remained stable across final gates, including compiled and installed shared core code.
- All **1,300 built files** and six target dependency inventories were preserved with SHA-256 hashes. Private outputs and their matching metadata were removed only after the gates completed. All 12 tracked process handles are terminal and owned emulators stopped.

Two preflight documentation audits identified comments missing from new test type members; those comments were corrected before the final source freeze. The evidence validator initially found that the combined focused run omitted console traces; a separate unchanged eight-case matrix run captured all paired diagnostics. No final code gate failed. No UI, translations, target adapters or deployment changed.

The previous goal turn was progress through removing empty projection reads. This turn is progress through eliminating stale completion projections and isolating content-profile failure. The broader improvement goal remains active.

Evidence is in `artifacts/leaderboard-atomic-refresh-2026-10-05/`. `report-generation.py` re-enumerates current source inputs and checks red/fixed probes, orchestration traces, gate counts, preserved hashes, cleanup and reverse applicability of the owned patch before generating `verification-summary.json`.
