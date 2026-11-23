# Safe retained live observation streams

Missing ticket deadlines previously admitted a live stream; malformed deadlines threw generic TypeErrors. A malformed signal deadline also threw an uncaught TypeError inside the actual Firestore snapshot callback and prevented its original SDK cleanup from completing. The isolated diagnosis is recorded in `live-stream-retention-audit-2026-10-09.md`.

Ticket admission now requires a real future Firestore Timestamp and rejects missing, malformed or expired retention with the existing not-found domain error. Signal projection checks the timestamp type before invoking its methods. Missing, malformed, scalar or expired signal deadlines now emit the existing null revision fallback, so the client retains fast polling. A later healthy notification still wakes the same surviving listener. Observation remains read-only; no match, score, economy, heartbeat or lease write was added.

## Evidence

- Red actual SDK regressions: two failures and six passing controls across eight tests. Missing and malformed ticket retention failed the intended bounded-domain-rejection assertions.
- Final actual SDK suite: all 12 stream tests passed, including seven new retention cases. Each invalid ticket is rejected before any chunk with its record update timestamp unchanged. Each invalid signal emits a null revision without rewriting its record, then delivers a subsequent valid revision through the same listener. Existing tests cover ownership, deletion, private matching, server-only records, duplicate commands and unchanged polls. Each admitted test stream aborts and awaits cleanup.
- Backend unit suite: 1,769 passed in 141 suites. Client stream/reconnect/poll tests: 22 passed. Isolated compilation on pinned Node 22.23.1 passed with 398 archived output files.
- All six target builds and Devvit passed with their isolation audits, producing 1,299 archived files and six dependency metadata records. The client source is unchanged by this backend follow-up; the preceding Chromium/Firefox injected and rendered-target verification continues to describe those identical client inputs.
- TSDoc and file-size checks passed after one test field comment was repaired. The exact final SDK tests and compilation were rerun after that documentation-only repair. All 2,525 final selected source hashes match the frozen inputs; the previous full cohort differs only in `raceLiveStream.ts` and its existing SDK test file.
- The immediately preceding complete backend run passed 1,295 tests in 91 suites and includes the concurrency recovery fix. It predates this retention change. This retention follow-up uses the actual focused stream suite and the full backend unit suite; no post-retention full SDK claim is made.
- All owned outputs and metadata were archived and removed. Failed red-run emulator scratch was explicitly archived before removal; successful emulator scratch was already removed by the runner. The six final emulator listeners were verified closed in the host namespace. Separate diagnostic documents were removed and confirmed absent with a fresh SDK instance.

Artifacts and executable verifier: `artifacts/live-stream-retention-fix-2026-10-09/`. No deployment, push, commit or publication was made. The broader improvement goal remains active.
