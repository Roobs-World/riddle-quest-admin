# Shared game bridge idle work and recovery — 3 October 2026

This pass continues the game reliability, performance, playability, and latency goal. The shared game ready reporter left a 750-millisecond interval allocated after initialization. It skipped sends but continued waking. Readiness callback replacement also recreated the resize observer and emitted an unnecessary ready message; unchanged resize/observer bursts emitted duplicate dimensions. Losing initialization did not send an immediate new ready message until the existing retry cadence reached its next tick.

## Reproduction and change

An injected browser harness mounts the actual `useGameReadyReporter`, uses the native browser ResizeObserver and real viewport changes, and instruments the browser's 750-millisecond intervals. It runs actual development React StrictMode replay and production React separately. The preserved hook-module baseline SHA-256 is `244ba364c61307803e232e4f9fe7c9ce44e95c78027f76f91b460514725fd854`. The recorded baseline produced 31 mismatches among 60 desktop/phone observations.

An initialized baseline woke ten times in 7.5 seconds despite sending no additional ready message. Ten unchanged resize events plus ten observer notifications sent twenty redundant resize messages. Controlled late callbacks from disconnected observers also sent to retired hosts.

Readiness retry and size observation now have independent effect lifetimes. Ready timers exist only while initialization is unacknowledged, keep the existing 750-millisecond retry cadence, and stop after acknowledgment. Losing initialization schedules the next ready signal immediately and restarts exactly one interval using the current callback/host. Both effect retirement and the latest committed initialization state suppress queued old readiness callbacks.

Size observation continues after initialization, survives a readiness-callback replacement, and changes ownership only with its host sender. The current owner sends each distinct rounded viewport size once, including the initial size to a replacement host. Duplicate geometry needs no bridge message or request identity. Retired observer callbacks cannot send after cleanup. Layout waiting, window listeners, native observers, and ready timers are cleaned up on unmount.

No visible copy, provider SDK, server authority, economy grant, or target boundary changed.

## Verification

Evidence is under `artifacts/game-bridge-idle-2026-10-03/`:

- Readiness/resize harness: all 60 observations passed at desktop and phone widths with development StrictMode, and another 60 passed with production React. It verifies initial send and retry cadence, zero initialized interval allocation/wakes, unchanged resize burst suppression, stable profile/readiness callback updates, real viewport dimensions, replacement-host initial geometry, retired observer suppression, immediate initialization-loss recovery, repeated acknowledgment cleanup, unmount, and already-initialized mount. No uncaught browser errors occurred. The fixed idle fixture records zero ready timer wakes over the same 7.5 seconds and zero messages for the unchanged burst.
- Existing single-player recovery browser harness passed at 1280 and 390 pixels, including StrictMode replay, completion acknowledgment/startup reconnect, fresh profile delivery, account retirement, native editing, and unmount ownership.
- Complete hosted production Jest game browser journey passed. It exercises onboarding, navigation, guest progress preservation, Classic/Daily gameplay, rewards, purchase/profile flows, responsive layouts, and accessibility. Controlled held-response observations retained immediate wrong-answer feedback at 2.6 ms and correct-answer feedback at 8.0 ms. These are fixture measurements and do not measure production network latency or a causal speedup from this timer change. The suite ran against the existing verified Jest artifact on a dedicated local port and closed its server/browser. Saved gameplay screenshots were inspected.
- Full portal suite: 277 suites and 2,389 tests passed; 118 opt-in browser tests skipped. All workspace type checks passed.
- All six production target builds and artifact-isolation audits passed. `build-results.json` records exact exits/durations; the final runtime source check matches the tested hook module.
- Final TSDoc audit passed for 23,941 declarations across 1,092 files. File-size audit passed for 1,166 source files. Script syntax and scoped whitespace checks passed. The normal game-browser command includes the readiness harness with both React runtimes.

The measured improvement is reduced local scheduling and duplicate message activity. Battery use, CPU time, production frame rates, and production network latency were not measured. Browser verification used Chromium. Aggregate checks describe the shared checkout, including concurrent changes from other chats. No commit or deployment was performed.

The goal remains active. Next, test `useGameMessageListener` failure ownership: its asynchronous router rejection handlers still call the captured bridge-error sender after listener retirement or replacement. Reproduce late rejection after unmount/provider change while preserving same-origin/source validation and current-message error recovery.
