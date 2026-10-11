# Optional live guess receipt adapters — 9 October 2026

The target-neutral live capability now exposes optional `confirmGuessReceipt(query)`. The shared Firebase adapter used by Jest and Facebook lazily calls `confirmLiveGuessReceipt`, validating both locator and acknowledgement. Reddit's authenticated bootstrap validates the same contracts and sends only a same-origin POST to `/api/game/race.live.receipt`. The Devvit server allowlist relays that operation through its existing signed gateway to the approved Functions host; the Reddit browser receives no Firebase SDK.

The signed Functions dispatcher routes the operation to the read-only callable and preserves safe live error categories. Existing signature verification, one-use nonces, quotas and feature switches remain enforced. The observer does not acquire a mutation lease, renew a seat or change canonical gameplay/economy state. Gateway nonce/quota records intentionally change as security accounting; the entire gateway is not claimed to perform zero database writes. It returns `Cache-Control: no-store`; neither adapter caches acknowledgements.

The executed signed-gateway case observes `unconfirmed` before the original command is scored, then `accepted` on fresh signed requests after scoring. Exact nanosecond update times and data show the ticket, match and user balance remain unchanged by lookup. Extra account, guess and action selectors are rejected. Client adapter cases validate actual lazy calls and same-origin payloads, reject malformed acknowledgements, and preserve unavailable-endpoint errors for caller fallback. The new callable is included in the existing gameplay-region contract, leaving account/commerce routing unchanged.

## Verification

- Pinned Node 22 compilation, client/Devvit type checks, backend lint, TSDoc and file-size audits pass.
- 81 real Firestore SDK cases across five selected suites pass: existing live races, proof creation, proof lookup, signed receipt gateway and existing signed retirement gateway. This is a targeted selection, not the whole backend SDK matrix.
- 1,769 backend cases in 141 suites, 391 core cases, 3,096 client cases in 306 passing suites, and 51 Devvit cases pass. Client unit runs exclude browser suites.
- All six isolated target builds plus Devvit pass. Target artifact audits protect self-contained YouTube/Netflix/Yahoo and Reddit SDK isolation.
- 22 injected hosted browser cases plus the separate Facebook 13+ injected journey pass. These verify existing startup, solo and multiplayer behavior; they do not yet prove receipt-assisted draft recovery because that UI integration remains pending.
- Final before/terminal/verified manifests match 2,522 selected source inputs, not every content/public file. An initial client run exposed the new endpoint missing from two callable test inventories; these were updated, and the final client/core/Devvit/backend/SDK/build/browser checks passed. The recorded source-cohort delta contains only the callable test file and an SDK fixture description correction.
- Archived output retains 1,299 built files, 796 compiler-output files across two compilations, and seven dependency inventories including the browser-owned Facebook fixture. Owned temporary roots are absent; all six final emulator ports were verified closed from the host namespace.

No visible text was added. No external deployment or hosted Devvit publication was made. The remaining implementation is bounded, cancellation-safe client lookup and exact receipt-bound draft recovery under [ADR 0006](../adr/0006-live-guess-receipt-recovery.md). The delayed-reply typing gap remains until that client stage is implemented and verified.

Evidence: `artifacts/live-guess-receipt-adapters-2026-10-09/`; verify with `python3 artifacts/live-guess-receipt-adapters-2026-10-09/verify.py`.
