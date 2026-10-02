# Deployed coin economy verification — 2 October 2026

The user confirmed that deployment had occurred and requested verification of both Firebase and the latest Jest build. The separate deployment chat records successful Functions deployment after commit `6a58097b`; this follow-up verifies the deployed resources rather than relying on that report alone.

## Backend

Read-only Google Cloud Functions metadata confirms `getHint`, `spendCoins`, `skipRiddle`, and `completeGame` are ACTIVE in both `us-central1` and `europe-west1`. The exact generation of each deployed source archive was inspected. All eight endpoints contain the same compiled economy module, SHA-256 `855a4b2583722f79d95a7eaa36876af9593eb1067334d19a31f9c275f9ad47c0`.

Executing the selected dependency-free compiled modules verifies hint/continue/skip costs of **25/50/100**, Classic easy/medium/hard grants of **25/40/60**, and Daily grants of **75/100/125** in both regions. Selected compiled gameplay files also show difficulty pinned into the private session and derived completion data replacing caller difficulty with the authoritative session rating. Source archives were removed after inspection; only selected economy code, hashes and sanitized metadata were retained.

The live race join, update and challenge-preview functions are also ACTIVE in both regions. Their metadata includes a later join/update deployment during concurrent latency work; the economy check does not claim all functions share one immutable deployment timestamp.

## Latest Jest build and catalog correction

Jest MCP identified the latest ready, active build as:

- Version ID: `01a0fdd1-98b5-750e-ab1c-f83cb6536155`.
- Version: `1.0.0-dev.20261002181230.bde26d430c08.b0d01aba`.
- Activated: 2 October 2026 at 19:12 BST.
- Launch: <https://jest.com/g/riddle-q?versionId=01a0fdd1-98b5-750e-ab1c-f83cb6536155>.

The real registered sandbox browser session loaded that exact artifact. The purchasing-power copy was correct, but its actual Jest catalog still used the older prices. The 550-coin pack gave less value per dollar than the starter; the 7,000-coin pack cost $49.99 and gave less value than the 3,400-coin pack despite its Best Value badge.

Following the original authorization to improve shop prices, all six existing Jest products were repriced through Jest MCP to the documented economy ladder. Readback verifies:

| Coins | Previous USD price | Corrected USD price | Coins per USD |
| ---: | ---: | ---: | ---: |
| 250 | $1.79 | $0.99 | 252.53 |
| 550 | $3.99 | $1.99 | 276.38 |
| 900 | $5.99 | $2.99 | 301.00 |
| 1,600 | $7.99 | $4.99 | 320.64 |
| 3,400 | $15.99 | $9.99 | 340.34 |
| 7,000 | $49.99 | $19.99 | 350.18 |

Product IDs, SKUs and coin quantities are preserved. The provider-created price records confirm the update. A fresh load of the same deployed game displays every corrected price and the matching whole-action alternatives; the largest pack now merits its Best Value badge. This is a live Jest catalog change, not a new client upload or Functions deployment.

## Browser coverage and limits

The deployed UI displays the 25-coin hint and 100-coin skip confirmations. Confirming one hint successfully revealed a letter, and the observed production `getHint` Fetch returned HTTP 200. An achievement overlay also settled previously eligible rewards, so the net balance change is not asserted as a standalone 25-coin deduction. No real-money checkout was performed.

Multiplayer entry reached a server-backed existing private live lobby, displayed the current player and friend invitation controls, and reported no visible error. This is entry/recovery evidence; it does not claim a fresh two-player race, victory settlement, or real invitation delivery. The earlier injected provider walkthroughs and full client/backend unit checks remain documented separately.

Evidence: `artifacts/economy-deployment-verification-2026-10-02/`, including provider catalog before/after, exact build identity, function metadata, deployed code hashes, compiled-rule assertions and `latest-jest-shop.jpg`.
