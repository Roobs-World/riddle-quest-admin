# Journal artifact browser verification

**Local compiled-artifact checks PASS.** No local checks remain pending. Hosted real-service startup is a separate release gate; root reported HTTP 500 at 21:50:12 UTC, so these local results do not clear activation.

| Verification | Final result |
| --- | --- |
| Retained browser suites | 8 suites / 79 tests passed; 0 failed or skipped; 327.470 seconds |
| Fresh bounded navigation | 3 graph entries / 337 routes passed; 0 problems or queued branches left; 1353.645 seconds |
| Daily entry | 89 routes / 21 screens |
| Classic entry | 81 routes / 20 screens |
| Multiplayer entry | 167 routes / 36 screens |
| Instructions modal | All 16 locales × 3 viewports = 48 combinations inside 3 retained Jest cases |

Both plain and hinted immediate-reload regressions pass, including six immediate reload transitions per case. Instructions checks cover 402×682, 320×568 and 390×844 with visible content/action and no internal scrolling.

The navigation walker ran fresh on this same journal artifact, not the old baseline. It uses real controls in isolated browser contexts, with depth limits 3 / 3 / 5 and a 400-route cap per entry. It does not enumerate every possible answer or storage state. The retained suites cover gameplay, authentication, purchase/recovery mocks, rewards, profile/settings, layouts, music and reload flows.

Final retained results: `retained-rerun/retained-browser-results.json` and `retained-rerun/verification-summary.json`. Navigation: `route-sweep-results.json`, `route-matrix.json`, `route-progress.jsonl` and `route-sweep.log`.

The first full retained run remains preserved: 76 passed / 3 failed. Its three stale assertions demanded deletion of every pending-play record, including intentional settled drafts. A coordinated test-only change requires all queued/paid work settled and still checks exact draft/cursor, Continue state, locked hint, wallet, one request and duplicate-result safety. The full eight-suite rerun then passed on unchanged runtime bytes. See `first-run-resolution.json` and `retained-rerun/source-proof.json`. This is a complete green full run, not a union of partial reruns.

Exact snapshot: `artifacts/jest-e2e-2026-10-22/jest-artifact-journal`, 419 files / 4,718,293 bytes. Manifest SHA-256: `167abd7241f1851fa4125c0f0ba2fb88f4ac5aa562e80e84cdbc83880ef685ae`. All artifact hashes match before and after all verification. The full set and hashes of 369 runtime-source files are unchanged; all 9 frozen test-source hashes also match after completion. `artifact-integrity.json` records the checks.

Final screenshots are under `retained-rerun/retained-screenshots/`, including `jest-feedback-victory.png`, `jest-feedback-loss.png`, `jest-feedback-profile.png`, `riddle-settings-subscription.png`, `daily-skip-warning/warning-390.png` and `coin-economy/shop-390.png`. All 12 shared screenshot paths used by the rerun were restored byte-for-byte (`retained-rerun/retained-output-restoration.json`). Whole directories were archived, so their file count is not a count of new screenshots.

Providers are mocked in these local suites. No real charges, SMS, terms acceptance or account deletion occurred. This runner made no production edits, rebuilds, uploads or activation changes. Root owns hosted verification and its separate service failure diagnosis.
