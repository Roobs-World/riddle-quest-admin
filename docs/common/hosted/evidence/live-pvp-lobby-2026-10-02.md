# Live PvP lobby and gameplay

Implemented an additional **Start PvP match** entry on the existing multiplayer intro. Recorded challenges remain available. Live PvP is exposed through the existing Jest, Facebook and Reddit matchmaking adapters; YouTube, Netflix and Yahoo artifacts remain self-contained.

The lobby centers the current player's avatar and username above the search status. The matched rival appears below it. Both players receive the same server-selected deck and five-second start time. The authority searches for a live player for at most 60 seconds, then supplies a bot. Reloading a pending search recovers its original deadline. Reddit identities are projected from the existing temporary provider profile cache and rechecked for expiry, blocks and deletion; provider identifiers are never returned to the browser.

The current multiplayer riddle board and scoreboard display live server progress through serialized one-second polling. Answers stay on the server. A player's tenth solved answer ends the shared match in the same transaction that grants the winner 50 coins. Skips advance the deck without contributing solved answers. Both players receive a terminal result; the winning modal shows the granted reward. Concurrent finishes, retries and duplicate tabs cannot create two winners or duplicate the reward. Closing during the countdown cancels the match without a reward; leaving during gameplay forfeits it.

## Verification

- 10 Firestore emulator integration tests pass, including pairing, shared content/countdown, live progress, simultaneous finishes, idempotent rewards, one-minute bot fallback, bot victory, reload recovery, unauthorized ticket access, blocked/cancelled seats, forfeits and the human/bot deadline race.
- The injected React StrictMode browser harness passes at 1280 × 900 and 390 × 844 against the actual match service and a demo Firestore emulator. It verifies intro entry, lobby identities, countdown from five, progress from a second browser player, immediate terminal UI and the 50-coin modal. It reads the stored balances to confirm the winner receives exactly 50 coins and the loser receives none. It also verifies mobile bot fallback. The browser uses an injected authenticated transport and a fixture category catalog; production authentication is covered by the existing adapter tests. Screenshots and logs are in `artifacts/live-pvp/`.
- A separate injected browser harness passes at both viewport sizes with stalled join, poll and accepted-guess responses. Join and command retries retain their request IDs, a stalled poll releases queued gameplay within two seconds, and retrying an accepted guess does not score twice.
- 62 client regression tests and 68 backend regression tests pass, including native Reddit lobby identity projection, profile expiry and blocking.
- All six isolated production client builds and their artifact audits pass. The Reddit server package and Firebase Functions build also pass.
- Type checks, locale parity, source size, backend scalability, and changed-file TSDoc checks pass. The full repository TSDoc audit still reports 27 missing declarations in other pending riddle-supply changes; its log is preserved separately.

## Completion audit

| Requested behavior | Verified implementation |
| --- | --- |
| Start PvP from the current multiplayer intro | `RaceTo10View` and the browser entry check |
| Center the player above the status and the matched rival below it | `LiveRaceGame`, lobby CSS, desktop/mobile browser geometry and screenshots |
| Find a real opponent for up to one minute, then select a bot | Transactional queue matching, exact 60-second emulator boundary and bot UI check |
| Start a shared countdown at five and enter the current game at zero | Server-owned start timestamp, browser countdown and gameplay checks |
| Show live opponent progress | Shared match state, existing `RaceGameplay`, two independent browser players |
| End immediately when a player solves all ten riddles | Terminal transaction, concurrent-finish integration test and terminal browser UI |
| Award 50 coins through the victory modal | Idempotent server grant, duplicate-request integration tests, modal and stored balance checks |

The requested feature is implemented and verified locally. Production rollout is the remaining release operation described below.

## Deployment

These changes are local and have not been deployed. Deploy the `joinLiveRace` and `updateLiveRace` Functions exports along with the Jest/Facebook clients. Deploy the updated Reddit client and Devvit server package so `/api/game/race.live.join` and `/api/game/race.live.update` reach the existing approved gateway host. The existing authentication, App Check, race rollout, Facebook age/capability gates and Reddit matchmaking feature gate remain in force.

The new `liveRaceTickets`, `liveRaceMatches`, `liveRacePlayers` and `liveRaceQueues` collections are private under the existing default-deny Firestore rules. Their records and command receipts carry an `expiresAt` field for retention configuration. Configure TTL for these new collection groups and the existing `requests` group as appropriate for the deployment.

Re-run the injected UI checks with `pnpm --filter @qwordly/portal test:race:live:browser`. The emulator suite is `firebase-functions/src/__tests__/race/raceLive.it.test.ts` and requires a demo-project Firestore emulator.

To repeat the browser check against the actual authority, first run `pnpm --dir firebase-functions build`, then:

```sh
LIVE_RACE_USE_EMULATOR=1 pnpm --dir firebase-functions exec firebase emulators:exec --only firestore --project demo-riddle-quest-live-browser 'node ../packages/portal/scripts/verify-live-race-browser.mjs'
```

Repeat the transport recovery browser checks with `node packages/portal/scripts/verify-live-race-delivery-browser.mjs`.
