# Live invitation inbox ownership and refresh — 3 October 2026

This pass continues the game reliability, performance, playability, and latency goal. The main game already remounts its multiplayer entry when account ownership changes. The inbox had a separate transport-replacement gap: previously rendered invitation rows and read failures remained visible until a replacement read completed. A changed inbox callback on the same transport object did not start a replacement read. Pending inbox reads also dropped focus/notification refresh events until the next 15-second poll, and their local deadline timers survived unmount.

## Reproduction and change

The actual `LiveRaceInbox` and `LiveRaceInvitationCard` run in an injected browser harness with strict authority schemas, controlled provider promises, and the actual race styles. The preserved inbox baseline SHA-256 is `2d4856122119fa0cf11fb010e23fb3f32dd02dcd9ac05ddc52906584254f6971`. With actual development React StrictMode effect replay, the baseline produced 16 mismatches among 48 observations across desktop and phone widths. Old invitation cards remained visible and their acceptance callback could select the retired transport's invitation while the replacement read stalled.

A transport or inbox-callback replacement now owns a fresh panel lifetime. Its first render contains no retired cards or failure notice, and old reads cannot populate that replacement. Profile updates and launch-exclusion changes retain the same owned rows without another authority request. Existing locale filtering, strict validation, deduplication, and the inbox's preview data remain intact; cards still make no additional challenge-preview requests.

Focus and invitation-change events during a pending read retain one follow-up refresh. It runs immediately after that read settles rather than waiting for another poll. Bursts coalesce into one follow-up and never overlap the active observer's read. Manual Retry shares the same synchronous exclusion and no longer replaces the entire effect/listener lifetime; a burst admits one request.

Retirement releases the current local promise race, clears its eight-second deadline, and removes its interval/event listeners. The underlying provider promise remains observed, so late fulfillment or rejection cannot escape or restore old presentation. A stalled current read still exposes the existing translated Retry/error flow after eight seconds. No backend invitation authority, provider SDK, economy logic, target boundary, or visible locale key changed.

## Verification

Evidence is under `artifacts/game-live-inbox-2026-10-03/`:

- Final inbox browser checks: 50 observations passed at 1280 and 390 pixels with development React StrictMode effect replay, and another 50 passed with production React. The harness explicitly verifies the expected initial effect-replay read count rather than assuming that a StrictMode wrapper causes replay in a production bundle.
- Checks cover transport/callback replacement, removal of inherited failures, late retired receipts, prevention of retired-card acceptance, exact fresh invitation acceptance, cleanup of deadline timers/interval/events, coalesced notification bursts, immediate follow-up delivery, bounded stalled-read retry, manual retry exclusion, locale filtering, deduplication, profile/exclusion rerenders without extra reads, malformed authority data, and absence of preview fan-out. No uncaught browser errors occurred. Saved controls fit both widths and are at least 48 pixels high; screenshots were inspected.
- Complete real-authority invitation journeys passed for Jest, Facebook invite, and Facebook share at both widths. They exercise native dismissal/failure retry, durable inbox reload, push permission fallback/revocation, explicit acceptance into the original lobby, countdown, shared gameplay, and omission on unsupported native hosts. The backend was freshly built before running the dedicated `demo-game-live-invite-goal` Firestore emulator. The process exited zero and shut down its emulator. Native SDK dialogs and permission responses are fixtures; no production player was contacted.
- Full portal suite: 275 suites and 2,364 tests passed; 118 opt-in browser tests skipped. All workspace type checks and the backend build passed.
- All six production target builds and artifact-isolation audits passed. Exact exit codes and durations are saved in `build-results.json`; the final source check matches the component hashes used by those builds.
- TSDoc audit passed for 23,857 declarations across 1,090 files. File-size audit passed for 1,164 source files. Script syntax and scoped whitespace checks passed. The normal game-browser command now runs the inbox harness with both React runtimes.

The immediate follow-up removes an avoidable polling delay in the reproduced fixture; it does not establish a production network-latency measurement. Browser verification used Chromium. Aggregate checks include concurrent shared-checkout changes from other chats. No commit or deployment was performed.

The goal remains active. Next, inspect launch invitation previews in `LiveRaceInvitationCard`: verify ownership during transport replacement and whether StrictMode retirement before its queued microtask still dispatches an unnecessary authority read. Preserve the already keyed account/language entry and the server's explicit acceptance contract.
