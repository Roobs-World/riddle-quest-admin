# Native tournament share preparation recovery

Verified on 8 October 2026. This continues the multiplayer and single-player reliability goal; the goal remains active.

## Result

A stalled authoritative standings read or native tournament metadata lookup previously held the shared Facebook SDK dialog gate indefinitely. Tournament sharing now gives those two preparation stages one eight-second local budget. Expired preparation returns a contained retryable failure, releases the gate, and cannot later open a stale native share or creation dialog. Original read promises remain observed after local expiry.

The timer ends before a native share/create dialog is admitted. An admitted SDK dialog retains the gate until its original promise settles, including cancellation and failure. A throwing optional diagnostic callback cannot replace the contained provider outcome. No economy grants, rankings, authoritative receipts, visible copy, or other target SDK behavior were changed by this fix.

The browser regression is registered as `test:live-tournament-share-preparation:browser` and included in `test:game-browser:playwright`.

## Verification

- Focused Facebook adapter tests: 36 passed across two suites.
- Current portal unit suite: 2,983 passed; 96 skipped across 16 suites.
- New Chromium 153 and Firefox 153 probes, development and production: 180 scenarios and 2,964 assertions passed.
- Adjacent tournament metadata recovery and share ownership probes: 168 scenarios and 2,916 assertions passed. Combined: 348 scenarios, 5,880 assertions, with screenshots and no harness-reported browser errors, unhandled rejections, or external provider traffic.
- Injecting the original adapter into the current minimized harness reproduces 15 failing assertions. The retained earlier red runs also cover production.
- Fresh built Jest/Reddit journeys: 22 passed; fresh Facebook browser fixture: one passed, including rendered HTML and automated accessibility checks.
- All six isolated client builds and the Devvit server build passed. YouTube used the incomplete-content fixture build; this does not establish partner release readiness.
- Types, TSDoc, source-size, locale, target isolation, license, artifact and security audits passed.
- Preserved 1,301 built files with SHA-256 hashes and seven dependency inventories. Removed only the exact task-owned build root and preserved inventory originals.

Firefox MCP also connected successfully to Firefox 157. The game matrix above used the native Playwright Firefox 153 executable; MCP connectivity is not claimed as game-flow coverage.

## Checkout reconciliation and limits

The checkout changed between the original 6 October baseline and this resumed verification. `checkout-reconciliation.json` records those changes without reverting them. The original source snapshot is preserved; the resumed immutable snapshot contains 2,475 selected inputs. Current source hashes matched after builds and after cleanup.

Backend production source and tests also changed outside this fix. Accordingly, older backend/core authority evidence is not reused as proof of the current checkout. This pass establishes the client fix and current client artifact verification; it does not certify those independent backend changes. No deployment, publication, push, or commit was performed.

The SDK reads are not remotely cancelled. Their late settlements stay observed and cannot continue into an expired share operation. The deadline is local preparation recovery, not a measured improvement to server round-trip time.

## Retained evidence

Evidence root: `artifacts/live-tournament-share-preparation-2026-10-06/` (original start date retained).

Run from the repository root:

```sh
python3 artifacts/live-tournament-share-preparation-2026-10-06/verify-current.py
```

The verifier checks the current source snapshot, browser observations and screenshots, reproduced red assertion count, unit and artifact test summaries, six build completions, preserved build hashes, and exact cleanup records. `verification-current-summary.json` explicitly records that authority evidence was not reused and the broader goal is unfinished.

## Next investigation

Check whether leaving the tournament board while preparation is pending can still open a native dialog before the eight-second budget expires. Any change must first reproduce that journey, cancel preparation on committed retirement, and retain the original SDK dialog gate once native UI has been admitted.
