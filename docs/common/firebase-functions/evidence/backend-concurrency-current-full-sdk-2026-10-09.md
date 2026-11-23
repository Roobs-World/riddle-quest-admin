# Complete backend concurrency-fix verification

All 91 current integration suites passed all 1,295 SDK tests against real local Firestore, RTDB and Storage emulators on pinned Node 22.23.1. The run completed normally in 617.705 seconds. All 2,525 selected input hashes matched before and after the run. Isolated compilation passed and 398 output files were archived. The owned compilation directory and successful emulator temporary directory were removed; all six listeners were confirmed closed in the host namespace.

This full cohort includes the concurrent-instance receipt recovery fix. It predates the subsequent stream-retention correction; do not treat it as a full post-retention-fix run. Native Firefox MCP 157 separately verified transient consumed-word restoration followed by correct clearing on the second accepted-count observation. That production fixture's deterministic proof release took three milliseconds; actual restored cells were observed before clearing, so a timeout-only result is excluded. The owned tab, two local fixture servers, fake-account checkpoint and scratch roots were cleaned up.

While the full cohort's inputs remained frozen, separate local project probes reproduced missing/malformed stream retention failures. These diagnostic records were removed with a fresh SDK cleanup process; they did not alter integration source or the integration project's records. Diagnosis: `live-stream-retention-audit-2026-10-09.md`.

Artifacts: `artifacts/backend-concurrency-current-full-sdk-2026-10-09/`. No deployment, commit, push or publication was made. These measurements are local test execution, not cloud or player latency.
