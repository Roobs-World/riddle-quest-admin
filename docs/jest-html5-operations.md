# Jest HTML5 production operations

Riddle Quest is a standard React HTML5 game. It has no React Native, Expo, Android, iOS, admin-panel, external-auth, ad, or native-purchase release path.

## Testing modes

### 1. Local Jest SDK mock

Start the normal development server:

```bash
pnpm dev
```

Open `http://localhost:5173/riddle-quest/`. The game uses Jest's SDK adapter and the SDK's built-in local mock host, while keeping authoritative Firebase operations mocked. Use the **JestSDK** debug menu to switch guest/registered state, set entry payloads, and simulate SDK success, cancellation, and error responses.

For repeatable automated regression tests, use the project's deterministic harness and Playwright suite:

```bash
pnpm --filter @qwordly/portal test:jest-local:playwright
```

The deterministic `?harness=jest` route is test-only; it deliberately uses the repository's fixed mock adapter instead of the JestSDK debug menu.

### 2. Jest hosted emulator

Start Vite on the port expected by the hosted emulator:

```bash
pnpm jest:hosted
```

While logged in to Jest, open:

```text
https://jest.com/g/riddle-q?host=http://localhost:3000
```

The embedded-development check selects the real `JestSDK` adapter and real Firebase backend, not the deterministic local harness. The deployed Functions CORS configuration must include `http://localhost:3000` in `JEST_GAME_ORIGIN` while hosted-emulator testing is enabled. Do not add `harness=` to this URL.

Validate player identity, registration dismissal/completion, player-data persistence, entry payloads, catalog reads, cancellation, and retryable SDK errors here. Payment settlement, notification delivery, and referral attribution still require sandbox users.

### 3. Uploaded build with sandbox users

Create a sandbox user in **Developer Console → Sandbox Users**, upload and activate a build, generate a login URL, then run:

```bash
JEST_SANDBOX_LOGIN_URL='https://jest.com/...' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

Use two sandbox users for referral attribution. Reset the invitee's player state between referral runs because attribution happens on first entry. Sandbox checkout uses the real platform UI at a zero charge; also inspect scheduled notifications and persisted player state in the Developer Console.

### 4. Developer Console Simulator

Open the uploaded version—or provide the `pnpm jest:hosted` local URL—in the Simulator. Complete its quality checklist and record a self-review that covers onboarding, guest play, registration, one complete riddle, the shop, a canceled checkout, a successful sandbox checkout, subscription state, notifications, sharing, portrait/landscape layout, audio, and background/foreground recovery. Attach the recording to the exact version being submitted for moderation.

After upload, use the version's preview link with the developer account for a final smoke test before activation. A preview is not a substitute for sandbox payment, notification, persistence, or referral validation.

## Local release verification

Run the complete fail-closed release gate:

```bash
pnpm verify:production
```

This checks production dependency advisories, all TypeScript projects, backend lint, full coverage thresholds, Firestore and Storage rules in their emulators, security and scalability policies, package-feature adoption, TSDoc and file-size limits, the standalone Jest build, W3C validity, both local browser suites, and the exact ZIP packaging preflight. Any failed stage stops the release.

Before a production launch or major gameplay release, run the extended gate. It includes the complete gate above followed by the full ten-minute low-end mobile stability and memory soak:

```bash
pnpm verify:production:extended
```

The individual commands remain useful while diagnosing a failed gate:

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

The authenticated browser state is cached only in `/tmp/riddle-quest-jest-sandbox-state.json` so a consumed one-time link can be reused while diagnosing a failed run. Set `JEST_SANDBOX_STORAGE_STATE` to override that ephemeral path. The deployed gate also requires a successful signed `verifyJestReferrals` response and validates its conversion, two-sided reward, reward amount, and balance fields; a sandbox smoke test cannot pass if referral reconciliation is unavailable.

`build:jest` validates TypeScript, every imported locale JSON file, the production build, and the standalone artifact. The artifact audit enforces the 5 MB limit, local relative assets, the single approved Jest SDK script, and the absence of native modules, external authentication, ads, install prompts, secrets, and source maps.

## Jest testing modes

### Local SDK mock

Run `pnpm dev` and open `http://localhost:5173/riddle-quest/`. Standalone development uses JestSDK's built-in mock host; use the **JestSDK** debug menu to switch guest/registered state, inspect calls and entry payloads, and simulate success, cancellation, and error responses. Add `?harness=jest` only when you need the repository's deterministic browser-test adapter instead.

