# Live PvP command recovery — 2026-10-02

This follow-up prevents a transport timeout from leaving the live riddle board locked until the player manually retries. Matchmaking, questions, answer validation, progress, winner selection and the 50-coin grant remain server-authoritative and answer-free at the browser boundary.

## Reproduced failures

The injected browser harness drives the real `RaceTo10Game` and `LiveRaceGame` components with controlled transport failures. The saved pre-change component reproduces both problems:

- An answer accepted by the authority arrives just after the ten-second delivery deadline. The browser ignores that still-owned reply, leaving the pending answer and error visible. The one-second recovery assertion fails.
- An accepted answer's reply is lost entirely. The browser excludes pending commands from periodic delivery, so it never retries without a manual Retry click or a reconnect event. The fifteen-second automatic recovery assertion fails.

Baseline source and failed runs are retained in `artifacts/live-pvp-command-recovery/`.

## Changes

- Retained commands now retry automatically with the exact original payload and request ID. Consecutive delivery failures back off for two, four and eight seconds, with an eight-second cap. Online and foreground events still reconcile immediately.
- A late command or join reply may recover its journey before another delivery takes ownership. A late reply from a superseded delivery cannot replace newer server-confirmed progress. Late background observations remain ignored after their deadline.
- Terminal results and cancelled seats reject further deliveries, including those triggered by online or foreground events. Completion still dispatches one profile-refresh event.
- Uncertain answers stay blocked until the server confirms their outcome. The browser never awards local progress or currency while retrying.

## Verification

| Check | Result |
| --- | --- |
| Late accepted answer | Recovers without a duplicate delivery on desktop and mobile |
| Lost accepted answer | Automatically replays the original request ID and scores once on desktop and mobile |
| Late superseded command | Cannot rewind a newer accepted answer or reopen an error |
| Command outage | Bounded retries preserve the command ID; reconnect confirms one answer |
| Opponent finishes during uncertain answer | Retry recovers the authoritative loss; completion fires once |
| Finished-match reconnect | Sends no additional requests |
| Existing delivery regressions | Hung join recovery, command bypass of hung polls, stale poll snapshots/failures and reconnect replay pass at 1280px and 390px; local answer-input-to-confirmation measurements are 100–101 ms |
| Existing outage and stale-question checks | Poll backoff, preserved typing and question reconciliation pass at both widths |
| Lifetime and clock checks | Ten unmount and device-clock cases pass |
| Real Firestore authority | Two browser players, shared countdown, live scores, immediate victory, stored balances of 150/100 and bot fallback pass; 21 integration tests pass |
| Client unit regressions | 87 tests pass |
| Isolated artifacts | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo builds and artifact audits pass |
| Devvit package | Build and 42 package checks pass; same-origin client and single approved gateway host remain enforced |
| Maintenance | Portal types, Functions build, file sizes, backend scalability and live-feature TSDoc pass |

The full repository TSDoc run recorded 34 missing comments in other classic supply-worker and playable-content work. It reported no missing declarations in the changed PvP runtime files. The live-feature audit passes for 530 declarations across 20 files.

## Reproduction

```sh
# Full recovery and response-ordering scenarios:
LIVE_RACE_COMMAND_RECOVERY_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# Smallest lost-reply scenario:
LIVE_RACE_COMMAND_LOST_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# Reproduce the original lost-reply failure using the saved component:
LIVE_RACE_COMMAND_LOST_ONLY=1 LIVE_RACE_BASELINE_FILE="$PWD/artifacts/live-pvp-command-recovery/LiveRaceGame.before.txt" node packages/portal/scripts/verify-live-race-delivery-browser.mjs

# Existing delivery, polling outage and stale-question regressions:
node packages/portal/scripts/verify-live-race-delivery-browser.mjs
LIVE_RACE_BACKOFF_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs
LIVE_RACE_REJECTION_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs
```

These changes are verified locally and have not been deployed. Normal observations remain approximately one second apart. An entirely lost command reply waits for the ten-second transport deadline and then the bounded retry delay; server-confirmed late replies can recover before that retry. Local harness timings do not establish production latency.
