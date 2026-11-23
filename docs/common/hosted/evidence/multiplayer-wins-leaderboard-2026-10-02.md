# Multiplayer wins leaderboard

The existing leaderboard now offers a **Multiplayer wins** measurement alongside XP, Wins, and Streak. It displays server-confirmed multiplayer victories in descending order, returns to the first page when measurements change, and retains the existing loading, empty, avatar, and pagination behavior. Labels are translated in all 16 supported locales.

The callable reads canonical `users.stats.multiplayerWins` directly, with a positive-score filter and the requested limit (maximum 100). It does not scan a fixed sample of accounts or depend on stale solo leaderboard projections. The explicit descending single-field index in `firebase-functions/firestore.indexes.json` overrides the existing exemption on the `stats` map. Existing recorded multiplayer totals are included; live wins that predate account win counting are not retroactively reconstructed.

Live race settlement increments the winner's total in the same transaction that records the one-time coin reward. Repeated commands, polls, and concurrent finishes cannot increment it again. Losing players, countdown cancellations, and ties do not receive a win. This preserves other account statistics. Reddit continues to request the measurement through `/api/game/leaderboard.list` and the existing Devvit gateway.

## Validation

- Focused client tests cover multiplayer rendering, older rows, cached-ranking invalidation, and Reddit's same-origin request contract.
- Backend tests cover the indexed canonical-account query, positive-score filtering, requested limits, and empty multiplayer rankings.
- Firestore emulator live-race tests cover 24 scenarios, including existing win totals, simultaneous finishes, repeat commands, cancellation, and forfeits.
- The built Jest injected harness checks bridge routing, score ordering, tab switching, pagination reset, keyboard focus, overflow, and WCAG accessibility at 1280px, 390px, and 280px.
- A second injected harness checks all 16 locales at those widths, including Arabic direction, translated buttons, and empty rankings.
- The six isolated target build commands and artifact audits run for Jest, Facebook, Reddit, YouTube, Netflix, and Yahoo; the Reddit package contract is checked separately.

Logs and screenshots are saved in `artifacts/multiplayer-wins-leaderboard/`. The broad existing hosted-browser scenario stops at its earlier multiplayer category assertion, before reaching the leaderboard. The focused harness covers this feature independently. The repository-wide TSDoc audit currently reports undocumented declarations in separate in-progress work; no leaderboard declarations are reported.

## Release

The user reported deployment, and follow-up checks on 2026-10-02 confirmed the Jest client and both backend functions contain the feature:

- Jest version `01a0fdd1-98b5-750e-ab1c-f83cb6536155`, build `1.0.0-dev.20261002181230.bde26d430c08.b0d01aba`, visibly includes the **Multiplayer wins** tab under Profile → Leaderboard.
- `getLeaderboard` revision `getleaderboard-00036-rux` is ACTIVE, updated at 17:21:01 UTC. Its deployed source archive contains the positive canonical-user filter and descending multiplayer-wins query.
- `updateLiveRace` revision `updateliverace-00004-zin` is ACTIVE, updated at 18:14:31 UTC. Its deployed source archive contains the multiplayer win counter.

The first deployed Firestore check found the child field inheriting the unindexed `stats` map. The ranking query failed with `FAILED_PRECONDITION`, so the missing descending collection index was applied directly at 18:19:48 UTC using the exact repository field override. This narrow repair did not redeploy functions or other indexes. The operation completed successfully at 18:25:39 UTC; the index is READY.

The final masked Firestore query returned HTTP 200 and nine rows with scores `5, 5, 3, 2, 2, 2, 2, 2, 1`. After refreshing the deployed Jest version, Profile → Leaderboard → Multiplayer wins displayed the same nine scores in the same order. This browser check used Jest's signed-in Sandbox User session; it confirms the deployed version, without asserting a separate public-release promotion. The screenshot is `artifacts/multiplayer-wins-leaderboard/deployed/live-leaderboard.jpg`.

Deployment metadata, sanitized score-only query evidence, and the index operation are saved in `artifacts/multiplayer-wins-leaderboard/deployed/`. The deployed source checks confirm the shipped code; repeat/concurrent settlement correctness remains supported by the emulator tests above. This follow-up does not create matches or alter account win totals. Self-contained targets remain isolated from multiplayer and provider services.
