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

This work is local and has not been deployed. Deploy the Firestore index and updated leaderboard/live-race backend before releasing the connected clients. Self-contained targets remain isolated from multiplayer and provider services.
