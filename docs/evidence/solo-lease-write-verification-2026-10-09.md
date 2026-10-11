# Exact lease renewal precedes single-player command delivery

Lease verification previously checked only the owner name after writing. Fault injection showed that an expired record with the same owner could be mistaken for a renewed lease if a writer silently discarded the update. A different stored deadline with the same owner was also accepted. These checks concern the persistence failure boundary; they do not assert that ordinary standards-compliant localStorage silently drops writes.

Acquisition now succeeds only if reading storage returns the exact newly written owner/deadline record. Failed renewal leaves the existing command identity intact. The preceding invalid-lease recovery and ordinary cross-tab lease controls remain in place. No new command, retry identifier, provider call, economy grant or visible text was introduced.

## Verification

Two meaningful storage-fault regressions failed before the correction with 59 journal controls passing. Final focused journal/recovery tests passed 63 cases. The full client unit suite passed 3,128 tests in 307 suites, with 96 browser-gated tests skipped by that unit command.

Injected production Chromium 153 and Firefox 153 harnesses passed 20 journeys / 172 assertions at 390 and 1280 pixels. Sixteen compatibility journeys cover queued guesses, hints, Continue, Skip, exact-request retries, fresh durable draft letters and duplicate-write suppression. Four additional fault journeys inject a silently discarded renewal into the actual recovery hook after its initial command has been queued and sent. They verify no retransmission while renewal fails, the unchanged durable request identity, and exactly one same-ID retry after persistence recovers. Browser error, unhandled rejection and unexpected external-request checks passed.

The first fault fixture injected failure before queue admission, then incorrectly waited for a retry interval that should not exist. Those attempts timed out and are retained as setup diagnostics. The corrected fixture tests an already queued command; its results are counted separately from the unsuccessful setup attempts. Production source was unchanged during the correction.

All six isolated target builds plus Devvit passed their audits. TSDoc and file-size checks passed. All 2,525 selected source hashes match before and after verification; only pendingGuessJournal.ts and its existing tests changed. Archives contain 1,299 output files and six dependency metadata records. Owned build output and metadata were archived and removed; browser finally blocks closed owned contexts/listeners and removed scratch roots on both failed setup and successful runs.

Artifacts and executable verifier: `artifacts/solo-lease-write-verification-2026-10-09/`. This is local injected persistence/recovery evidence, not payment-provider or cloud-latency measurement. No deployment, push, commit or publication was made. The broader goal remains active.
