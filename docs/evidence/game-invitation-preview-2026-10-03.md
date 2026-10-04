# Invitation preview ownership and dispatch — 3 October 2026

This pass continues the game reliability, performance, playability, and latency goal. Launch invitation effects queued their transport read before checking retirement, so StrictMode replay dispatched duplicate reads and a quick close still dispatched unused work. Cached inbox previews also copied data through an asynchronous effect. A replacement render could commit an old acceptance control before its passive effect cleared the old preview, and Retry on malformed cached data kept revalidating that same malformed value.

## Reproduction and change

The actual React `LiveRaceInvitationCard` is mounted with controlled authority promises, real schemas, and the actual race styles. The preserved baseline SHA-256 is `9e87c87ba36f3b76c9792ae7607a4e226a171d75e459881db642ed7cf1a7fe8b`. Actual development StrictMode replay produced 16 mismatches among 54 desktop/phone observations. Commit-time probes detected stale acceptance controls after transport, callback, or selector replacement and after a fresh unavailable inbox receipt. The main entry already keys normal account/language changes and launch-ID changes; this pass strengthens the preview's own boundary, including same-ID transport changes and refreshed cached receipts.

Each preview now owns its exact selector, transport, read callback, and cached-versus-launch path. Replacement creates a fresh panel before any passive effect can publish old state. Acceptance always uses the complete validated server receipt, including its matching challenge ID, category, and language.

SDK launch reads capture their callback and check retirement inside the queued microtask before dispatch. StrictMode replay now sends one request, and closing before dispatch sends none. Current reads retain the existing eight-second retry deadline, strict schema/selector validation, late-result suppression, and cleanup.

Inbox-supplied previews are validated during render and memoized by their receipt/selector. They need no read timer, request, or effect that copies the receipt into presentation state. A refreshed unavailable receipt removes acceptance in its first commit; a refreshed available receipt uses its new canonical category while preserving keyboard focus. Explicit Retry on malformed cached data switches that exact receipt to a bounded canonical server read. A newer cached authority receipt supersedes this recovery immediately, clears its deadline, and cannot be overwritten by its late response.

All visible notices reuse existing translated keys. No backend invitation authority, provider SDK, purchase/referral grant, or target boundary changed. The React checklist was applied to validation during rendering, derived presentation, owned effects, preserved focus, and avoidance of additional inbox-preview requests.

## Verification

Evidence is under `artifacts/game-invitation-preview-2026-10-03/`:

- Final preview browser harness: all 66 observations passed at 1280 and 390 pixels with actual development StrictMode replay, and another 66 passed with production React. Checks include exact acceptance data, duplicate-read suppression, retirement before dispatch, commit-time ownership replacement, late retired data, timer-free cached previews, immediate unavailable status, malformed-cache recovery, cached receipt supersession of a pending recovery, deadline cleanup, keyboard focus, refreshed canonical category, all authority statuses, locale mismatch, stalled-read retry, mismatched receipts, and unmount/rejection cleanup. No uncaught browser errors occurred. Controls fit both widths and remain at least 48 pixels high; screenshots were inspected.
- Existing inbox harness: all 100 observations passed across development/production and both widths. It still proves owned transport replacement, no acceptance of retired rows, coalesced immediate notification refresh, bounded retry, interval/timer/event cleanup, and absence of preview fan-out.
- Complete real-authority invitation journeys passed for Jest, Facebook invite, and Facebook share at both widths, including native dismissal/failure retry, durable inbox reload, permission fallback/revocation, explicit original-lobby acceptance, countdown, shared gameplay, and unsupported-native-host omission. The backend was freshly built before the dedicated `demo-game-live-invite-goal` Firestore emulator run. The process exited zero and shut down. Provider dialogs/permissions are injected fixtures; no production player was contacted.
- Full portal suite: 275 suites and 2,364 tests passed; 118 opt-in browser tests skipped. All workspace type checks and the backend build passed.
- All six production target builds and artifact-isolation audits passed. `build-results.json` records their exact exits and durations. The final source check matches the component hashes used by those builds.
- TSDoc audit passed for 23,866 declarations across 1,090 files. File-size audit passed for 1,164 source files. Script syntax and scoped whitespace checks passed. The normal game-browser command now includes the preview harness in both React runtimes.

The request/timer reductions and immediate cached rendering are verified local behavior, not a measured production network-latency claim. Browser checks used Chromium. Aggregate checks describe the shared checkout, including concurrent changes from other chats. No commit or deployment was performed.

The goal remains active. Next, inspect the shared single-player bridge ready reporter: `useGameReadyReporter` leaves a 750-millisecond interval allocated after initialization and merely skips its send. Reproduce idle timer wakes and verify that separating readiness retry from size observation can stop them while preserving reinitialization recovery and resize reporting.