Run both deterministic browser suites with:

```bash
pnpm --filter @qwordly/portal test:jest-local:playwright
```

### Hosted emulator

Start the local server on the port expected by Jest:

```bash
pnpm jest:hosted
```

While logged into the developer account, open `https://jest.com/g/riddle-q?host=http://localhost:3000`. The game detects that it is embedded and uses the live Jest SDK and configured backend rather than either local mock adapter. Exercise registration dismissal/completion, stable player identity, entry payloads, platform overlays, and mobile iframe sizing here.

### Uploaded build and sandbox users

Upload an audited draft, generate a login link under **Developer Console → Sandbox Users**, then run `test:jest-deployed:playwright` using the command above. Manually exercise notifications, purchase success/cancel/error/recovery, subscriptions, persistence, and two-player referrals. Sandbox checkout shows the real checkout UI but charges zero.

### Simulator and version preview

Before review, select the uploaded version in the Developer Console Simulator, complete its quality checklist, and record a self-review covering onboarding, guest play, registration, the first solved riddle, shop entry, and multiplayer entry. Use the version preview link with the developer account for a final check of that exact uploaded build before activation.

These environments are complementary: local mocks prove application branches, the hosted emulator proves the live SDK boundary, sandbox users prove platform-backed state, and the Simulator produces moderator evidence.

## Current projects

- Firebase project: `riddle-quest-ec2b2`
- Firebase web app: `1:329028367192:web:b85776d379ea3356b7eb2d`
- Jest team: `019faa67-d2a6-7169-aa29-a4411a3a3c3d`
- Jest game: `019faa68-f3ec-755d-9ab5-c887fb426801`
- Jest outer origin: `https://jest.com`
- Jest build origin: `https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com`
- Functions base URL: `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net`

The committed `packages/portal/.env.jest` contains public Firebase client configuration. `JEST_SHARED_SECRET` remains in Firebase Secret Manager. The only deployed Functions are the authoritative Jest identity, purchase, referral, profile, leaderboard, riddle, and gameplay boundaries; the obsolete legacy-migration Functions have been deleted.

### Google Cloud runtime health

The production project uses Application Default Credentials with `riddle-quest-ec2b2` as both the active and quota
project. Compute Engine, Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Eventarc, Pub/Sub, Scheduler,
Firestore, Secret Manager, IAM Credentials, Logging, and Monitoring APIs are enabled.

Firebase callable Functions are public at the Cloud Run ingress layer so browser requests can reach Firebase callable
authentication. This does not make gameplay data public: authenticated callables still reject missing or invalid Firebase
identity, Jest platform endpoints verify signed Jest payloads, and Firestore competitive collections remain server-only.
After creating a new HTTP/callable Function, verify that its Cloud Run service has `allUsers` bound to
`roles/run.invoker`; a missing binding appears as a Google HTML 403 rather than a structured Firebase error.

## Build and upload

Copy `packages/portal/.env.jest-upload.example` to the ignored `packages/portal/.env.jest-upload.local`, then set the game upload token and notification email. The release tooling also accepts the legacy ignored `packages/portal/.env` file:

```bash
pnpm jest:build-upload
```

The command creates a timestamped version, builds and audits `dist-jest`, revalidates the exact files immediately before packaging, creates the ignored `packages/portal/build.zip`, records its SHA-256 checksum, and uploads it as an inactive Draft version. It does not publish the game, activate the build, or submit it for review.

To exercise the complete packaging preflight without transmitting anything:

```bash
pnpm --filter @qwordly/portal preflight:jest-upload
```

After verifying the exact Draft version through its preview URL and sandbox acceptance checks, activation can be requested deliberately by setting both values below. The game-ID confirmation prevents a stale shell environment from activating the wrong game:

```bash
JEST_UPLOAD_IS_ACTIVE=true \
JEST_CONFIRM_ACTIVATION=019faa68-f3ec-755d-9ab5-c887fb426801 \
pnpm jest:build-upload
```

The latest current-game upload was:

- Build: `1.0.0-dev.20260731231001`
- Jest version: `019fba71-2c3b-72fd-937d-8cdc67b845cb`
- Upload result: accepted for asynchronous processing with automatic activation requested
- Publication status: the unauthenticated route still returns Jest's private-app 403; owner review and Public visibility
  remain required in the Developer Console

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
7. Configure and publish the `friend-challenge` and `race-to-10` onboarding slugs used by referral shares.
8. Activate the audited Draft build and run the acceptance matrix below.

