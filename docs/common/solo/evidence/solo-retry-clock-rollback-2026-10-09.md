# Retained single-player requests survive retry-clock rollback

A queued request used a wall-clock subtraction to decide whether twenty seconds had elapsed. When that clock moved backward, lease recovery succeeded but the retry remained suppressed until the old timestamp plus the retry interval. This could prolong an outage well beyond the intended retry cadence.

The recovery hook now samples the clock once for lease renewal and pacing. A backward sample permits the next eligible same-ID retry, then resets its pacing anchor to that new sample. Ordinary forward-clock retries retain their twenty-second pacing and the existing lease, account, question, lifetime and completion guards. No fresh request ID, extra optimistic guess, purchase grant or visible text is introduced.

The existing repository browser regression now permanently exercises both forward and backward clock paths for queued guesses, hints, Continue and Skip. The existing test:journal-write-work:browser command includes these cases.

## Evidence

The pre-fix injected production Chromium probe failed two retry-delivery assertions at 390 and 1280 pixels: the owned timer acquired its lease but did not renew the retained request. Its durable journal and exact request identity remained intact, isolating retry pacing as the failure.

Final injected browser verification passed 64 journeys / 480 assertions across Chromium 153 and Firefox 153 in development and production React modes at both widths. Normal and rollback variants verify exact-ID retransmission, lease acquisition, durable journal retention, fresh draft cells, duplicate-write suppression, no unhandled rejection/browser errors, and no unexpected external traffic. These fixtures use the real recovery hook, router, reducer and journal with controlled clock signals; they do not measure live cloud latency.

The full client unit suite passed 3,128 tests in 307 suites; 96 browser-gated tests were skipped by the unit command. All six isolated target artifacts plus Devvit passed builds and isolation audits. TSDoc and file-size checks passed. All 2,525 selected source hashes matched before and after verification. Only the recovery hook and its existing browser regression changed.

Archives contain 1,299 built files and six dependency metadata records. Owned build output/metadata were removed after archival; browser harnesses completed their owned context/listener/scratch cleanup. Artifacts and executable verifier: `artifacts/solo-retry-clock-rollback-2026-10-09/`. No deployment, push, commit or publication was made. The broader goal remains active.
