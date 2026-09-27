# Jest deployed multiplayer verification — version 01a0e3b1 — 2026-09-27

Status: **happy path passed; opponent-finish loss path failed and is reproducible.**

## Deployment under test

- Candidate URL: `https://jest.com/g/riddle-q?versionId=01a0e3b1-c476-743b-9af7-65efa658a700&rl=4884f7`
- Jest version ID: `01a0e3b1-c476-743b-9af7-65efa658a700`
- Build: `1.0.0-dev.20260927160919.39c2a5bfc87f.496e35ae`
- Source commit: `39c2a5bfc87f2921f977974c51b9ec74d9afbc25`
- Jest MCP status: `ready`, inactive candidate
- Viewport: 390 × 844, headless Chromium, live Jest sandbox shell

The two refreshed sandbox login links were converted to separate owner-only
`0600` browser states in `/tmp`. Both SDK identities were registered and their
player IDs were distinct. Raw player IDs, login links, referral URLs, challenge
IDs, and the App Check debug credential are not stored in this directory.

## Passed journey

1. Player 1 opened **Multiplayer**, selected **Challenge a player**, and caused
   Jest to upsert a real `https://jest.com/l/...` referral with a valid bounded
   opaque challenge ID.
2. Player 1 solved all ten server-issued riddles without a hint or skip. The
   authoritative published run was **10/10 in 28.697 seconds**.
3. Player 2 followed the real referral route. Because that general route first
   targets the older active release, the runner preserved its `entryPayload`
   and `refid` while continuing on the requested inactive candidate.
4. The invite screen showed Player 1 as
   **Jest 13aaf5ca3b382e5c557** and the rounded **0:28.7** time to beat.
5. Player 2 accepted the same challenge. The test compared backend operation
   results rather than relying only on screen text:
   - recipient challenge ID equalled the ID Player 1 published;
   - visible opponent rail name equalled the published creator name;
   - opponent history contained the same ten correct events as Player 1's run;
   - opponent adjusted finish time was exactly **28,697 ms** in both records.
6. Player 2 completed all ten riddles in **22.8 seconds** and reached
   **You win!**. The Race Debut achievement was also displayed.

The authoritative equality checks establish that Player 2 raced the correct
player and the correct score, not merely another 10/10 ghost.

## Errors found

### High — losing player becomes stuck after the opponent's recorded finish

This reproduced on two live attempts. When Player 2 was at 8/10 after Player
1's recorded finish time had elapsed, the score rail correctly showed Player 1
at 10. The game did not transition to an **Opponent wins** result. Player 2's
next correct submission instead returned:

```text
This Race to 10 run is no longer active. [400]
```

The answer board remained interactive with a **Retry** action. Waiting 30
seconds produced no terminal result. Retrying the same operation cannot make
the server-closed run active again, so this is a dead-end in the normal loss
experience. Evidence:
[`live-06-player-2-race-error-answer-9.png`](./live-06-player-2-race-error-answer-9.png).

Expected behavior: once the authoritative opponent finish time is reached, the
client should fetch or receive the completed outcome and render **Opponent
wins**, without requiring another guess. A `failed-precondition` / inactive-run
response should also recover by requesting the outcome instead of exposing a
retry loop.

### Low — initial multiplayer lobby is horizontally clipped at phone width

The 390 px lobby capture repeatedly lost the left edge of the title, challenge
button, help copy, and section heading. The following pending-share state was
aligned correctly, so this appears to be a transient layout/scroll-position
issue when entering Multiplayer rather than permanently oversized content.
Evidence: [`live-01-player-1-lobby.png`](./live-01-player-1-lobby.png) compared
with [`live-02-player-1-share-dialog.png`](./live-02-player-1-share-dialog.png).

### Non-blocking Jest host noise

Both sessions logged the same Storage Access API refusal because the iframe
sandbox omitted `allow-storage-access-by-user-activation`. Each also had one
aborted `serverEvents.subscribe` request during shutdown/navigation. There were
no uncaught page errors, and neither observation blocked identity, referrals,
race calls, persistence, or completion.

## Screenshots

### Player 1

- [`live-01-player-1-lobby.png`](./live-01-player-1-lobby.png)
- [`live-02-player-1-share-dialog.png`](./live-02-player-1-share-dialog.png)
- [`live-04-player-1-race-started.png`](./live-04-player-1-race-started.png)
- [`live-04-player-1-race-finished.png`](./live-04-player-1-race-finished.png)

The headless browser cannot capture the browser/OS share sheet itself. The
pending share state is captured, while the successful Jest referral response
and resulting recipient launch are asserted programmatically.

### Player 2

- [`live-05-player-2-invite-ready.png`](./live-05-player-2-invite-ready.png)
- [`live-06-player-2-race-started.png`](./live-06-player-2-race-started.png)
- [`live-06-player-2-achievement-unlocked.png`](./live-06-player-2-achievement-unlocked.png)
- [`live-06-player-2-race-finished.png`](./live-06-player-2-race-finished.png)
- [`live-06-player-2-race-error-answer-9.png`](./live-06-player-2-race-error-answer-9.png)

Machine-readable assertions and diagnostics are in [`RESULT.json`](./RESULT.json).

## Automation changes

`packages/portal/scripts/verify-jest-multiplayer-live.mjs` now:

- requires and proves the exact deployed build;
- verifies two distinct registered player identities without persisting raw IDs;
- captures console, page, and failed-request diagnostics;
- asserts the challenge ID, opponent identity, all ten score events, and exact
  adjusted finish time across creator publication and recipient playback;
- captures achievement, successful result, and failed-answer states separately;
- supports the deployed **Challenge a player** wording and waits for SDK player
  initialization before identity reads.

The runner completed with exit code 0 for the documented happy path. Its final
JSON result has `scoreMappingVerified: true`, `creatorScore: 10`,
`opponentScoreEvents: 10`, matching adjusted finish times of `28697`, outcome
`You win!`, and no uncaught page errors.
