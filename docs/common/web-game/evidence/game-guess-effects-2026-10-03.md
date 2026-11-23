# Accepted guess and completion telemetry ownership — 3 October 2026

This pass continues the multiplayer/single-player reliability, performance, playability, and latency goal. It addresses delayed correct-guess callbacks reaching a replacement target session and duplicate gameplay analytics after transport retries.

## Reproduction

The actual React StrictMode host, game UI, local bridge router, and authentication subscription were exercised with held authoritative responses and an injected native analytics sink. Before the change, three messages carrying the same accepted guess invoked the win callback three times and emitted three `guess_submitted` events. Profile/callback updates admitted another replay. A held correct response still invoked the target callback and analytics after account replacement, same-UID sign-out/re-entry, account recreation, and host disposal.

Completion callbacks already consumed their target effects once, but `level_end`, `level_up`, and achievement events remained in each outer awaiting handler. Three identical receipts emitted each event three times. Retired completion responses still emitted analytics even though their target callbacks were suppressed.

The expanded baseline browser harness recorded 42 mismatches among 46 observations across 1280 px and 390 px and exited nonzero as expected. Baseline source SHA-256 values:

- Host: `39531296dee5906ad88b09d7b9cb2d4adf74a18f8e33fa22269eb885dcf83fb3`.
- Command handlers: `f5e756b578f55d5934720ac85bc06627b944175bc6a8851a79423856a0bd3dc0`.
- Completion helper: `949d5956ba7d02922aa12ee58faaad8da823917c2e24d1ce8da5df397c5659ff`.

## Change

`createHostGuessEffects` retains the admitting account-visit ownership guard. It consumes telemetry by immutable game mode, riddle, issued session, and server-counted accepted attempt. A semantic retry may carry a fresh request ID while still describing the same accepted attempt. Distinct accepted wrong attempts remain observable; distinct riddles, modes, and sessions remain independent. A winning issued game consumes its optional target prompt once.

`PlayHostApp` retains guess and completion consumers together in durable reference state keyed by the account-visit capture function. Profile updates and target callback replacement preserve consumption. Replacement, sign-out/re-entry, account recreation, and disposal retire the original consumer before a late callback can touch the new session.

Completion analytics now share the existing owned completion consumer. A completion fact emits one `level_end` and its eligible level/achievement events, even if optional target work later rejects. Retired receipts emit no new-account analytics. Session tokens and riddle identifiers stay inside local consumption keys; they are not forwarded in event parameters.

The host command acknowledges accepted guess data before scheduling optional effects. Synchronous or asynchronous optional failures are reported independently and cannot reject an accepted guess, hold the authority response, or replay partial target work. Every valid guess and completion request still receives its own acknowledgment.

No provider SDK, visible copy, locale key, server economy rule, or target boundary changed. Consumption remains scoped to the mounted host and account visit; backend grants and cross-reload idempotency remain server authoritative.

## Verification

Raw evidence is under `artifacts/game-guess-effects-2026-10-03/`:

- Focused guess/completion effect, host-handler, and command tests: 4 suites, 50 tests passed. These include 12 new consumer regressions and a held optional guess callback proving immediate authority acknowledgment.
- Full portal suite: 275 suites, 2,359 tests passed; 118 opt-in browser tests skipped.
- Actual host/game browser harness: all 46 observations matched at 1280 px and 390 px. It checks overlapping and semantic retries, distinct accepted attempts, callback/profile replacement, fresh account visits, retirement and disposal, optional failure, and native analytics counts. Existing completion ownership scenarios remain covered. Clean rendered game screenshots were retained and inspected.
- Seven production-artifact Jest journeys passed, covering native analytics, first milestone, guest Daily, registration after deferred confirmation, delayed reward syncing, registered-player restoration, and signed guest startup.
- All six production target builds and SDK isolation audits passed. Exit codes and durations are recorded in `build-results.json`; runtime source hashes matched the tested builds after verification.
- All workspace type checks, script syntax, maintainable-file-size audit (1,161 source files), TSDoc audit (23,714 declarations across 1,087 files), and whitespace checks passed.

Tests inject authoritative services and analytics callbacks; they do not send real notifications or establish production latency. The checkout contains concurrent work from other chats, so counts describe the combined tested state. No deployment was performed. Browser checks used Chromium; Firefox remains absent from this chat's exposed tool inventory.

The full goal remains active. The next concrete multiplayer audit is `LiveRaceSafety`: Block/Report currently await provider promises without the live command deadline, so a never-settling delivery can retain the busy lock and disable recovery indefinitely. Reproduce this in the actual safety panel before changing its delivery policy.
