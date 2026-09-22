# Submission and dashboard audit — 22 September 2026

The catalog covers 55 destinations: 52 executable local release paths and three explicit external gates (Discord, Poki and LINE MINI App). A successful local package is not evidence of SDK integration, provider upload, review approval or publication.

## Verified work

- Rebuilt the provider-neutral game and refreshed all 44 distributor archives, the installable Microsoft PWA archive and the GameSnacks SDK archive.
- All 48 packaged browser flows passed: 46 ZIPs plus Netflix and Yahoo candidate directories. Each solved a riddle, checked its reward and retained progress after reload. The PWA also passed offline checks. Exact tested ZIP digests are recorded in `artifacts/release-e2e/packaged-games.json`.
- The release integrity audit passed for all 55 tracked destinations, including 47 ZIPs (the additional ZIP is the separately gated YouTube package), the four primary browser builds and Reddit client/server artifacts.
- The six isolated target builds and injected platform/currency/instant-answer checks were already completed for the game code in this release; see `instant-answer-feedback-2026-09-22.md` and `platform-currency-2026-09-22.md`. This audit changes monitoring and release reporting, not gameplay code.
- Replaced unconditional “ready” automation rows with archive/manifest validation and matching successful browser-test digests. Unverified or missing packages remain visibly pending or invalid. Provider records retain their own evidence dates. CI now runs packaged browser checks before generating readiness rows.
- Corrected the Jest analytics collector from obsolete game `019f5674-93a8-7338-a664-8e603d6bda06` to production game `019faa68-f3ec-755d-9ab5-c887fb426801` and production team `019faa67-d2a6-7169-aa29-a4411a3a3c3d`. Removed unrelated player counts. The connected account lacks `games:read` for the production game; fresh analytics remain unavailable, not zero.
- Corrected Yahoo to a provider-neutral candidate with browser-local saves and no purchases. Removed stale dashboard claims of active Yahoo OAuth and Stripe checkout.
- Added a generation-checked cloud publication command, `node scripts/monitoring/publish-release-status.mjs`. It updates release evidence while preserving newer backend/player measurements and retries concurrent collector writes without losing their data.
- 31 relevant regression tests passed, including digest mismatch, missing/failed browser evidence, correct Jest game binding, cloud snapshot identity and concurrent collection.
- Protected dashboard runtime integrity passed. Desktop (1440px) and mobile (390px) rendered the current submission rows without JavaScript errors or document overflow. The hosted Vercel dashboard HTML was compared byte-for-byte with the verified build.

## Published dashboard destinations

- Public release snapshot: https://riddle-quest-release-dashboard.vercel.app
- Existing private live monitor: https://riddle-quest-monitoring-329028367192.us-central1.run.app

The Cloud Run collector successfully refreshed 132 backend deployment rows on 22 September at 15:46 UTC and retained all 55 updated release records. Its Jest status is `Connection required`. Dashboard identity, layout, access controls and existing cloud data remain preserved. The public snapshot is a point-in-time report; the private monitor retains its hourly collection schedule.

## Remaining provider gates

| Destination | Verified state and remaining action |
| --- | --- |
| Jest | Latest upload accepted at 15:32 UTC, version `01a0c9be-d592-7711-89c4-6f8105715f38`; activation is unconfirmed. Sign in to the production team, reconcile the pending receipt and run the exact-version live sandbox check before review submission. No duplicate upload was attempted. |
| Facebook | Older Testing/review evidence retained. Reconcile the 27 August transmitting receipt, then confirm identity/business approval before uploading the new draft and completing review. |
| Reddit | Latest Firebase gameplay backend deployed. New Devvit release blocked by all six required approved contract fixtures, approved outbound-host evidence and exact-byte ingestion proof. |
| YouTube | Canonical immutable bundle and test report prepared. Partner Portal access, upload and certification remain outstanding. |
| Netflix / Yahoo | Candidate gameplay verified; Yahoo candidate is hosted live. Approved partner SDK/delivery contracts and provider submission remain outstanding. |
| Remaining distributors | Current neutral packages pass gameplay checks. Individual accounts, contracts, required SDK work, listings and human/provider review are still separately listed in the dashboard. |

See `live-deployment-2026-09-22.md` for the live game deployments and exact accepted Jest/YouTube release digests. No new provider review approval or public partner listing is claimed by this audit.
