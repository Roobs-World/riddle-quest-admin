# Live stream retention diagnosis

The complete backend SDK cohort is being run against the current concurrency fix with production/test inputs frozen. Separate read-only-stream probes use their own local emulator project and do not touch the integration cohort's data.

Actual installed Admin Firestore SDK observations from isolated compiled current source:

- A valid future ticket timestamp opens the stream and emits the legacy null revision control.
- A missing ticket retention deadline also opens the stream, contradicting the intended retained-ticket boundary.
- A malformed ticket deadline rejects with a generic TypeError instead of the bounded domain rejection used for an expired timestamp.
- A valid owned ticket with a malformed signal deadline throws an uncaught TypeError from the snapshot callback. An instrumented probe captures the exception and aborts its stream; subsequent SDK cleanup fails to finish within the explicit ten-second protocol deadline. A fresh SDK instance is used to delete only the probe's three owned documents.

The first signal probe had no intermediate instrumentation and was stopped after exceeding its intended bounded lifetime; it is not used as proof of the exact failing stage. The instrumented bounded follow-up establishes the uncaught callback exception. Both processes are terminal. This is diagnosis, not fixed behavior.

Next change: require real retained Firestore timestamps at ticket admission and signal projection, with invalid signals producing the safe null revision fallback. Add actual SDK regressions for missing/malformed/expired ticket and signal retention plus normal stream controls. Preserve read-only authority and subscriber cleanup. Do not mutate the source of the still-running complete SDK cohort.

Artifacts: `artifacts/backend-concurrency-current-full-sdk-2026-10-09/stream-*-audit*` and `stream-probe-cleanup.log`.

Implemented and verified locally: `live-stream-retention-fix-2026-10-09.md`.
