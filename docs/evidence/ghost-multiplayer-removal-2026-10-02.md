# PvP-only multiplayer entry

Race to 10 now opens a live PvP category selector and starts only the active target adapter's live matchmaking capability. Selecting a category changes the selection; the Start PvP match button joins the live lobby. The existing live countdown, progress, reward and bot fallback remain available.

The application no longer mounts the recorded race session or its challenge, activity, tournament and sharing screens. Retired challenge, inbox and tournament links open the same PvP intro. Stored recorded-run pointers cannot trigger a resume request. Missing live capability disables starting and displays the existing translated unavailable message rather than falling back to recorded matchmaking.

Removed the unused recorded-mode label from all 16 locales. Renamed the opponent-victory translation and shared score properties to neutral opponent terminology, preserving the translated values. Existing server data and recorded-race protocol/domain modules remain intact for compatibility; this change does not delete records or retire deployed backend endpoints.

## Local verification

- 123 client multiplayer regression suites passed: 1,095 tests, including retained protocol contracts and updated PvP-only entry assertions. Separate locale and presentation checks passed (26 tests).
- Injected StrictMode browser checks passed at 1280 × 900 and 390 × 844: category selection, retired entry links, stored recorded-run pointer, absence of recorded navigation, live lobby/countdown, two-player progress, immediate victory and 50-coin presentation, return to the PvP intro, missing capability, and live bot fallback. The harness records bridge traffic and asserts that the entry issues only category reads and never calls recorded matchmaking.
- Transport recovery checks passed at both widths: a stalled join retries with its original request ID, guesses bypass a stalled poll, late polls cannot replace newer state, and reconnection reconciles an accepted guess without duplicate scoring.
- Lifecycle browser checks passed at both widths: unmount retires joined and delayed seats, and the shared countdown withstands forward and backward one-hour wall-clock changes.
- All six production client builds and their target artifact audits passed: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Type checking, 16-locale parity and source-size checks passed.

Logs and PvP-only screenshots are saved under `artifacts/ghost-mode-removal/`. Re-run the main browser check with `LIVE_RACE_REPORT_DIR=../../artifacts/ghost-mode-removal/browser pnpm --filter @qwordly/portal test:race:live:browser`.

The changes are local and have not been deployed.
