# Failed checkpoint candidate browser verification

**This candidate is not verified for activation.** The retained run completed once, without retries: **77 passed / 2 failed / 0 skipped** across **7 passed suites / 1 failed suite**, 310.615 seconds, exit 1.

Both new immediate-reload cases failed: `keeps the final visible draft letter through immediate reload (hinted=false)` and `(hinted=true)`. After visible `PIA`, reload restored `PI`; the assertion at `queuedCoinActions.jest-playwright.test.ts:84` timed out after five seconds. The other 77 retained checks passed. See `retained-browser.log`, `retained-browser-results.json` and `verification-summary.json` for the exact stacks and statuses.

Exact tested snapshot: `artifacts/jest-e2e-2026-10-22/jest-artifact-final`, 419 files / 4,717,654 bytes. Manifest SHA-256: `0d0ebc9738b221194f387df5566135c7ef5b1322fdd96352164df6d587107d04`. All file hashes match before and after the run (`artifact-integrity.json`). These bytes are the insufficient layout-effect-only candidate, despite the historical directory name.

No production edits, rebuild, upload or provider writes were performed by this runner. The original navigation baseline remains independently green at 337 routes in `../browser-retained/baseline-summary.md`; it is not rerun or recounted here. Frontend owns the downstream save/unload fix and root owns the next immutable artifact.

Shared screenshot paths were copied to `retained-screenshots/` and all 10 original paths restored byte-for-byte (`retained-output-restoration.json`). The retained cases do not capture a failure screenshot for this draft assertion; the exact expected/received text and stack are preserved in the log and JSON, with independent mobile failure evidence under `../mobile-final/`.
