# Facebook native tournaments alongside Live PvP — 2 October 2026

The Live PvP entry had removed the route to Facebook's existing official
standings and native tournament SDK. The adapter was still composed, but neither
ordinary navigation nor a valid incoming native invitation could reach it. The
Facebook smoke suite had also stopped calling its native tournament checks.

The restored browser assertion failed against the production artifact while
waiting for the French tournament tab. The Facebook target now supplies a lazy
multiplayer presentation through a neutral component prop. Shared modules never
import Facebook code; all other targets retain the shared Live PvP screen.
Facebook exposes Play and Tournaments only when its authenticated tournament
capability exists. Native invitations can select that destination without
changing content language or starting a race. Existing translations supply all
visible copy. Keyboard selection, modal focus, mobile and desktop layout are
verified in the injected artifact.

The restored board uses the existing FBInstant v8 tournament adapter:
`getTournamentAsync`, `tournament.createAsync`, `tournament.shareAsync` and
`tournament.postScoreAsync`. It reads exact-schema, locale-bound server
standings, contains duplicate dialogs, bounds board reads to eight seconds,
retires late responses, and retains language-mismatch/retry guidance. Provider
standings and scores never become official result or currency authority.

Live PvP had a second incompatibility: its private records live in
`liveRaceTickets` and `liveRaceMatches`, while the existing official recorder
looked only in `raceRuns` and `raceDecks`. The recorder now additionally resolves
an owned Facebook live ticket. It requires the private match winner, genuine
completed ten-solve run, server clocks, and the creator's frozen deck. Both
players use that creator deck; the joiner's earlier search deck is unrelated.
The live five-second countdown is checked separately from the recorded engine's
three-second readiness contract, before common scoring validation. Hint and skip
penalties remain part of the adjusted score. Public terminal projections, which
also mark losers and forfeits completed, cannot qualify a run.

The Facebook presentation submits only the opaque ticket ID and locale after a
validated ten-solve victory. The existing authenticated callable enforces the
provider, kill switch and account-operation lease. Official best-score writes
remain transactional, finish-day bound and idempotent, with no economy writes.
The native score is projected only from the confirmed fresh official best. A
failed background record is reported; durable client-side retry after a browser
crash is not added by this change. The server accepts idempotent re-submission,
including after midnight.

The [Live PvP consent follow-up](facebook-live-consent-2026-10-02.md) additionally
connects this Facebook result lifecycle to the existing first-win notification
coordinator, independently of tournament support. Its fresh persistent artifacts
and final browser evidence supersede the interrupted scoped Jest run in this
directory; the earlier temporary build directories are no longer available.

Executed validation:

- All six isolated production builds and explicit-directory SDK/artifact audits
  pass: Facebook, Jest, Reddit, YouTube, Netflix and Yahoo.
- Both injected Facebook and Reddit Chromium journeys pass. Facebook additionally
  covers native create/share, double taps, fresh score, incoming invitations,
  disabled/malformed entry, locale mismatch, keyboard focus, and the live-result
  record-to-native-score path. A nine-solve forfeit triggers no record.
- Full portal unit invocation: **257 suites / 2,123 tests pass**;
  **15 browser suites / 114 tests are skipped** in this unit invocation.
- Functions Node 22: **41 focused unit tests** pass. Types, module-cycle checks
  and lint of the changed Functions files pass.
- A private demo Firestore emulator runs the real live matchmaking/guess engine
  and official recorder: **8 integration tests** pass. They cover both winning
  seats, four concurrent submissions, midnight recovery, unchanged coins,
  hint/skip costs, unfinished/forfeit rejection, ownership/locale rejection, and
  corrupted deck/match/finish rejection. Existing recorded-run convergence stays
  covered. A test-loader failure and the initially incompatible countdown are
  retained as diagnostics, not provider failures.
- All **146 release-script tests** pass. No assertion was removed or weakened.

See `artifacts/facebook-live-tournament-2026-10-02/` for commands, logs, build
paths, retained diagnostic failures, screenshots and source/artifact hashes.
These are local diagnostic outputs from a shared dirty workspace. They are not a
clean immutable upload candidate, signed-provider fixtures, hosted Meta review
acceptance, or physical-device evidence. Real Meta create/share/join/score,
expiry, age/API availability and cancellation acceptance remain outstanding.
Purchases, rewarded-grant rollout, scheduled notification delivery, translations,
IAM and review reconciliation retain their existing gates. No deployment,
upload, provider settings change, purchase, reward grant or notification send
was performed by this work.
