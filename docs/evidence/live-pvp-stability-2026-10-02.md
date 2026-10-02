# Live PvP stability and responsiveness — 2026-10-02

The live multiplayer flow keeps matchmaking, issued questions, answer evaluation, scores, bot progress, winner selection and the 50-coin grant on the game server. The browser renders confirmed snapshots, preserves typed input and sends owned commands. It cannot supply scores, a winner, currency, identity or a start timestamp. Live responses remain answer-free.

## Reproduced problems and fixes

- A stalled background poll delayed a player answer by approximately two seconds. Commands now supersede background observations immediately, while receipt ownership prevents a late poll result or error from replacing the accepted command. The injected desktop/mobile tests measure 100–101 ms from beginning answer input to displaying server-confirmed progress; this is a local harness measurement, not a production latency guarantee.
- Ordinary match polls rewrote the shared match and ticket. Steady human observations are now read-only; bot observations write only when its score changes. The first observed transition from countdown to gameplay remains durable, as do mutations, privacy changes, timeout decisions and reward settlement. Polls therefore preserve server authority without repeatedly rewriting unchanged gameplay state.
- Offline polling continued every second. Background failures now back off for two, four and eight seconds, with an eight-second cap. Online and foreground events reconcile immediately. Physical keyboard input remains usable after a background failure and survives recovery. Uncertain mutations retain their request IDs and stay blocked until reconciled.
- A question advanced by another tab could leave the first tab stuck retrying an obsolete command. Definitive `invalid-argument` and `failed-precondition` server rejections retire that unaccepted command and fetch current authority before another mutation is allowed. Unknown delivery, timeout, quota and permission errors retain the original command instead of assuming it was rejected. Reddit preserves safe rejection categories through its authenticated same-origin gateway without exposing exception details, identities or answers.
- Countdown and gameplay animation stop updating after terminal results; existing monotonic countdown and account-lifetime cleanup remain intact.

## Verification

Evidence and before-change source snapshots are retained in `artifacts/live-pvp-stability/`.

| Check | Result |
| --- | --- |
| Stalled-poll baseline | Failed at 2,001 ms; fixed desktop/mobile delivery checks pass at 101 ms |
| Offline-poll baseline | Failed with seven requests; fixed checks observe two during the same outage window |
| Stale-question baseline | Timed out while waiting for reconciliation; fixed desktop/mobile checks pass |
| Late poll response and late poll failure | Cannot rewind a newly confirmed answer or reopen an error |
| Accepted answer with a lost response | Reconnect retries the same command ID and scores once |
| Firestore concurrency and authority | 21 integration tests pass, including 20 concurrent observations with an answer, simultaneous finishes, one reward, wrong guesses, skips, bot boundaries, clock correction and recovered seats |
| Actual authority with two browser players | Desktop/mobile lobby, shared countdown, live opponent scores, immediate victory and stored balances of 150/100 pass against the demo Firestore emulator |
| Both players reload after catalog removal | Recover the immutable match and settle exactly one 50-coin reward |
| Account lifetime and clock faults | Ten desktop/mobile unmount and forward/backward device-clock cases pass |
| Forged client authority | 16 core schema tests pass, including rejection of client-supplied score, winner, currency, identity and timestamps |
| Client regression checks | 87 tests pass |
| Backend regression checks | 69 tests pass |
| Isolated artifacts | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo builds and artifact audits pass |
| Trusted services | Firebase Functions build and lint, portal/backend types, Devvit package build and validation pass |
| Maintenance gates | Source size, backend scalability and changed-file TSDoc pass |

The full repository TSDoc gate still reports 27 declarations in unrelated pending classic supply-worker work. Its output is retained; those files were not changed for this stability work.

## Reproduction

```sh
# Stalled requests, response ordering and reconnect reconciliation:
node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# Outage backoff and draft preservation:
LIVE_RACE_BACKOFF_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# A question advanced by another tab:
LIVE_RACE_REJECTION_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# Real authority, two browser players, reload recovery and server concurrency:
pnpm --dir firebase-functions build
LIVE_RACE_USE_EMULATOR=1 pnpm --dir firebase-functions exec firebase emulators:exec --only firestore --project demo-riddle-quest-live-stability 'node ../packages/portal/scripts/verify-live-race-browser.mjs && node ../packages/portal/scripts/verify-live-race-seat-recovery-browser.mjs && pnpm exec jest --config jest.config.js --testMatch "**/raceLive.it.test.ts" --runInBand'
```

These changes are verified locally and have not been deployed. Actual production latency depends on the provider gateway, network and service region. Progress observations remain approximately one second apart in normal operation; answer commands begin immediately and require server confirmation.
