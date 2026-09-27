# Jest multiplayer end-to-end test — 2026-09-27

## Result

**Blocked at invite creation.** Two independent Jest sandbox players were authenticated successfully. Player 1 launched Riddle-Q, opened Race to 10, completed all ten riddles, and reached the recorded-run result. The flow could not be handed to Player 2 because Jest returned HTTP 500 from `POST /trpc/upsertReferral`, so neither **Play with friends** nor **Send challenge** produced an invite link.

## Environment

- Platform: Jest production web shell (`jest.com`)
- Game build: `1.0.0-dev.20260921203831.675d13051574.7b59232b`
- Browser: automated Chrome, two isolated sessions
- Players: two distinct authenticated Jest sandbox player IDs
- Login tokens are intentionally omitted from this report

## Journey exercised

1. Opened each supplied Jest login link in an isolated browser session.
2. Verified both sessions reached the Jest home/library as sandbox users.
3. Launched Riddle-Q for both accounts.
4. Confirmed headless startup fails because Firebase App Check rejects the reCAPTCHA Enterprise token with HTTP 403.
5. Re-ran in headed Chrome; App Check returned HTTP 200 and the game loaded for both players.
6. Completed first-run onboarding for Player 1.
7. Opened **Multiplayer → Race to 10**.
8. Exercised **Play with friends**; Jest logged `Error opening referral link`.
9. Selected Mixed and completed all ten riddles. The run recorded successfully with a score of 10 and time of 2:06.0.
10. Exercised **Send challenge** from the result screen; the same referral failure reproduced.

## Blocking defect

- Request: `POST https://jest.com/trpc/upsertReferral?batch=1`
- Response: HTTP 500
- User-visible effect: the share dialog does not open and no invite URL is generated.
- Console symptom: `[ClientLogger] Error opening referral link ... TRPCClientError`
- Reproduced from both the pre-race **Play with friends** CTA and post-race **Send challenge** CTA.
- Because no referral exists, Player 2 cannot enter the recorded challenge and the two-player completion path cannot be tested further.

## Additional automation finding

In headless Chrome, both players reached the embedded game but saw **Startup failed**. The failing request was Firebase App Check's `exchangeRecaptchaEnterpriseToken` (HTTP 403). The same request returned HTTP 200 in headed Chrome, after which both game clients loaded. This appears specific to automated/headless reCAPTCHA evaluation rather than the core identity exchange, which returned HTTP 200 throughout.

## Screenshot index

### Authentication and launch

- `jest_player_1-01-home.png`, `jest_player_2-01-home.png` — authenticated Jest home
- `jest_player_1-03-portrait-reload.png`, `jest_player_2-03-portrait-reload.png` — Jest orientation prompt
- `jest_player_1-05-game-page.png`, `jest_player_2-05-game-page.png` — headless startup failure
- `jest_player_1-06-after-retry.png`, `jest_player_2-06-after-retry.png` — failure after Retry
- `jest_player_1_headed-07-headed-retry.png`, `jest_player_2_headed-07-headed-retry.png` — successful headed launch

### Player 1 onboarding and multiplayer entry

- `player1-08-main-menu.png` through `player1-13-gameplay.png` — first-run onboarding and playable game
- `player1-14-multiplayer-menu.png` — Race to 10 menu
- `player1-15-play-with-friends.png` — Play with friends attempt
- `player1-16-mixed-selected.png` — Mixed race selection/start

### Race and result

- `player1-17-race-answer-1.png` through `player1-28-race-complete.png` — race progression
- `player1-30-outcome-wait.png` — recorded result plus achievement
- `player1-31-results-send-challenge.png` — recorded result with Send challenge CTA
- `player1-32-share-challenge.png` — failed Send challenge attempt

## Retest criterion

Retest once Jest's `upsertReferral` call succeeds for these sandbox accounts. The next run should verify: share dialog opens, an invite URL is created, Player 2 enters the exact recorded challenge, Player 2 completes all ten riddles, both clients show the same final outcome, and Activity reflects the completed head-to-head result.
