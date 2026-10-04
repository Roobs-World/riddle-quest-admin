# Reddit receipt latency and recovery — 3 October 2026

This pass continues the active multiplayer and single-player reliability, performance, playability, and latency goal. It addresses the remaining Reddit authority-response path discovered while fixing Firebase content ownership.

## Confirmed receipt delivery

Reddit completion and coin spending previously awaited a separate `profile.load` projection after validating the server receipt. A slow projection delayed rewards or paid-action delivery; a rejected projection made a committed action appear to fail. Validated receipts now return immediately while an optional profile refresh runs with its failure handled. Invalid authority responses still reject before starting any projection request.

The injected same-origin browser harness measured five runs per action and viewport with a deliberate 300 ms profile delay. Median completion/spend delivery was approximately 300.3–300.5 ms before the change and 0.1–0.2 ms after it. These are controlled browser-adapter timings, not production network latency. The harness also verifies that profile outages cannot replace a valid completion or spend receipt with an error.

## Profile and content ownership

Each profile request captures an increasing revision. A later requested profile wins even if an older response arrives last; superseded explicit reads return null instead of stale data. Successful account deletion permanently retires that adapter generation, invalidates profile revisions and caches, and keeps subsequent subscribers signed out. Pending content becomes cancellation, and pending committed mutations do not initiate a profile refresh under the retired account.

Authoritative Classic recovery starts a fresh buffer transport rather than sharing an older speculative preload. When a newer confirmed buffer completes first, it wins over an older response delivered later. Normal preloads retain deduplication.

Unavailable Daily responses are no longer retained as a successful preload. Confirmed Daily completion remains cached for the UTC day and produces the typed `daily-completed` routing outcome so the host can load Classic. Current, buffered, and Daily requests now opt in to server-owned purchased hint and accepted guess recovery. The browser mounts the actual React host and game with empty local checkpoints, then verifies a recovered `CRANE` guess, the locked purchased `P` hint, and Daily-to-Classic routing at desktop and phone widths.

## Bounded same-origin transport

`redditGatewayDeadline.ts` shares the existing 15-second platform gateway policy with gameplay and account deletion. Its deadline spans response headers and body decoding, aborts the browser transport, clears settled timers, and consumes late fulfillment or rejection. Expiry returns `deadline-exceeded`; it does not grant coins or certify a mutation's success, and it does not claim cancellation of server work. Existing retryable paid-action delivery keeps the original request ID.

Every browser request remains under `/api/*` with redirect following disabled. Native transport regressions still prove that gateway, gameplay, and deletion calls cannot follow cross-origin or off-route redirects. No Firebase browser SDK or provider SDK was added to the Reddit artifact.

## Evidence and checks

Logs, timing JSON, source hashes, and screenshots are under `artifacts/game-reddit-receipts-2026-10-03/`.

- Twelve corrected baseline regressions failed before the change; one authority-rejection invariant already passed. The baseline used the pre-change adapter with only its type-only import normalized for the isolated test location. Its SHA-256 is `b7cdcead559813234314775526f259d2fccdd0602b3763b946c64f3026b1b540`.
- Focused Reddit delivery, deadline, native redirect, platform bootstrap, and adapter checks: 5 suites, 88 tests passed.
- Full portal unit suite: 271 suites, 2,307 tests passed; 118 opt-in browser tests skipped.
- Injected actual-adapter browser checks passed at 1280 px and 390 px, including controlled expiry and actual React recovery.
- The full injected Reddit production-artifact journey passed, including same-origin authenticated play, current live multiplayer, responsive gameplay, commerce, navigation, and provisional feedback.
- All six production target builds and their isolation audits passed after the runtime changes; exit codes are in `build-results.json`.
- All workspace type checks, maintainable-file-size audit (1,155 source files), TSDoc (23,591 declarations), and whitespace checks passed. The runtime source hashes still matched at verification.

Concurrent chats are editing the shared checkout, so full-suite counts describe the combined checkout at validation time. Existing rematch and multiplayer participation work is not attributed to this pass. Routine TSDoc annotations were added to concurrent match-settlement code and tests to satisfy the shared audit. No deployment was performed. Firefox controls remain unavailable in this chat's exposed tool inventory; browser results use Chromium.

The goal remains active. Next, test whether held Firebase paid-operation transports can retain global activity across retries or account changes, and inspect the resulting retry behavior for duplicate pending work.
