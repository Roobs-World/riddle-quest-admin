# Multiplayer AI opponents

Public random matchmaking uses a server-controlled opponent when no human opponent is available. Live searches wait up to six seconds before the next authoritative join recovery or poll seats a bot. Recovering an interrupted join uses the original ticket and deadline, so Retry does not restart the search. Private friend invitations continue waiting for the invited player.

Live and recorded fallbacks share `generateRaceBotName` in `firebase-functions/src/race/matchmaking/raceBotName.ts`. It produces `Guest_` followed by six uppercase hexadecimal characters derived from the server-owned match or offer ID. Retries keep the same guest username. Existing matches retain their previously assigned names. These are fictional usernames, so they do not use locale strings.

AI victories accumulate by username in the server-only `raceBotLeaderboard` collection. Its document ID is `race-bot-` followed by the SHA-256 hash of the name. Each document stores `username`, `multiplayerWins`, and `updatedAt`. Bots have no player accounts, currency, referral rewards, or solo scores.

Live settlement increments the AI total in the transaction that first settles a started match. This includes a human forfeiting after the start. Cancelling during the countdown or drawing adds no win. Recorded fallback settlement increments on a confirmed opponent victory. Both paths require the human account to remain active and use their existing terminal receipt to prevent duplicate increments.

The multiplayer-wins leaderboard reads at most the requested limit from each of the canonical player totals and AI totals. It combines the scores, sorts descending, and applies the requested limit to the result. Other leaderboard measurements keep their existing player-only behavior. The new collection uses Firestore's default single-field indexing and default-deny client rules.

The guest-name and join-recovery changes require deploying `joinLiveRace`, `updateLiveRace` and `startRaceRun`. Existing settled matches are not backfilled. Builds and source changes do not deploy these changes or authorize game uploads.
