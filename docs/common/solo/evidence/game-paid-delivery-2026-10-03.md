# Firebase authority delivery and account-owned activity — 3 October 2026

This pass continues the active multiplayer/single-player reliability, performance, playability, and latency goal. It addresses stalled authority transports and repeated paid-action requests after the earlier Reddit and content recovery work.

## Reproduced failures

Nineteen initial adapter regressions exercised completion, guess, hint, Continue, and Skip delivery. Nine failed before this change: four operation types started separate SDK calls for three overlapping identical renderer requests, and all five operation types retained never-settling provider promises past 15 seconds. Existing completion coalescing already passed its one-transport case.

A separate actual-operation-hook test reproduced two failures: pending work retained the global loading overlay after the account visit changed, including a later visit of the same UID. Baseline browser checks reproduce both the three-SDK-call failure and the account replacement remaining blocked.

Adapter baseline SHA-256: `5ca647325568ea47a8331a3f6b9ef1c8adae6a5ae6dfc3a39b3691fd0876d0be`.
Activity-hook baseline SHA-256: `6ddf16f4f5b7571878f0b428df6b2cd11cb58733f357b53a9b149c826dc43453`.

## Authority response ownership

`gameplayAuthorityDelivery.ts` coalesces only identical pending requests and bounds their local delivery to 15 seconds. Keys include the authenticated UID, account creation generation, account visit, operation, and complete input fields with stable property ordering. Distinct request IDs, sessions, payloads, operations, and account visits remain independent.

A timely canonical receipt runs optional profile/content follow-up once. Expiry rejects with `deadline-exceeded`, releases the in-flight entry, and permits a fresh transport using the original request identity. Late provider fulfillment or rejection is consumed and cannot publish a receipt or start follow-up work for the expired wait. This bounds delivery; it does not claim cancellation of server work or acceptance of a timed-out mutation. Purchase and reward authority remains on the server.

Existing completion coalescing is retained through the shared delivery module. All five single-player authority methods now use the same transport-lifetime policy. Optional profile failures still cannot mask accepted receipts.

## Account-owned loading activity

`useHostOperations` counts activity under the admitting account-visit token supplied by `useHostAuthSession.captureAccount`. Profile-only notifications preserve that token. Replacement, deletion/sign-out, same-UID recreation, and re-entry retire it. Old operations immediately stop blocking the replacement's UI, and their later completion cannot decrement a new owner's active count. Concurrent operations within the same visit retain accurate counting.

Deadline errors at the host boundary use the existing translated service-unavailable notice, including Reddit gateway expiry and Firebase-prefixed deadline codes. No new player-facing locale key was introduced.

## Verification

Raw logs, baseline failures, source hashes, build results, and screenshots are under `artifacts/game-paid-delivery-2026-10-03/`.

- Focused adapter, completion, ownership, activity, and host-handler checks: 5 suites, 67 tests passed.
- Full portal unit suite: 273 suites, 2,338 tests passed; 118 opt-in browser tests skipped.
- Actual Firebase adapter plus React StrictMode authentication/activity browser checks passed at 1280 px and 390 px. They verify one SDK transport for overlapping paid retries, a nonblocking replacement account, expiry releasing current-account activity, retry receipt recovery, and rejection of expired follow-up work. Existing optional-profile and content ownership checks also remain covered.
- Twelve full queued paid-action browser scenarios passed, including interrupted paid journals, reload recovery, hint/Skip previews, and held authority confirmations.
- Eleven selected production-artifact authentication journeys passed, including delayed identity, registration, login, restoration, first Classic rewards, unavailable Daily, and optional profile delay.
- The actual Reddit adapter and React reload recovery harness passed at both widths after the shared activity/error-boundary change.
- All six production target builds and isolation audits passed; exact exit codes are in `build-results.json`.
- All workspace type checks, maintainable-file-size audit (1,158 source files), TSDoc (23,664 declarations), and whitespace checks passed. Runtime source hashes matched the tested builds.

The shared checkout includes concurrent changes from other chats, so suite counts describe the combined checkout at validation time. No deployment was performed. Browser checks used Chromium; Firefox controls remain absent from the exposed tool inventory.

The goal remains active. Next, reproduce duplicate outer completion callbacks: a coalesced SDK response still reaches each awaiting host handler, and Jest's target callback increments engagement wins on every invocation. Also audit the single-player target callback's account visit and result-screen/notification ownership, which currently lacks the race callback's explicit ownership boundary.
