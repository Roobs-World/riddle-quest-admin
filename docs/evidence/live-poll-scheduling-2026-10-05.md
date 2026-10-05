# Live multiplayer polling schedule — 5 October 2026

Healthy push-connected matches already used a five-second reconciliation interval, but their browser scheduler woke every 500 ms to check whether a read was due. Player-command retries could also wait behind that five-second observation interval despite a shorter retry backoff.

The actual live-game reproduction failed 1 of 6 assertions. The final original-source comparison failed 15 of 79 assertions. Both final React matrices passed all 474 assertions, and existing retirement checks passed another 114.

In the injected native-timer fixture, a five-second watchdog used ten polling callbacks before the change and one afterward in every final development/production viewport. A 1,150 ms healthy sample recorded two callbacks in the original control and zero in the final runs. This measures polling scheduler callbacks, not total CPU or every animation timer. Native Firefox confirmed a failed player command retried after 2,001 ms using the same request ID.

## Change

`LiveRaceGame` keeps one polling deadline determined by the most recent delivery, existing observation policy and outage backoff. Accepted state, connectivity, delivery completion and visibility changes rearm that deadline. An owned in-flight delivery keeps its existing receipt deadline while releasing idle observation timers. Accepted terminal states stop scheduling immediately.

Retained player commands use their retry backoff rather than the healthy push reconciliation interval. Normal fallback human polling remains 500 ms; hidden polling retains the one-second policy; healthy push retains the five-second watchdog. Foreground recovery and disconnect signals still reconcile promptly. Account replacement and retirement retain the existing guards and idempotent leave receipt.

Connectivity changes notify the mounted scheduler without restarting the seat. A subscription that reports connected and then throws also restores fallback scheduling. Delay calculation rounds the remaining deadline upward and uses a small tail when needed; an early native timer cannot impose an additional half-second wait.

The change adds no provider SDK, scoring rule, request field or product text. Locale files, purchase grants, provider capabilities and deployments are unchanged. Other work in the shared checkout is preserved.

## Reproduction and controls

```sh
pnpm --dir packages/portal test:live-poll-scheduling:browser
```

The registered command runs development and production. `LIVE_SCHEDULE_QUICK=1` selects one viewport; `LIVE_SCHEDULE_SCENARIOS=healthy` selects the reduced loop. `LIVE_SCHEDULE_BASELINE_DIR=artifacts/live-poll-scheduling-2026-10-05` substitutes the captured original live game and signal hook. `LIVE_SCHEDULE_REPORT_DIR` selects a separate output directory.

The fixture renders the real current `LiveRaceGame`, native answer input, draft reconciliation, delivery deadline and push hook. Only the local authenticated transport outcomes are injected. Its native polling timeout is observed below the scheduler, without replacing its timing policy. External provider traffic is rejected. These tests do not certify a live provider connection or measure network latency against production.

Ten scenarios cover healthy push, disconnect, hidden recovery, held commands, command retry backoff, the full watchdog interval, reentrant unmount, account replacement, a throwing subscription and terminal settlement. Both React modes run in StrictMode at 390×568, 390×844 and 1280×844. Controls inspect current timer ownership, callback execution, provider read count/cadence, authority receipt reuse, native answer progression, retired callbacks and errors.

The competing explanations were a fixed scheduler waking independently of its observation policy, ignored push connectivity and unrelated animation callbacks. The original control issued no premature provider polls; the instrumented callbacks belonged specifically to the polling site. Scheduling its next due read directly removed those extra callbacks while preserving the watchdog and native answer control.

Expanded testing found an early-timer edge in the first prototype: a fractional native timeout fired just before its deadline, followed by a 500 ms tail. The reduced timer trace exposed that delay; the final calculation and watchdog timing control pass. A hidden sample initially assumed exactly one read, but an already overdue observation can correctly run immediately and then again one second later. The final control checks that cadence and foreground recovery. Earlier outputs are retained under `pre-hidden-cadence-control`; complete gates and six builds were rerun after the final fixture was frozen.

Native Firefox typed and submitted `piano` through the actual answer input. A held command retained zero polling timers and zero idle callbacks; its receipt advanced to 1/10 and restored one timer. A failed command retried with the same receipt after 2,001 ms. Disconnect recovery produced an immediate observation and continued fast fallback, with one owned timer and no errors or unhandled rejections.

## Scope correction

The initial investigation tested the recorded Race Session hook. Current-source call-site inspection showed that `RaceTo10Game` now opens live multiplayer and no production screen imports that hook. That prototype and its package/test changes were restored from owned before captures. Its evidence is labeled [inactive-path investigation](/home/craig-beswetherick/Documents/riddle-quest/artifacts/race-hidden-scheduling-2026-10-05/README.md), and its synthetic wakeup reduction is not counted as a game improvement.

Two older recorded-race full-screen fixtures failed because they expected `RaceTo10Game` to create a recorded session. Those failures are preserved with the inactive investigation. Current live-game fixtures and retirement controls provide the evidence for this change. Fixture syntax and parameter errors are also retained separately from product findings.

## Final verification

| Check | Result |
| --- | --- |
| Live polling browser matrix | 474 assertions passed; 66 separate timing traces |
| Related live retirement matrix | 114 assertions passed |
| Native Firefox | Four records passed: held command, receipt recovery, retry and disconnect |
| Full portal units | 2,855 passed in 300 suites; 93 browser-gated tests skipped in 15 suites |
| Types and TSDoc | Passed; 25,523 documented declarations across 1,144 files |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Built browser checks | 8 tests in 3 suites passed; unchanged 100 ms buffered-transition check passed |
| Source capture | Same re-enumerated 1,516 selected inputs and SHA-256 hashes before/after verification |
| Preserved builds | 1,300 files; copied hashes match private outputs |

YouTube remains an incomplete-content fixture, not release certification. No overall CPU reduction or production-network latency reduction is claimed.

The first built-browser handle was missing after the turn interruption. No matching OS process remained and its output file was empty. That gate was restarted only after its stopped state was confirmed; the replacement completed successfully.

All owned jobs are terminal or authoritatively missing after that interruption. The active prototype and final private build roots and twelve owned audit-metadata directories were removed after evidence preservation. The discarded inactive investigation separately preserved and removed its own root and six metadata directories. Owned Firefox pages and fixture caches were removed; the pre-existing blank page remains. No verification process is running.

Original/final captures, the owned diff, failure controls, timing traces, build/unit logs, artifact hashes, native Firefox records, cleanup ledger and the machine-checked [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-poll-scheduling-2026-10-05/verification-summary.json) are retained. The broader game-improvement goal remains active.
