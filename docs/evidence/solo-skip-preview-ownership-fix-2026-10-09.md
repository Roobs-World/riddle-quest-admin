# Verified durable Skip preview ownership

Skip preview replies previously accepted foreign indices and modes or replaced a newer round. Rejection could roll an independently loaded round back to the paid origin. An initial implementation also retained rejected preview drafts in storage. The original eight-case audit had five failures; the durable draft regression was independently reproduced before its fix.

The pending journal now records the exact admitted speculative session, bound to its paid Skip and issued origin. Preview admission validates the next Classic index and current ownership and requires successful persistence. Malformed optional ownership is discarded without dropping the paid request. Rejection restores only the origin or its explicitly owned preview, removes that speculative segment and its queued deliveries, and preserves unrelated future data. An authoritative successor retires speculative rollback ownership before admission.

## Verification

- Eleven permanent ownership cases plus successor/journal coverage: 84 focused tests pass. Cold mounting proves durable ownership restores a preview without its original in-memory ref. Malformed ownership and failed-write admission controls pass.
- Twelve artifact diagnostics pass, including a rejected preview removed while an unrelated index-3 draft and its journal remain intact.
- Rendered browser verification: 72 journeys and 368 assertions pass across Chromium 153 and Firefox 153, development and production, and widths 390/1280. Coverage includes hot and cold rejection, independently loaded and later rounds, authoritative supersession, revoked accounts, failed writes, and wrong-index/wrong-mode replies followed by valid delivery. Receipt-specific routing waits ensure assertions observe the delivered rejection. Initial runs with a weaker routing wait are archived separately.
- Full portal suite: 3,207 tests in 314 suites pass; 96 gated tests in 16 suites skipped. Type checking, TSDoc and file-size audits pass.
- All six isolated target builds and the Devvit server build pass. Archived 1,299 output files and six dependency inventories; owned temporary outputs removed.
- All 2,553 selected source/config inputs match before, terminal and verified manifests. Two portal source files changed and one permanent test file was added relative to the previous verified cohort.

Executable verifiers, logs, screenshots, source hashes and archived outputs are in `artifacts/solo-skip-preview-ownership-fix-2026-10-09/`. All processes finished. Earlier implementation checkpoints are superseded by these verification results. No backend or locale code changed and nothing was deployed or published.

These are local and injected-host delivery tests, not deployed provider transactions or player-latency measurements. They do not establish a complete audit of every paid-action delivery race. The broader improvement goal remains active.
