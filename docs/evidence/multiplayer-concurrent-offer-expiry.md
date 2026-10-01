# Concurrent offer expiry

A real Firestore emulator reproduction inserts an expired receipt after the lookup sees no receipt but before canonical inspection and offer commit. Before the fix, lookup returned matched and overwrote the expired receipt with a new lifetime. Direct retries already rejected expiry; the transactional concurrent-winner path lacked that check.

The committing transaction now rejects an existing receipt with expiresAtMs <= request nowMs after ownership, acceptance and preference validation. It returns the existing intent-expired/new-intent recovery contract and performs no receipt write. The test matrix covers exact expiry and one millisecond beyond expiry, asserting the stored expired document remains byte-for-field unchanged. Healthy concurrent winners and ordinary retry behavior are covered by the existing matchmaking suite. Request time semantics remain unchanged; this fix does not claim a wall-clock deadline recheck after every network operation.

The pre-fix reproduction failed because the promise resolved with matched. After the fix, the full focused matchmaking suite passed 39 tests; the expanded two-boundary matrix is included in the final completion gate. No visible text or locale edits are needed.

The development task verifies full backend coverage, client/core regressions, seven isolated artifacts, dependency/security checks and existing desktop/mobile discovery UI harnesses. Those browser checks cover client compatibility; the Firestore emulator is the evidence for the server transaction race. Completion is recorded only after current source and artifact verification. Jest activation remains authorized, publication and review remain held. Firebase Functions deployment is authorized but this run does not deploy.
