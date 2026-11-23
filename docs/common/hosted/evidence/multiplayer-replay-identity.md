# Multiplayer delivery replay identity

Verified and deployed 2026-10-01. The hosted Jest E2E chat is still active; its preview and evidence file are untouched.

## Failure and change

The earlier stale-failure guard compared the operator's replay timestamp with the worker's invocation clock. Equal timestamps or a backwards replay clock allowed an old corruption failure to quarantine a newly released receipt. Two real Firestore emulator regressions failed against the saved prior failure handler, with 33 retained cases passing. The negative log is `artifacts/race-replay-identity/negative-backend.log`.

Each actual operator replay release now stores a fresh opaque `replayId`, stable across transaction retries. Both production delivery operations report the replay metadata from their transactional receipt read to the failure module. Failure bookkeeping compares the observed identity and legacy replay clock with the current receipt before writing. A replaced replay is preserved independently of wall-clock ordering. Transaction retries refresh the observation; failures on the currently observed replay still record corruption. The comparison adds no database read and does not change economy grants, expiry or original source metadata. The legacy timestamp fallback remains for operations that fail before a receipt was observed.

Repeated/concurrent replay of an already released receipt retains its identity. Legacy receipts without `replayId` remain supported; malformed replay identities are rejected. Operator guidance is updated in `docs/common/hosted/race-architecture-rollout.md`.

## Verification

- Full isolated Node 22 backend race suite: 1,057 tests across 72 suites passed.
- Coverage: 93.50% statements, 89.67% branches, 96.98% functions and 95.80% lines.
- New regressions cover equal and backwards replay clocks with permanent and transient old failures, followed by genuine current corruption. Existing creator/performance operator replay tests also verify identity creation and stability across concurrent/repeated invocation. Three malformed identity cases were added.
- Backend build/operator safeguards, types, lint, TSDoc, file size, security and scalability checks passed.
- All seven configured isolated client targets built and exact dependency-evidence verification passed.

## Production deployment

The authorized Firebase deployment used a temporary stage containing the exact validated compiled runtime and project-specific environment. Checkout environment files were unchanged. The staged runtime hash is recorded in `artifacts/race-replay-identity/staged-runtime.json`.

Verified ACTIVE Node 22 functions and Cloud Run latest-ready revisions serving 100% traffic:

- `deliverRaceSettlementEvent`: `deliverracesettlementevent-00015-rop`
- `deliverRacePerformanceEvent`: `deliverraceperformanceevent-00015-rig`
- `settleRaceDeadlines`: `settleracedeadlines-00017-zec`

Filtered before/after cloud metadata is saved in the batch artifacts. These are the three deployed callers of the changed delivery operations; the backend-only replay operator is built locally. No operator replay was applied to production data during verification. Jest was not uploaded or published.

## Completion receipt

`artifacts/race-replay-identity/verification-held.json` records focused checks, source hashes, artifact hashes and verified deployment revisions. It is not an accepted full-source dashboard receipt. The 37-check manifest `docs/common/development/development-tasks/race-replay-identity.json` retains all previous recovery and client browser gates. The guarded completion workflow remains deferred until the other E2E chat finishes changing source evidence. No source guard exclusions were added.
