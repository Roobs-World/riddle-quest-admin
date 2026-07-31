# Jest HTML5 production operations

Riddle Quest is a standard React HTML5 game. It has no React Native, Expo, Android, iOS, admin-panel, external-auth, ad, or native-purchase release path.

## Local release verification

```bash
pnpm --filter @qwordly/portal build:jest
PORTAL_BROWSER_TESTS=1 pnpm --filter @qwordly/portal exec jest \
  --config jest.config.cjs \
  src/play/__tests__/hostedBrowser.jest-playwright.test.ts \
  --runInBand
pnpm --filter @qwordly/portal test
pnpm --filter @qwordly/core test
pnpm --dir firebase-functions test
pnpm --dir firebase-functions lint
pnpm build
```

The Fund-facing end-to-end check must target the active uploaded build through a real registered Jest sandbox session:

```bash
JEST_SANDBOX_LOGIN_URL='https://jest.com/...' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

Generate the short-lived login URL from **Developer Console → Sandbox Users**. The test opens the deployed Riddle Quest route after sandbox authentication; `JEST_DEPLOYED_GAME_URL` can override the default `https://jest.com/g/riddle-q` route. The test rejects direct storage-origin access, local servers, and `harness=` mock mode; it requires the game iframe at the configured `*.builds.jest.com` origin and verifies real identity and riddle Function traffic.

The authenticated browser state is cached only in `/tmp/riddle-quest-jest-sandbox-state.json` so a consumed one-time link can be reused while diagnosing a failed run. Set `JEST_SANDBOX_STORAGE_STATE` to override that ephemeral path.

`build:jest` validates the canonical progress tracker, TypeScript, every imported locale JSON file, the production build, and the standalone artifact. The artifact audit enforces the 5 MB limit, local relative assets, the single approved Jest SDK script, and the absence of native modules, external authentication, ads, install prompts, secrets, and source maps.

## Current projects

- Firebase project: `riddle-quest-ec2b2`
- Firebase web app: `1:329028367192:web:b85776d379ea3356b7eb2d`
- Jest team: `019faa67-d2a6-7169-aa29-a4411a3a3c3d`
- Jest game: `019faa68-f3ec-755d-9ab5-c887fb426801`
- Jest outer origin: `https://jest.com`
- Jest build origin: `https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com`
- Functions base URL: `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net`

The committed `packages/portal/.env.jest` contains public Firebase client configuration. `JEST_SHARED_SECRET` remains in Firebase Secret Manager. The only deployed Functions are the authoritative Jest identity, purchase, referral, profile, leaderboard, riddle, and gameplay boundaries; the obsolete legacy-migration Functions have been deleted.

## Build and upload

Copy `packages/portal/.env.jest-upload.example` to the ignored `packages/portal/.env.jest-upload.local`, then set the game upload token and notification email. The release tooling also accepts the legacy ignored `packages/portal/.env` file:

```bash
pnpm jest:build-upload
```

The command creates a timestamped version, builds and audits `dist-jest`, creates the ignored `packages/portal/build.zip`, uploads it to the current game, and requests Draft activation after processing. It does not publish the game or submit it for review.

The last accepted current-game upload was:

- Build: `1.0.0-dev.20260731000321`
- Jest version: `019fb57b-a3ff-777b-9a12-a7755d058a70`
- Upload result: active on the Jest game route

## Developer Console setup

Owner access to `https://jest.com/developers` is required:

1. Select Manual loading mode.
2. Create the six consumable SKUs listed in `JEST_PRODUCT_SKUS` in `firebase-functions/.env.example`.
3. Create a monthly subscription with the exact SKU `com.roobsworld.riddlequest.premium.monthly`, matching `JEST_SUBSCRIPTION_SKUS`. The deployed acceptance test deliberately fails if this subscription is absent from Jest's live catalog.
4. Upload the showcase assets and select:
   - logo: `assets/images/icon.png`
   - hero: `docs/jest-assets/riddle-quest-hero.png`
5. If a dedicated notification image is approved, set its reference as `VITE_JEST_NOTIFICATION_ASSET_REFERENCE`. Without one, Jest uses the configured Hero image.
6. Create at least two sandbox players.
7. Activate the audited Draft build and run the acceptance matrix below.

## Sandbox acceptance matrix

- Identity: guest and registered startup; dismissal and cancellation; stable player ID; invalid and stale token rejection.
- Loading: every manual phase advances; no 15-second timeout; retry works; overlay closes only when input is enabled.
- Analytics: the first authoritative win marks the first milestone once; registration and attribution events contain no personal data.
- Notifications: D1/D3/D7 replacement and removal; registered-only behavior; Daily Cosmic Riddle payload return.
- Payments: success, cancellation, internal error, invalid SKU/token, timeout, interruption before completion, and multi-page recovery.
- Referrals: canceled share; specific-riddle first entry; two-sided reward; duplicate, tampered, and unrelated-reference rejection.
- Layout/input: keyboard, pointer, and touch in portrait and landscape; background/foreground; audio unlock; offline restart.
- Stability: lower-end iOS Safari and Android Chrome cold/warm launch plus a 10-minute foreground/background soak.

Attach screenshots, recordings, event IDs, and device traces to the matching rows in `docs/html5-riddle-quest-progress.html`, then run:

```bash
pnpm --filter @qwordly/portal check:progress
```

## Jest Games Fund readiness

- **User acquisition:** guests see the custom registration step immediately after the instructions and again after an authoritative win when the cooldown permits. Jest onboarding `customName`, campaign, source, and reference values are preserved through the native registration overlay.
- **Notifications:** registered players receive fuzzy D1, D3, and D7 schedules early in the session. Stable identifiers replace the existing schedule whenever level, wins, streak, name, or locale changes. Each localized message has distinct reward-focused copy and carries template, offset, campaign, and callback attribution back into the Daily Cosmic Riddle.
- **Virality:** the victory modal creates an outside-network Jest referral share containing the exact challenge destination, a spoiler-free result image, and localized result text. Referral grants are verified and applied server-side with stable campaign and player idempotency keys.
- **Monetization:** consumables and the monthly subscription use the Jest payment APIs. Signed receipts and subscription state are verified server-side; SKU grants are idempotent; canceled or failed transactions do not mutate balances; and incomplete purchases are recovered page-by-page before normal play.

Automated coverage proves the integration contract and failure handling. Before a Fund submission, repeat the Notifications, Payments, and Referrals rows above with real Jest sandbox players and retain the Developer Console evidence; local mocks cannot prove catalog configuration, delivery by the messaging network, or live payment settlement.
