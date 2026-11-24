# Multiplayer AI opponents

Public random matchmaking uses a server-controlled opponent when no human opponent is available. Live and recorded fallbacks share `generateRaceBotName` in `firebase-functions/src/race/matchmaking/raceBotName.ts`. It selects one of 100 verbs and one of 100 nouns from independent hashes of the server-owned match or offer ID. The resulting PascalCase username has at most ten characters, such as `DashFox`. Retries keep the same name. These are fictional usernames, so the word lists do not use locale strings.

AI victories accumulate by username in the server-only `raceBotLeaderboard` collection. Its document ID is `race-bot-` followed by the SHA-256 hash of the name. Each document stores `username`, `multiplayerWins`, and `updatedAt`. Bots have no player accounts, currency, referral rewards, or solo scores.

Live settlement increments the AI total in the transaction that first settles a started match. This includes a human forfeiting after the start. Cancelling during the countdown or drawing adds no win. Recorded fallback settlement increments on a confirmed opponent victory. Both paths require the human account to remain active and use their existing terminal receipt to prevent duplicate increments.

The multiplayer-wins leaderboard reads at most the requested limit from each of the canonical player totals and AI totals. It combines the scores, sorts descending, and applies the requested limit to the result. Other leaderboard measurements keep their existing player-only behavior. The new collection uses Firestore's default single-field indexing and default-deny client rules.

Deploy the updated race settlement functions and `getLeaderboard`, and update multiplayer clients to display the short names. Existing settled matches are not backfilled. Builds and source changes do not deploy these changes or authorize game uploads.
