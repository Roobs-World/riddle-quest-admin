# Jest multiplayer post-result challenge verification — 2026-09-27

Status: **local source flow passed; deployment not yet performed.**

## Verified experience

The Jest multiplayer journey now establishes the score before inviting anyone:

1. Player 1 opens Multiplayer and chooses a category. The lobby contains no
   pre-race challenge or share action.
2. Player 1 completes all ten riddles and immediately sees **Run recorded!**
   while authoritative outcome work reconciles in the background.
3. **Send challenge** publishes that completed run, then opens the Jest SDK
   referral flow with the immutable challenge ID and time-to-beat payload.
4. The completed result retains **Challenge a friend · 100 coins each**. The
   browser test used it twice more and verified all three sends carried the
   same challenge ID while each had a unique referral reference.
5. Player 2 opens the resulting payload only after the challenge exists. The
   invite immediately shows Player 1's name and recorded time; there is no
   pending-score lobby.
6. Player 2 races the published ghost. At its finish, the result transitions
   automatically and shows the exact final score mapping: **You 0/10** against
   **Guest Solver 10/10**.

## Errors fixed

- Removed the pre-race invitation/reservation UI and its client session-storage
  recovery path. This eliminates the recipient-waits-for-creator race and the
  possibility of sharing a challenge before a score exists.
- Fixed the losing-player dead end. Deterministic terminal results render from
  the latest authoritative run and clock immediately; server outcome and
  achievement work completes in the background.
- A guess that crosses the opponent deadline no longer exposes the backend's
  inactive-run error or an unrecoverable Retry action.
- A transient outcome-service failure leaves the result visible and Retry now
  reconciles the outcome instead of restarting the wrong operation.
- Competitive results retain both player scores, making the opponent identity
  and score explicit after gameplay disappears.
- Renamed the misleading **Solve time** result label to **Race time** in all 17
  locales because an automatically losing player may not have solved the run.
- Added narrow-viewport containment assertions for the title, tabs, panel, and
  lobby actions. The local 390 px lobby is fully contained.

## Automated coverage

- Jest browser integration: **33/33 passed**.
- Focused race presentation/component tests: **15/15 passed**.
- Automatic opponent finish is shown before a delayed outcome response.
- Completed creator result is shown before delayed completion work.
- Late rejected guess recovers directly to **Opponent wins**.
- First background outcome failure recovers through Retry without hiding the
  result.
- Reusable post-result Jest sharing uses one immutable challenge ID across
  multiple recipients and unique attribution references per send.

Full `verify:all-targets` passed. It built and audited the isolated Jest,
Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks artifacts, then passed
the Jest general browser harness (14/14), Jest authentication/multiplayer
(33/33), Facebook (1/1), Reddit (1/1), YouTube (10/10), and standalone
Netflix/Yahoo (2/2) browser suites. The focused race coverage gate also passed
with 814 tests and 90.28% line coverage. The only observed toolchain warning is
that the local Node 24 runtime does not match `firebase-functions`' requested
Node 22 engine.

## Screenshots

### Player 1

- [`01-player-1-multiplayer-lobby.png`](01-player-1-multiplayer-lobby.png)
- [`02-player-1-race-started.png`](02-player-1-race-started.png)
- [`03-player-1-run-recorded.png`](03-player-1-run-recorded.png)
- [`04-player-1-challenge-ready.png`](04-player-1-challenge-ready.png)

### Player 2

- [`05-player-2-invite-ready.png`](05-player-2-invite-ready.png)
- [`06-player-2-race-started.png`](06-player-2-race-started.png)
- [`07-player-2-automatic-result.png`](07-player-2-automatic-result.png)
- [`08-player-2-final-result.png`](08-player-2-final-result.png)

The native browser/OS recipient picker and SMS composer cannot be captured by
the page screenshot API. The tests instead assert the calls crossing the real
Jest platform adapter seam, including share text, entry payload, challenge ID,
and referral references.
