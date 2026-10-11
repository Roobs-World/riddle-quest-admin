# Single-player delivery recovers from invalid short leases

Single-player pending commands could remain stuck when local storage contained malformed lease JSON, a coerced string deadline such as Infinity, a far-future deadline, or an invalid owner. A backward browser wall-clock change could also stretch the intended fifteen-second foreign lease into a much longer wait.

Lease acquisition now bounds parsing to a small record, treats malformed bytes as having no valid owner, and respects a foreign owner only when its deadline is a genuine safe integer within the next fifteen seconds and its owner is a nonempty string. Actual storage read/write failures still fail acquisition. Normal cross-tab ownership and expiry remain covered by existing controls. The durable pending journal, submitted command, exact retry request ID and server-authoritative grant path are unchanged. After clock rollback, the pending command retains its original idempotent request identity instead of waiting for an old wall-clock deadline.

## Verification

Six new regressions failed before the fix with 53 existing journal tests passing. They cover malformed JSON, Infinity, an unbounded numeric future deadline, coerced numeric text, invalid owner type and clock rollback. The final focused journal/recovery suite passed 61 tests. The full client suite passed 3,126 tests in 307 suites; 96 browser-gated tests were skipped by that unit command.

Injected production React harnesses passed 16 journeys / 120 assertions across Chromium 153 and Firefox 153 at 390 and 1280 pixels. Real router/reducer/journal flows recover queued guesses, hints, Continue and Skip from poisoned lease records. Checks verify exact-request retransmission, durable fresh draft letters, appropriate duplicate-write suppression, retained journal ownership, no unexpected external requests, and no browser errors or unhandled rejections. This is injected client recovery evidence, not real payment-provider or cloud-latency measurement.

All six isolated target artifacts plus Devvit passed builds and target isolation audits. TSDoc and file-size checks passed. All 2,525 selected source hashes match before and after verification; only pendingGuessJournal.ts and its existing test file changed. Output archives contain 1,299 built files and six dependency metadata records. Owned build output and metadata were removed after archival; browser harness finally blocks closed their owned contexts/servers and removed scratch roots.

Artifacts, pre-fix source archive and executable verifier: `artifacts/solo-pending-lease-recovery-2026-10-09/`. No deployment, push, commit or publication was made. The broader improvement goal remains active.
