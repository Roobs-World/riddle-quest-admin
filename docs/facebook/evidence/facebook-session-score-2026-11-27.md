# Facebook session-score integration — 27 November 2026

This records the session-score adapter implementation. It is not hosted acceptance, upload, review or publication evidence. Root integration, the Facebook build and Meta-hosted verification must be recorded separately.

## Score definition and authority

General Facebook session scores use `RACE_MAX_ADJUSTED_TIME_MS - adjustedTimeMs`. The shared race contract defines the ceiling as 300,000 milliseconds. A completed ten-answer race taking 120,000 adjusted milliseconds therefore produces 180,000 points; a slower 150,000-millisecond run produces 150,000 points. The transformation preserves the authoritative race ordering while presenting higher points for faster completion. Existing server penalties are already included in adjusted time. The score grants no coins, entitlements, standings or rewards.

The adapter accepts only the strict `RecordFacebookTournamentRunResponse` parser and requires the response's `runId` to match the requested run. That authenticated server operation verifies a completed qualifying Race to 10 run; browser timers, local guesses, balance and arbitrary native payloads never nominate the score. A response that refers to an older best run rather than the requested run is skipped. Runs completed before this adapter's account session began are skipped. Recording a receipt only makes the explicit share-score action available; it does not open a native dialog.

Meta requires integer session scores from comparable completed activities and warns that excessive calls are rate limited. The asynchronous method may produce native dialogs and change context before it resolves. The adapter uses the asynchronous method when advertised and callable, otherwise its synchronous alternative; it never calls both for one receipt. [Session-score reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#postsessionscoreasync)

## Native tournament isolation

Existing official tournament projections use raw adjusted milliseconds with `LOWER_IS_BETTER`. Reversed session points must never be written into that native leaderboard. The adapter requires advertised, callable `getTournamentAsync`, and posts only after the explicit `TOURNAMENT_NOT_FOUND` error proves the current native session is outside a tournament. A returned tournament, unknown/error response, missing API or an eight-second metadata deadline skips posting. It rechecks the captured context, active account, locale, visible game and caller-owned presentation guard immediately before admission. [Current tournament contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#gettournamentasync)

The shared Facebook dialog gate prevents overlap with native invitations, payments, ads or other dialogs. The player clicks a lobby action to publish the score. That action owns an abort signal which retires when the surface unmounts or its locale changes, preventing delayed metadata from opening UI over a new activity. Every admitted native score attempt is followed by reconciliation with the existing context coordinator while the account remains current, including after rejection or when the initiating surface has since closed: a response can be lost after the native context changed. Account retirement invalidates late metadata work and prevents further posts.

## Delivery behavior and wiring

`createFacebookSessionScore` takes the initialized SDK, `isActive`, `canPresent`, `getLocale`, `synchronizeContext`, and optional fixed-operation diagnostics. The entry must instantiate it only for an authenticated, enabled 13+ tournament session. Call `sessionScore.record(runId, response)` after the authoritative record operation succeeds. This synchronous method retains an opportunity and returns immediately. Wrap the game in `FacebookSessionScoreProvider` and mount `FacebookSessionScoreActions` in the Facebook race lobby. Its translated action invokes `publish(surfaceSignal)`. Retire the controller on cleanup and account deletion.

Only a strictly improved score is attempted during the controller's lifetime. The run is marked before SDK invocation because an error can follow a delivered side effect; it is not automatically retried. Duplicate record callbacks cannot create another native action, and a pending publication rejects a second click. Failures are contained and never reject an already-completed game operation. No score or raw SDK payload is included in diagnostics.

No tests, browser harnesses or builds were run by this implementation unit, in accordance with repository instructions. Static review and `git diff --check` are the local checks available at this stage.
