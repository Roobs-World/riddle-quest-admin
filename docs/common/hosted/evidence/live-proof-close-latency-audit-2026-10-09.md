# Multiplayer close latency during optional draft recovery

The real `LiveRaceGame` initial acceptance path awaits `draftStorage.restoreWithReceipt` before applying the joined canonical seat. Its optional receipt lookup has a two-second deadline. Closing calls `draftStorage.clear()` (which revokes the recovery generation) and queues leaving, but the in-flight acceptance still waits for that lookup. The existing reload probe manually releases the lookup immediately after close, so it verifies eventual cleanup without proving prompt exit while the optional lookup remains unresolved.

A copied real React/router/transport browser harness now leaves the optional lookup unresolved until after the player returns to the intro. Chromium production observed close latency of 2314.8 ms at width 390 and 2313.6 ms at width 1280. Both journeys preserve cleanup and no-reopening assertions. These are local controlled-adapter UI measurements, not cloud or network latency measurements. No production source was changed in this audit.

The evidence is `artifacts/live-proof-close-latency-audit-2026-10-09/chromium-production/observations.json`. The generated harness has two journeys; its initial stdout inherited the predecessor’s 22-journey label and is not the source for counts. The copied script is corrected to two journeys.

The first copied harness retained the earlier report output path and replaced `artifacts/live-guess-draft-receipt-recovery-2026-10-09/chromium-production/observations.json`. Its new observations were copied into the new audit directory before correction. The original 22-journey harness is being rerun to regenerate that earlier report; this is fresh verification, not recovery of its exact historical bytes. Its log is `earlier-report-regeneration.log` in the new audit directory. Other original engine/mode reports were untouched.

Next: give the optional receipt wait its own cancellation owner, revoke only that wait when close is requested, retain authoritative joined-seat cleanup and leave idempotency, and prove prompt exit plus harmless late proof with the diagnostic harness. Then run relevant close/reload regressions and isolated builds. The broad improvement goal remains active.

The earlier report regeneration completed successfully: 22 Chromium production journeys / 176 checks pass. The refreshed observation file now contains the complete earlier matrix, with provenance recorded here. All audit jobs are terminal.
