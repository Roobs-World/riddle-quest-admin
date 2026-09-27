# Jest deployed multiplayer verification — version 01a0e40d — 2026-09-27

Status: **full two-player journey passed; opponent score mapping verified.**

> Correction after a controlled 520 px host-viewport rerun: the clipping noted
> below was caused by Jest's approximately 509 px preview iframe being centered
> inside a 390 px automation viewport. The 424 px game document had no internal
> horizontal overflow. The corrected evidence and full repair report are in
> [the follow-up run](../jest-multiplayer-deployed-2026-09-27-version-01a0e40d-wide/REPORT.md).

## Deployment under test

- Candidate URL: `https://jest.com/g/riddle-q?versionId=01a0e40d-72b2-76b6-92af-8cb126fe840d&rl=4884f7`
- Jest version ID: `01a0e40d-72b2-76b6-92af-8cb126fe840d`
- Build: `1.0.0-dev.20260927174851.7216833e4333.d51ad980`
- Source commit: `7216833e4333343bd857ae315025c7941a9a01b2`
- Jest MCP status: `ready`, inactive candidate
- Viewport: 390 × 844, headless Chromium, live Jest shell

Jest MCP was used to resolve the requested version to the exact deployed build.
The two supplied login links were converted to separate owner-only `0600`
browser states in `/tmp`. Both SDK identities were registered and their player
IDs were distinct. Raw login links, player IDs, referral URLs, challenge IDs,
and the App Check credential are not stored in this evidence directory.

## Passed journey

1. Player 1 opened **Multiplayer**, chose **History**, and completed all ten
   live server-issued riddles without hints or skips.
2. Player 1's authoritative run was **10/10 in 29.160 seconds**. No Jest share
   call occurred before this score was complete.
3. **Send challenge** published an immutable challenge and Jest returned a real
   `https://jest.com/l/...` referral URL. The final creator state offered
   **Challenge a friend · 100 coins each**.
4. Player 2 followed the real referral. Since a Jest referral initially targets
   the active release, the runner retained its signed-in session, `entryPayload`,
   and `refid` while reopening this exact inactive candidate version.
5. The invite showed Player 1 as **Jest 64f0cc7d9bac20ff8c1** with a rounded
   **0:29.2** time to beat.
6. Player 2 accepted the challenge, completed all ten riddles faster, and saw
   **You win!**.

## Opponent-score integrity

The runner compared backend operation results as well as the visible UI:

- Player 2's challenge ID equalled the opaque ID Player 1 published.
- The visible opponent rail name equalled the challenge creator name.
- The opponent history contained the same ten correct events as Player 1's
  completed run.
- Player 1's completed run, the published preview, and Player 2's opponent ghost
  all contained the exact same adjusted finish time: **29,160 ms**.
- Player 2's final result was **You win!**; the screenshot shows Player 2 at
  10/10 and the correctly paced opponent ghost at 7/10 at that instant.

These checks establish that Player 2 raced the correct player and exact score,
not merely another 10/10 recording.

## Errors and observations

### Low — multiplayer chrome is horizontally clipped at phone width

At 390 px, the initial Player 1 lobby and result views start with a negative
horizontal offset. The left edge of **Recorded head-to-head**, **Race to 10**,
and some result chrome is clipped. The centered share-ready and Player 2 invite
cards render correctly, so the issue appears state/layout-specific rather than
a globally oversized iframe.

Evidence: [Player 1 lobby](./live-01-player-1-lobby.png) and
[Player 1 result](./live-02-player-1-race-finished.png).

### Preview-only timing risk — an early Accept tap can be lost during iframe reload

On two diagnostic passes, the inactive-candidate handoff reloaded the game
iframe after **Accept challenge** first became visible. A click during that
window was discarded and the invite returned unchanged; no page exception or
failed race request was emitted. Waiting until the candidate iframe remained
actionable for three continuous seconds made the journey pass reliably.

This occurs in the special inactive-version test handoff: the real Jest referral
opens the active release, then the runner reapplies its payload to the candidate
URL. It is not evidence that an active production referral has the same reload,
but it is a confusing preview/testing experience. The retained failure capture
is [Player 2 accept reload](./live-06-player-2-accept-error.png).

### Intermittent observation — first share attempt exceeded 45 seconds

The first attempt completed Player 1's 10/10 run, but the share callback was not
observed within 45 seconds. The same action succeeded on every later completed
pass, including the final pass, with a valid Jest referral response. There was
not enough evidence to classify this one-off delay as a product defect.

### Non-blocking Jest host noise

Both sessions logged a Storage Access API refusal because the Jest iframe
sandbox omits `allow-storage-access-by-user-activation`. The shell also aborted
one `serverEvents.subscribe` request during navigation or shutdown. There were
no uncaught page errors, and identity, challenge publication, score persistence,
referral resolution, and game completion all succeeded.

## Screenshot evidence

### Player 1

- [Multiplayer lobby](./live-01-player-1-lobby.png)
- [Race started](./live-02-player-1-race-started.png)
- [Race finished](./live-02-player-1-race-finished.png)
- [Authoritative run recorded](./live-03-player-1-completed.png)
- [Share requested](./live-04-player-1-share-requested.png)
- [Jest share/achievement transition](./live-04-player-1-share-dialog.png)
- [Published challenge ready](./live-04b-player-1-challenge-ready.png)

### Player 2

- [Invite ready with Player 1's score](./live-05-player-2-invite-ready.png)
- [Race started with opponent rail](./live-06-player-2-race-started.png)
- [Final result](./live-06-player-2-race-finished.png)
- [Retained preview iframe-reload diagnostic](./live-06-player-2-accept-error.png)

The browser/OS contact picker itself is not available to headless Chromium. The
test instead proves the Jest referral upsert response, opens its returned URL in
Player 2's isolated context, and verifies the received entry payload end to end.

Machine-readable assertions and diagnostics are in [RESULT.json](./RESULT.json).

## Automation changes

`packages/portal/scripts/verify-jest-multiplayer-live.mjs` now additionally:

- captures the requested, failed, and final creator share states;
- records detailed referral-publication diagnostics on failure;
- exercises delayed returning-player reward modals, including chest collection;
- installs race observation at document creation so iframe replacement does not
  lose authoritative score events;
- selects the accepted gameplay frame by visible race state rather than frame
  ordering; and
- waits for the inactive-candidate invite frame to stabilize before accepting.

The final runner exited 0. `node --check` and `git diff --check` also passed.
