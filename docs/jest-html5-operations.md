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

- Build: `1.0.0-dev.20260729003507`
- Jest version: `019fab4c-0be5-7172-871a-3d8bebed2d49`
- Upload result: accepted and processing with Draft activation requested

## Developer Console setup

Owner access to `https://jest.com/developers` is required:

1. Select Manual loading mode.
2. Create the six SKUs listed in `firebase-functions/.env.example`.
3. Upload the showcase assets and select:
   - logo: `assets/images/icon.png`
   - hero: `docs/jest-assets/riddle-quest-hero.png`
4. If a dedicated notification image is approved, set its reference as `VITE_JEST_NOTIFICATION_ASSET_REFERENCE`. Without one, Jest uses the configured Hero image.
5. Create at least two sandbox players.
6. Activate the audited Draft build and run the acceptance matrix below.

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
