# Jest deployed multiplayer verification — 2026-09-27

Status: deployment accepted; live two-player test blocked by expired sandbox login links.

## Deployment

- Source commit: `21e0f329ac01207a8a61fda5b885d23a597bccb8`
- Build: `1.0.0-dev.20260927042555.21e0f329ac01.d6335a86`
- Jest version ID: `01a0e12d-c178-73ed-9963-c1cba7a83aac`
- Upload response: HTTP 202, processing pending
- Activation intent: automatic activation after successful Jest processing

The hardened production release passed the complete production verification gate,
including the ten-minute mobile soak, artifact audits, exact-archive browser checks,
and the 30-test Jest authentication suite. The latter includes the automated
creator-to-recipient multiplayer race across isolated browser contexts.

## Live sandbox attempt

The deployed test runner tried both supplied one-time sandbox login links in
separate headed browser sessions. Jest returned `The link has expired` for both,
before a game iframe or authenticated player session could be created. No retained
Jest cookies were present in the prior browser profiles.

Because the release receipt was still pending and both authentication links were
expired, the runner could not prove the exact active iframe version or perform a
new live two-player invite/race. Fresh one-time sandbox login links for two players
are required to continue.

## Evidence

- `player-1-expired-login-link.png`
- `player-2-expired-login-link.png`
