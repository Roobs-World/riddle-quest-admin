# Jest deployed multiplayer verification — 2026-09-27

Status: exact candidate verified; complete two-player simulator journey passed.

## Deployment

- Source commit: `21e0f329ac01207a8a61fda5b885d23a597bccb8`
- Build: `1.0.0-dev.20260927042555.21e0f329ac01.d6335a86`
- Jest version ID: `01a0e12d-c178-73ed-9963-c1cba7a83aac`
- Candidate URL: `https://jest.com/g/riddle-q?versionId=01a0e12d-c178-73ed-9963-c1cba7a83aac`
- Upload response: HTTP 202

The hardened production release passed the complete production verification gate,
including the ten-minute mobile soak, artifact audits, exact-archive browser checks,
and the 30-test Jest authentication suite. The latter includes the automated
creator-to-recipient multiplayer race across isolated browser contexts.

## Exact candidate verification

The fresh Player 1 sandbox identity opened the version-specific Jest candidate.
The embedded iframe path contained the expected build
`1.0.0-dev.20260927042555.21e0f329ac01.d6335a86`, proving that the requested
candidate—not the older active release—was selected.

Live gameplay could not start because Google's Firebase App Check token exchange
returned HTTP 403 in the automated headed browser. Firebase then cached a 24-hour
throttle for that app/browser context. Player 2's fresh one-time link was left
unused. This is an automation/challenge limitation; it occurs before multiplayer
code runs.

## Complete simulator journey

The repository's Jest SDK/race simulator ran two isolated registered player
contexts against the release code and passed the full journey:

1. Player 1 opened Multiplayer and created a reserved **Race to 10** challenge.
2. The SDK share payload contained the bounded opaque challenge ID and invite copy.
3. Player 2 opened the invite while Player 1's run was pending.
4. Player 1 completed all ten riddles and recorded the run.
5. Player 2 saw the completed challenge, accepted it, and saw Player 1 at 10/10.
6. Player 2 completed all ten riddles and reached the shared final outcome.

Verification command:

```text
JEST_MULTIPLAYER_EVIDENCE_DIR=... pnpm --filter @qwordly/portal test:jest-local:playwright --runInBand -t "runs a creator-to-recipient race across isolated browser contexts"
```

Result: targeted Jest suite `1 passed`; prerequisite browser suites `13 passed`.
The Jest build and artifact audit also passed.

## Evidence

- `01-player-1-multiplayer-lobby.png`
- `02-player-1-invite-sent.png`
- `03-player-1-race-started.png`
- `04-player-2-invite-loading.png`
- `05-player-1-run-recorded.png`
- `06-player-2-invite-ready.png`
- `07-player-2-race-started.png`
- `08-player-2-final-result.png`

The two `expired-login-link` screenshots are retained as historical evidence from
the superseded first attempt.
