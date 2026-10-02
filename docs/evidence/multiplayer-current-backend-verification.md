# Current multiplayer backend verification

Verified 2026-10-01 against the current worktree after the recent client recovery and asynchronous delivery changes. The hosted Jest E2E preview and source evidence were left untouched.

## Scope and result

The full configured race coverage suite exercises the pure engine, receipt contracts, provider matchmaking and Firestore transactional integration, including settlement delivery, performance delivery, operator replay, deadlines and queue recovery. The coverage config selects every backend race test and Reddit matchmaking test and measures all production race modules with 90% statement/line and 80% branch/function global gates.

- Node 22.23.1 backend build and operator safeguards passed.
- Backend types and lint passed.
- Shared core: 223 tests in 25 suites passed.
- Backend race coverage: 1,057 tests in 72 suites passed in 211.797 seconds.
- Coverage: statements 93.5%, branches 89.67%, functions 96.98%, lines 95.8%; all configured coverage thresholds passed.
- Before/after hashes matched for 148 backend race, backend race test and shared core race source files.

This verifies current backend behavior; it makes no claim about source outside those hash scopes remaining stable. No production data was accessed or deployment performed. No new backend defect was found in this run.

## Execution recovery

The original Firebase emulator launcher exited with code 143 before producing a Jest result. Process inspection confirmed its Jest process was gone and its test-only Firestore emulator was still live. The interrupted launch was not treated as a passing result. Jest then ran directly with Node 22, the same coverage config and the same isolated emulator, setting the demo project and local Firestore host explicitly. It exited zero with the complete test and coverage result. The emulator process started by this verification was stopped afterward. The initial launch log is retained separately from the successful direct-run log; the cause of termination is not established.

Logs, exact coverage summary, source snapshots and focused proof are in `artifacts/race-current-backend-verification/`. The latest client proof at `artifacts/race-analytics-delivery-isolation/verification-held.json` links this backend audit. The existing 46-check manifest still requires its guarded full-source completion run; this focused audit does not create an accepted dashboard receipt or weaken the source-stability guard. Automatic dashboard recording remains pending while the other chat changes its hosted pathway evidence. Jest remains unpublished, and the multiplayer reliability audit remains active.