## Sandbox acceptance matrix

- Identity: guest and registered startup; dismissal and cancellation; stable player ID; invalid and stale token rejection.
- Loading: every manual phase advances; no 15-second timeout; retry works; overlay closes only when input is enabled.
- Analytics: the first authoritative win marks the first milestone once; registration and attribution events contain no personal data.
- Notifications: D1/D3/D7 replacement and removal; registered-only behavior; Daily Cosmic Riddle payload return.
- Payments: success, cancellation, internal error, invalid SKU/token, timeout, interruption before completion, and multi-page recovery.
- Referrals: canceled victory, profile, and Race-to-10 shares; result links remain in the normal game; race links open the exact challenge; first-entry attribution; both players receive 100 coins; duplicate, cross-campaign duplicate, self, tampered, and unrelated-reference rejection.
- Layout/input: keyboard, pointer, and touch in portrait and landscape; background/foreground; audio unlock; offline restart.
- Stability: lower-end iOS Safari and Android Chrome cold/warm launch plus a 10-minute foreground/background soak.

Retain screenshots, recordings, event IDs, and device traces with the relevant release or incident evidence. Do not commit authenticated browser state, private player data, or secrets.

## Jest Games Fund readiness

- **User acquisition:** guests see the custom registration step immediately after the instructions and again after an authoritative win when the cooldown permits. Jest onboarding `customName`, campaign, source, and reference values are preserved through the native registration overlay.
- **Notifications:** registered players receive fuzzy D1, D3, and D7 schedules early in the session. Stable identifiers replace the existing schedule whenever level, wins, streak, name, or locale changes. Each localized message has distinct reward-focused copy and carries template, offset, campaign, and callback attribution back into the Daily Cosmic Riddle.
- **Virality:** victory, profile, and Race-to-10 surfaces create outside-network Jest referral shares with localized benefit-led copy and branded spoiler-free images. Result invites enter normal play, race invites open the exact race, and contextual registration names the inviter. Both supported referral references grant 100 coins to each player from signed conversion data, with one idempotency key per inviter/invitee pair across campaigns. A visible reward fanfare closes the loop when the inviter returns.
- **Monetization:** consumables and the monthly subscription use the Jest payment APIs. Signed receipts and subscription state are verified server-side; SKU grants are idempotent; canceled or failed transactions do not mutate balances; and incomplete purchases are recovered page-by-page before normal play.

Automated coverage proves the integration contract and failure handling. Before a Fund submission, repeat the Notifications, Payments, and Referrals rows above with real Jest sandbox players and retain the Developer Console evidence; local mocks cannot prove catalog configuration, delivery by the messaging network, or live payment settlement.

## User acquisition configuration

1. Keep the Explore logo, hero image, and short description aligned with the first-play experience.
2. Use the direct game URL for paid and creator campaigns. Jest-preserved `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content` values are allowlisted and attached to the `session_started` analytics event.
3. Use structured `entryPayload` values for referrals, onboardings, and notifications. Riddle Quest validates these values before routing and carries `customName`, campaign, and reference into registration.
4. Compare `session_started`, `registration_prompt_shown`, `registration_prompt_dismissed`, and `registration_completed` in Jest analytics by campaign. Events contain attribution labels and booleans only, never player names or other personal data.
5. Preserve both registration moments: the early post-instructions choice and the post-win prompt after the core-value milestone. The dismissal cooldown prevents repeated interruptions.

## Viral funnel scorecard

Review by `campaign` and `surface` at least weekly:

1. Share intent rate: `viral_share_intent` / authoritative wins or profile visits.
2. Share-dialog non-cancel rate: successful `viral_share_dialog_result` / `viral_share_intent`. This is a dialog outcome, not proof that a message was delivered.
3. Invite open rate: `viral_invite_opened` / non-canceled share dialogs, interpreted directionally because the platform does not expose delivery.
4. Attributed registration rate: `viral_invite_registered` / `viral_invite_opened`.
5. Signed conversion and reward rate: rewarded registrations from `viral_referrals_reconciled` / invite opens.
6. Viral coefficient proxy: distinct signed registrations / players who opened a share dialog, split between `friend_challenge_v2`, `open_invite_v1`, and `race_to_10_v1`.

Do not rename stable Jest share references after launch. Campaign and surface labels may evolve for experiments, but the backend allowlist and per-pair reward key must remain migration-compatible. Validate any reward-copy or amount experiment against the server-owned `JEST_REFERRAL_REWARD_COINS` constant before release.
