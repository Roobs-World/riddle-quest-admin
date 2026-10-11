# Complete backend receipt cohort baseline

The current 91 Firebase integration suites passed all 1,290 tests using real local Firestore, RTDB and Storage emulators and pinned Node 22.23.1. The run completed normally in 617.939 seconds; emulators reported orderly shutdown. The 2,525 selected input hashes matched before and after the run. Isolated compilation passed; 398 output files were archived and the owned compilation directory was removed.

This establishes the pre-concurrency-fix baseline. It does not prove cloud latency or browser recovery correctness. A separate Chromium/Firefox injected production harness reproduced consumed-word restoration after a second instance accepts a guess while an earlier receipt lookup is pending. That interleaving is absent from this baseline's tests and requires a new regression and fix.

Artifacts: `artifacts/backend-receipt-cohort-full-sdk-2026-10-09/`.
