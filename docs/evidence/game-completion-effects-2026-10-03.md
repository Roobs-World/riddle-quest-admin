# Single-player completion effects — 3 October 2026

This pass continues the multiplayer/single-player reliability, performance, playability, and latency goal. It protects target-owned engagement, notification, and result actions after authoritative single-player reward delivery.

## Reproduced behavior

The actual React StrictMode `PlayHostApp`, local bridge router, account subscription, and game UI were mounted with controlled authoritative services and provider callbacks. Three completion messages for the same issued puzzle acknowledged three valid receipts but invoked engagement/notification recording and result actions three times. A later profile/callback update allowed another replay. Held authority responses also invoked provider work after replacement, sign-out and return to the same UID, same-UID account recreation, and unmount. A provider acknowledgment arriving after replacement still opened the old result action.

The saved host baseline SHA-256 is `ccd5bdb64d08921589bd549f8e859597fd2c1813b78dda2099b8c3f90652cc25`. Re-running the current harness with that baseline recorded 20 mismatches across desktop and phone cases and exited nonzero as expected. Raw observations remain in `artifacts/game-completion-effects-2026-10-03/browser-before.json`.

## Change

`hostCompletionEffects.ts` consumes optional callback work once for each game mode, riddle identifier, and immutable issued session token within one mounted authentication visit. Consumption happens before starting external work, so overlapping retries and partial optional failures cannot repeat engagement updates or provider actions. Distinct issued games remain eligible. A fresh account visit gets independent consumption.

`PlayHostApp` retains this consumer in a reference keyed by the account-visit capture function. Profile updates and replacement target callbacks preserve consumption; correctness does not depend on retaining a memoization cache. Retired handlers retain their original ownership guard. Both the initial provider callback and the result action after provider acknowledgment check that guard. Account replacement, sign-out/re-entry, recreation, and disposal retire it.

The callback input now explicitly carries the existing session token already present in the validated bridge command. No new provider SDK, player-facing copy, locale key, or backend grant behavior was introduced.

Every accepted authority receipt still receives its own bridge acknowledgment. Optional callback work stays outside reward delivery: a held or rejected callback cannot delay or invalidate an accepted receipt. Consumption is scoped to the mounted host/account visit; canonical reward authority and cross-reload idempotency remain server responsibilities.

## Verification

Evidence is under `artifacts/game-completion-effects-2026-10-03/`:

- Eight focused consumer regressions cover overlapping retries, callback replacement, distinct identities, retired visits, retirement during acknowledgment, partial failure, independent new visits, and targets without recording callbacks.
- Consumer, host-handler, and existing race-result checks: 3 suites, 39 tests passed.
- Full portal suite: 274 suites, 2,346 tests passed; 118 opt-in browser tests skipped.
- Actual host/game browser harness: all 20 checks passed at 1280 px and 390 px, including preserved authority acknowledgments despite optional provider failure and host disposal. Clean game screenshots were inspected. This verifier is registered in the normal game-browser command.
- Four existing production-artifact Jest reward/registration journeys passed, including delayed reward delivery and first Classic/Daily milestone behavior.
- All six production target builds and isolation audits passed; exact exit codes are in `build-results.json`. Runtime source hashes still match the tested builds.
- All workspace type checks passed. The final component change also passed portal types. File-size audit passed for 1,160 source files; TSDoc passed for 23,685 declarations across 1,086 files. Script syntax and whitespace checks passed.

These tests use injected services/provider callbacks; they do not send real notifications or measure production latency. The shared checkout includes concurrent work from other chats, and suite counts describe the tested combined state. No deployment was performed. Browser verification used Chromium; Firefox tools remain absent from this chat's exposed inventory.

The full goal remains active. Next, audit the correct-guess callback: the host still forwards it directly, while Jest's registration/guest-win callback reads the latest target session. Also examine duplicate completion analytics emitted by outer awaiting handlers after transport coalescing.
