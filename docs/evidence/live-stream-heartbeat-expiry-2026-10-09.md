# Expired cached stream revisions select polling fallback

A valid notification revision was checked only when its Firestore snapshot arrived. Without another write, subsequent heartbeats kept repeating the cached revision after its deadline. The client therefore continued to treat the stream as healthy and kept its slower reconciliation cadence.

The stream now captures each revision with its private expiration deadline and checks that deadline immediately before calling sendChunk. An expired cached revision produces the existing null-revision fallback. The private deadline is never sent to the browser. No additional timer, read, write, lease, score or economy mutation was added; ordered delivery and existing cleanup remain in place.

## Verification

The new actual SDK regression first observes a valid revision whose deadline expires two seconds later. Without another database write, it waits for the real ten-second heartbeat, expects null revision, and verifies the signal document's update timestamp is unchanged. The pre-fix run failed that bounded fallback assertion with 12 other tests passing. The final run passed all 13 stream SDK tests, including retention, ownership, deletion, duplicate-command and normal notification controls. These are actual local Firestore/RTDB/Storage emulator tests on pinned Node 22.23.1, not mocked snapshot delivery.

The full backend unit suite passed 1,769 tests in 141 suites. Client notification/reconnect/subscription/poll tests passed 25 tests in four suites. Isolated backend compilation passed. All six isolated target artifacts and Devvit passed their builds and isolation audits. TSDoc and file-size audits passed.

All 2,525 selected source inputs matched before and after verification. This change affects only raceLiveStream.ts and its existing SDK test file; client inputs are identical to the previously verified browser and rendered-target cohort. Output archives contain 1,299 built files, 398 compiled files and six dependency metadata records. The red-run emulator scratch was archived before removal; successful scratch and owned build/compile roots were removed. All six emulator listeners were verified closed in the host namespace.

Artifacts and executable verifier: `artifacts/live-stream-heartbeat-expiry-2026-10-09/`. The 13-test focused SDK run does not constitute a new full backend integration run; the preceding full 91-suite evidence predates the two stream-retention follow-ups. No deployment, push, commit or publication was made. The wider improvement goal remains active.
