# Skip successor ownership fix

A delayed Skip successor could replace a newer Classic round. After the paid receipt arrived, the same request ID also admitted an unrelated index or game mode and consumed the outstanding successor slot. The original audit reproduced four failures with six passing controls.

Both authoritative successor paths now validate the target against the issued predecessor: Classic mode, exactly the next index, a distinct session, and a current origin or next-index preview. The post-receipt ref retains the predecessor needed for that validation. Invalid replies leave the legitimate outstanding successor admissible. Buffered early replies are checked again when payment settles, so a later round is not replaced by the buffered question. Existing account revocation, duplicate suppression, payment settlement and optional preview requests remain in place.

## Verification

- Ten permanent type-checked hook/reducer/storage tests pass, covering both arrival orders, valid successor/duplicate controls, same-origin targets, wrong index, wrong mode and newer current rounds.
- Twelve artifact diagnostics pass, adding advancement after an early successor has been buffered but before its payment reply.
- Rendered router/recovery/reducer/board verification passes 80 journeys and 544 assertions across Chromium 153 and Firefox 153, development and production, and widths 390/1280. It checks admission, draft preservation, rejection followed by a valid successor, payment settlement, duplicate replies, and absence of automatic gameplay posts or browser errors.
- The identical Chromium development journeys against the original recovery code fail 22 assertions across 20 journeys, including four newer-draft failures and two failures to admit a valid successor after a malformed reply.
- Full client suite: 3,196 tests in 313 suites pass; 96 gated tests in 16 suites skipped. Type checking, TSDoc and file-size checks pass.
- All six isolated target builds and the Devvit server build pass. Archived 1,299 outputs and six dependency inventories; owned temporary build outputs removed.
- All 2,552 selected source/config inputs match the before, terminal and verified manifests. One recovery source file changed and one permanent test file was added relative to the previous verified cohort.

Executable verifiers, logs, screenshots, baseline source, hashes and archived builds are in `artifacts/solo-skip-successor-ownership-fix-2026-10-09/`. All processes completed. No backend or locale files changed and nothing was deployed or published.

These injected tests prove delivery admission and rendered state ownership, not live provider incident rates or cloud latency. They do not establish a complete audit of the speculative preview's own admission rules or all possible Skip rejection races. The broader improvement goal remains active.
