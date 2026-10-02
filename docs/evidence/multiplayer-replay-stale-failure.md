# Multiplayer replay protection against stale delivery failures

An older delivery invocation could fail after an operator repaired and replayed its receipt. Permanent failure bookkeeping checked whether delivery had completed, but did not check the newer replay time. The older corruption diagnosis could therefore quarantine the newly released pending receipt again. Transient failures already respected the receipt's future retry time.

Failure bookkeeping now ignores a receipt whose valid replay time is later than the invocation's captured clock. A newer repair/replay thus supersedes the older diagnosis without changing canonical source, result, profile samples or reward amounts. Current invocation failures still follow normal quarantine/backoff, and concurrent completed or suppressed delivery retains precedence. This change introduces no extra Firestore read.

## Evidence

- `artifacts/race-replay-stale-failure/unit-before.log`: the permanent-failure integration scenario failed because a fresh pending replay was changed to quarantined using the older invocation clock; the transient scenario and 31 existing queue/health/lease cases passed.
- The new Firestore scenarios keep an older operation pending, release a fresh receipt using the persisted repair/replay fields, then reject the older operation. They require the fresh receipt to remain byte-for-byte equivalent at the data level. Both also verify that a permanent error at the current replay clock still quarantines the receipt.
- All 1,050 backend race tests across 72 suites pass. Coverage remains above every threshold: 93.48% statements, 89.60% branches, 96.97% functions and 95.79% lines. Build/operator safeguards, types, lint, source checks and all seven isolated target builds/dependency verifications pass.
- The validated compiled runtime was staged and deployed to `deliverRaceSettlementEvent`, `deliverRacePerformanceEvent` and `settleRaceDeadlines` in `us-central1`. All three functions are ACTIVE on Node 22, and each new Cloud Run revision receives 100% of traffic. Filtered metadata, exact staged runtime hash and `deployment-verified.json` record the verification.

`docs/development-tasks/race-replay-stale-failure.json` retains all 35 full-source verification gates. Automatic dashboard completion remains pending while the authorized hosted pathway chat edits evidence; focused verification and backend deployment do not substitute for the required stable full-source receipt. The pinned active Jest draft remains unchanged and unpublished. The multiplayer reliability audit remains active.
