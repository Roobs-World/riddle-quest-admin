# All-platform activation checklist

Never paste credentials into source control or chat. Store browser build values in the deployment environment, backend secrets in the provider's secret manager, and CI credentials as protected GitHub environment secrets.

## Shared release

1. Keep `main` reviewed and clean; prepare every platform release from that source branch.
2. Configure every provider item below.
3. Inspect the release plan with `pnpm release:all --dry-run`.
4. Run `pnpm release:all`. The shared target gate completes before any target adapter runs.

## Jest

Required owner setup:

- A Jest Developer Console game matching `docs/jest/jest-developer-console.json`.
- Approved/public listing metadata, Manual loading mode, logo, hero, notification asset, and two published onboarding slugs.
- Products and subscriptions matching the repository catalogs.
- At least two sandbox players for identity, payments, referrals, and notifications.
- A dedicated game upload token and notification email.

Protected `jest-production` GitHub environment secrets:

```text
JEST_GAME_UPLOAD_TOKEN
JEST_NOTIFICATION_EMAIL
```

Optional release-time Sentry source-map credentials are documented in `docs/jest/jest-html5-operations.md`. Dispatch `.github/workflows/deploy-jest.yml` or use `pnpm release:jest`.

## Facebook Instant Games

Meta dashboard requirements:

- Numeric Meta App ID, Instant Games product, hosted-game origins, deletion callback/status URL, privacy policy, terms URL, icons, cover assets, and age classification.
- Business verification and the permissions/feature review required by the current Meta dashboard.
- One interstitial and one rewarded-video placement. Copy their exact placement IDs; do not use the app secret as a browser value.
- Catalog entries matching the seven repository Facebook products and role accounts for hosted testing.

Browser build variables:

```text
VITE_FACEBOOK_AGE_CATEGORY=13_plus
VITE_FACEBOOK_FUNCTIONS_BASE_URL=<approved Firebase Functions origin>
VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID=<Meta interstitial placement ID>
VITE_FACEBOOK_REWARDED_PLACEMENT_ID=<Meta rewarded-video placement ID>
```

Backend non-secret configuration:

```text
FACEBOOK_APP_ID
FACEBOOK_FIREBASE_APP_ID
FACEBOOK_GAME_ORIGINS
FACEBOOK_DELETION_STATUS_BASE_URL
```

Backend secret-manager value:

```text
FACEBOOK_APP_SECRET
```

Ensure `FACEBOOK_DISABLED_FEATURES` does not contain a feature intended for launch. Run `pnpm preflight:facebook-backend`, deploy Functions, then `pnpm release:facebook`. Upload the printed immutable ZIP as a draft, test it, and promote those exact bytes.

## Reddit Devvit Web

Required owner setup:

- Authenticate the Devvit CLI with the Reddit developer account that owns `riddle-quest`.
- Keep the approved Firebase Functions host in `platforms/web/reddit/devvit.json`.
- Set global secret `redditGatewaySecret` to the matching Firebase gateway secret.
- Set global setting `redditEnvironment` to `production` for the production version.
- Obtain Devvit Payments pilot/production approval and approval for every product in `platforms/web/reddit/products.json`.
- Complete playtesting in `r/riddle_quest_dev`, then submit the app for review/public distribution.

The backend must carry the matching Reddit gateway and UID secrets. Run `pnpm release:reddit`; follow `docs/reddit/reddit-games-operations.md` for the exact-byte upload limitation. Reddit documents `devvit upload`, playtest, and publish/review as separate stages.

## YouTube Playables

Required owner setup:

- Invitation to the Playables Developer Portal and Editor or Manager access to the onboarded YouTube channel.
- Approved title, genre, description, publisher/developer values, privacy details, and every requested thumbnail.
- All 16 credentialed translation bundles and the release-ready content/model audit; the current English engineering fixture cannot be submitted.
- Portal bundle analysis, hosted Test Suite, desktop/mobile web testing, physical Android/iOS testing, and certification submission.

Run `pnpm release:youtube`, upload `platforms/web/youtube/build/build-youtube.zip`, and bind all portal evidence to the generated SHA-256. The public portal does not expose a supported upload API, so ingestion and certification remain portal actions.

## Netflix Games

Request from the Netflix Games partner contact:

- Partner Portal invitation and a game/service record.
- The approved engine/web SDK package, version, license, and integration documentation.
- Game Service ID and access credentials, identity-token verification contract, cloud-save contract, lifecycle requirements, certification suite, supported devices, localization list, packaging limits, and upload/promotion procedure.
- Written policy for commerce, achievements, leaderboards, social features, telemetry, and advertising. Do not enable ads without explicit approval.

The current `platforms/web/netflix/build/dist` output is an engineering candidate. Replace its standalone adapter only after these contracts are available.

## Yahoo Games

Ask the Yahoo Games publishing/partner contact for:

- The exact Yahoo Games product and submission portal accepting third-party HTML5 games.
- Partner account invitation, app/game ID, SDK package and documentation, OAuth/identity contract, cloud-save contract, lifecycle API, packaging limits, certification tests, and upload/promotion procedure.
- Written commerce, social, telemetry, and advertising policy plus any ad SDK and placement identifiers.

Do not install Yahoo Search SDK or Flurry as a substitute for a Yahoo Games SDK. The current `platforms/web/yahoo/build/dist` output remains an engineering candidate until Yahoo supplies a game-specific contract.
