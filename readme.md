# Riddle Quest

Riddle Quest is a mobile-first React HTML5 word game built for the Jest gaming platform. Players can solve classic and daily riddles, earn and spend coins, build streaks, compete in Race to 10 multiplayer challenges, register through Jest, receive return notifications, share referrals, and buy coin packs. Premium subscriptions remain sandbox-only until the Jest beta lifecycle is approved and verified.

This repository contains only the web game and its Firebase backend. Do not add React Native, Expo, Android, iOS, native in-app purchases, external authentication, ads, or app-install prompts.

## Architecture

| Path | Responsibility |
| --- | --- |
| `packages/portal` | Vite, React, game UI, Jest SDK adapter, Firebase browser client, browser tests, and standalone Jest build tooling |
| `packages/core` | Browser-safe game rules, validation schemas, bridge types, Race to 10 contracts, and pricing metadata |
| `firebase-functions` | Authoritative gameplay, player profiles, riddle generation, Jest identity exchange, payment grants, subscriptions, referrals, leaderboards, and multiplayer |
| `src/locales` | All user-facing translations: 17 locales across 22 namespaces |
| `assets` | Source images, audio, fonts, and 3D assets |
| `docs` | Operations, architecture decisions, review evidence, assets, and runbooks |

The browser treats the Jest SDK as the platform boundary. `getPlayer()` supplies the stable guest or registered player ID, Jest player data preserves low-integrity client progress, and signed identity/payment/referral payloads are verified by Firebase before any valuable grant is made. Purchases and referral rewards are server-authoritative and idempotent.

Race to 10 is fully server-authoritative. The browser sends player intent only; Firebase selects decks and hints, validates guesses, advances runs, calculates clocks and penalties, resolves outcomes, and grants achievements. Direct browser access to race collections is denied by Firestore rules, and client responses contain answer-safe run projections rather than canonical answers.

Production and sandbox procedures live in `docs/jest-html5-operations.md`.

## Requirements

- Node.js `>=24.17.0` for the workspace and frontend tooling
- Node.js 22 for the deployed Firebase Functions runtime
- pnpm `11.21.0` through Corepack
- Java 21 for the Firebase emulators
- `zip` and `unzip` for Jest build packaging
- Linux with functional `/usr/bin/bwrap` (bubblewrap and user namespaces) for timestamped Jest releases
- Firebase and Jest Developer Console access for production operations
- Application Default Credentials for scripts that read or write live Firestore

The root `.nvmrc` pins the Node.js 24 workspace toolchain. Run `nvm use` from `firebase-functions/`
when working directly on the separately pinned Node.js 22 runtime.

Enable the pinned package manager and install dependencies from the repository root:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

Do not use npm or Yarn to update this workspace. Commit `pnpm-lock.yaml` whenever dependencies change.

## Local development

Start the normal Vite development server:

```bash
pnpm dev
```

Open `http://localhost:5173/riddle-quest/`. Standalone development uses JestSDK's interactive local mock and a mocked authoritative backend. Use the JestSDK debug menu to change player registration, entry payloads, and SDK outcomes.

Deterministic harness routes are intended for development and automated tests:

| Query | Purpose |
| --- | --- |
| `?harness=jest` | Fixed Jest platform and backend mock |
| `?harness=jest-auth` | Jest authentication integration harness |
| `?harness=race` | Race to 10 with deterministic services |
| `?harness=race-auth` | Race and Jest authentication harness |

Do not add a harness query to hosted-emulator, sandbox, preview, or production URLs.

### Test through the live Jest shell

Start the development server on Jest's expected port:

```bash
pnpm jest:hosted
```

While signed into Jest, open:

```text
https://jest.com/g/riddle-q?host=http://localhost:3000
```

This uses the real Jest SDK inside the Jest shell. The production Firebase backend deliberately rejects the localhost iframe origin, so this workflow is limited to SDK, overlay, entry-payload, and responsive-shell checks. Never add localhost to the deployed `JEST_GAME_ORIGIN`; use the deterministic local harness for application branches and an uploaded Draft with sandbox users for live backend, payment, notification, persistence, and referral verification.

## Configuration

Configuration is split by trust level. Values prefixed with `VITE_` are compiled into the browser and are public. Upload tokens, Jest shared secrets, and OpenAI keys are private and must never enter a Vite environment file or the built artifact.

### Browser and Jest build values

The dedicated Jest build loads `config/vite/portal/.env.jest`. Use
`config/vite/portal/.env.jest.local` for ignored machine-specific public overrides. Vite's `envDir` points outside the
portal source root, so legacy `packages/portal/.env*` files are never loaded and the production security audit rejects
them.

| Variable | Required | Meaning |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Public Firebase web API key |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase web application ID |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID` | No | Reserved public GA4 web stream ID. The committed Jest environment deliberately omits it, and runtime collection remains disabled until a future owner-approved consent/opt-out design supplies an affirmative decision |
| `VITE_FIREBASE_FUNCTIONS_REGION` | No | Functions region; defaults to `us-central1` |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | Yes | Public reCAPTCHA Enterprise site key used by Firebase App Check; the production security audit rejects an empty value |
| `VITE_JEST_FUNCTIONS_BASE_URL` | Production | Base URL for the authoritative Jest HTTP endpoints |
| `VITE_JEST_NOTIFICATION_ASSET_REFERENCE` | No | Approved Jest notification asset reference; the Hero image is the fallback |
| `VITE_RACE_TO_10_ENABLED` | No | Set to `1` to expose multiplayer in the normal game; rollout rules still apply server-side |

After changing browser values, rebuild the game. Vite values are compile-time settings and do not change an already uploaded artifact.

Recurring subscriptions are intentionally fail-closed in every uploaded production build. Local development and focused unit tests
retain the subscription UI, while the direct live sandbox script exercises the configured SDK SKU. Do not expose the offer
to production players until Jest approves beta production use and the full activation, restoration, cancellation, and entitlement
benefit lifecycle passes.

Google Analytics is disabled in uploaded Jest builds: the dedicated environment has no measurement ID, startup does not import the Firebase Analytics adapter, the event sink defaults closed, pre-consent events are discarded, and the production CSP does not authorize GA or Tag Manager endpoints. Do not add a measurement ID or initialize collection until an owner-approved consent/opt-out design has been implemented and tested for every supported audience. If that work is later authorized, do not add player names, riddle answers, guesses, email addresses, Jest player IDs, or purchase tokens to event parameters.

Sentry remains optional essential error reporting. Browser reporting excludes product/session-context integrations, console capture, performance traces, default PII, and free-form messages. Firebase Functions also use zero performance-trace sampling. Provider retention, access, and production envelope review remain deployment-owner responsibilities.

Never place `JEST_SHARED_SECRET`, `OPENAI_API_KEY`, a service-account key, or `JEST_GAME_UPLOAD_TOKEN` in a `VITE_` variable.

### Encryption and transport security

Production browser-to-backend traffic must use HTTPS. The Jest backend client rejects plaintext production endpoint URLs, Firebase Hosting sends a one-year HSTS policy, and the Content Security Policy upgrades insecure requests and blocks mixed content. Plain HTTP is permitted only for explicitly enabled loopback development endpoints.

Firebase Authentication identifies players, App Check protects production browser-facing callables, and Firebase-managed Firestore, Storage, Functions, logging, and secrets are encrypted at rest by Google Cloud. Run the committed configuration audit after changing hosting headers or endpoint policy:

```bash
pnpm check:security
```

The game does not claim zero-knowledge end-to-end encryption where Firebase cannot decrypt gameplay. That model is incompatible with an authoritative server validating guesses and granting rewards. See `SECURITY.md` for the complete trust model and private vulnerability-reporting guidance.

### Firebase Functions values

Use `firebase-functions/.env.example` as the field reference. Non-secret deployed values belong in `firebase-functions/.env.<project-id>` (or an ignored local override for emulator work).

| Variable | Required | Meaning |
| --- | --- | --- |
| `JEST_GAME_ID` | Yes | Jest game UUID used for signed-token audience validation and the build-origin CORS entry |
| `JEST_GAME_ORIGIN` | Yes | Exact comma-separated HTTPS Jest origins accepted by the production backend. Localhost is prohibited; the backend derives the game's trusted `*.builds.jest.com` origin from the validated game ID. |
| `JEST_PRODUCT_SKUS` | Yes for coin sales | Comma-separated defense-in-depth allowlist of enabled one-off product SKUs |
| `JEST_SUBSCRIPTION_SKUS` | Yes for premium | Comma-separated enabled subscription SKUs |
| `OPENAI_MODEL` | No | Riddle generation/review model; defaults to the value in `openaiService.ts` |
| `SENTRY_DSN` | No | Enables server-side Sentry reporting when present; non-HTTPS DSNs are rejected at startup |

The production project currently targets `riddle-quest-ec2b2`, as selected in `.firebaserc`. Always pass `--project` for scripts that can mutate Firestore so the target is visible in shell history.

### Secrets

Store production secrets in Google Cloud Secret Manager through Firebase:

```bash
pnpm dlx firebase-tools@15.25.1 functions:secrets:set JEST_SHARED_SECRET --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set OPENAI_API_KEY --project riddle-quest-ec2b2
```

- `JEST_SHARED_SECRET` is the base64 value from the Jest Developer Console. It verifies signed identity, purchase, subscription, and referral payloads.
- `OPENAI_API_KEY` is bound only to Functions that generate or independently review riddles.
- After rotating a secret, redeploy every Function that binds it.
- For emulators, prefer `firebase-functions/.secret.local`; never commit it.

### Jest upload values

Install the committed template outside the repository as an owner-only file. Keeping it outside Vite's environment directory and normal build inputs reduces credential exposure:

```bash
install -D -m 600 packages/portal/jest-release.credentials.example \
  "${XDG_CONFIG_HOME:-$HOME/.config}/riddle-quest/jest-release.env"
```

To use another location, set `JEST_RELEASE_CREDENTIALS_FILE` to an absolute path outside the repository. The release command rejects links, non-owner files, and group/world permissions.

Set:

| Variable | Required | Meaning |
| --- | --- | --- |
| `JEST_GAME_UPLOAD_TOKEN` | Yes | Private upload token from the Jest Developer Console |
| `JEST_NOTIFICATION_EMAIL` | Yes | Address notified when build processing completes |
| `JEST_GAME_ID` | No | Optional identity binding; when set it must exactly match Riddle Quest's committed game UUID |
| `JEST_BUILD_VERSION` | Direct preflight/upload only | Build version bound to the gated archive; defaults to `1.0.0` |

The release command requires a clean committed worktree, binds the build to that full Git commit, generates a unique
`1.0.0-dev.YYYYMMDDHHMMSS.<commit>.<attempt>` version, and uploads an inactive Draft by default. It does not make a
private game public or submit it for moderation. Never persist `JEST_UPLOAD_IS_ACTIVE` or
`JEST_CONFIRM_ACTIVATION` in the credential file; the parser rejects both. A deliberate new activation-request upload
must supply both values in that invocation's process environment as shown in the operations runbook.

## Jest Developer Console setup

Repository values and Developer Console values must agree.

1. Select Manual loading mode. The game reports meaningful progress and calls `markGameLoaded()` when input is available.
2. Configure the game ID and copy its shared secret into Firebase Secret Manager.
3. Create each enabled consumable with the exact SKU used by the backend catalog. Keep the beta subscription SKU configured only for the direct sandbox gate; normal uploaded builds hide it from the player-facing catalog.
4. Upload and approve the logo, Hero image, and any notification asset. Notification imagery should use the current Jest-recommended ratio.
5. Create at least two sandbox users for purchases and referral conversion testing.
6. Keep direct-to-game registration and onboarding payloads compatible with `customName`, campaign, reference, challenge, and UTM entry fields.
7. Use the Simulator to record the self-review for the exact version submitted to moderation.

### Maintaining products and subscriptions

Monetization configuration has three locks, and all three must be changed together:

1. Create or update the SKU in the Jest Developer Console.
2. Add its trusted grant or entitlement in `firebase-functions/src/jest/jestProductCatalog.ts`.
3. Add it to `JEST_PRODUCT_SKUS` or `JEST_SUBSCRIPTION_SKUS` in the deployed Functions environment.

Coin-pack values are granted only from the server catalog. Never accept a coin amount from the client. A purchase is granted transactionally using a SHA-256 digest of the signed `purchaseToken` as the idempotency receipt key before the client calls `completePurchase()`; the raw token is never a Firestore document path.

Monthly and yearly premium SKUs grant the same entitlement. If either is active, the UI must hide the equivalent offer so a player cannot subscribe twice. Verify the catalog, successful checkout, cancellation, interruption, incomplete-purchase recovery, and entitlement refresh with a Jest sandbox user before release.

## Firestore-managed configuration and content

Scripts that can write live data default to preview mode. Applying a change requires both `--apply` and an exact `--confirm-project` value, and creates a timestamped backup before writing.

Authenticate with Application Default Credentials first:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project riddle-quest-ec2b2
```

### Notification copy

Notification bodies and CTAs originate in every locale's `game.json`; Race notification copy comes from `race.json`. The configuration script validates length, placeholders, and delivery-safe characters, then builds `config/notifications` in Firestore.

Preview:

```bash
pnpm --dir firebase-functions notifications:configure --project riddle-quest-ec2b2
```

Apply after reviewing the locale diff and preview:

```bash
pnpm --dir firebase-functions notifications:configure \
  --project riddle-quest-ec2b2 \
  --apply \
  --confirm-project riddle-quest-ec2b2
```

Registered players receive a rolling fuzzy D1-D7 schedule. Existing reminders are removed and replaced when progress changes or the player returns. Copy is personalized from real progress, rotated to avoid repeated D1 messages, and attributed through `notification_template` and `notification_offset` entry fields.

### Race to 10 content

Build and inspect the current eligible pool:

```bash
GCLOUD_PROJECT=riddle-quest-ec2b2 pnpm --dir firebase-functions race:content:dry-run
pnpm --dir firebase-functions race:content:validate-live --project riddle-quest-ec2b2
```

Preview a reviewed content import:

```bash
pnpm --dir firebase-functions race:content:import \
  --input path/to/reviewed-content.json \
  --project riddle-quest-ec2b2
```

Apply only after the preview is correct:

```bash
pnpm --dir firebase-functions race:content:import \
  --input path/to/reviewed-content.json \
  --project riddle-quest-ec2b2 \
  --apply \
  --confirm-project riddle-quest-ec2b2
```

If the preview reports eligible records that must be retired, review them and add `--replace-existing`. Imports refuse deterministic path collisions.

### Multiplayer rollout

Preview the current or proposed rollout:

```bash
pnpm --dir firebase-functions race:rollout:configure \
  --project riddle-quest-ec2b2 \
  --enabled true \
  --percentage 10
```

Apply with the same confirmation pattern:

```bash
pnpm --dir firebase-functions race:rollout:configure \
  --project riddle-quest-ec2b2 \
  --enabled true \
  --percentage 10 \
  --apply \
  --confirm-project riddle-quest-ec2b2
```

Use repeated `--allow-player-id` and `--remove-player-id` arguments for controlled testing. Player IDs are hashed before being stored in `raceConfig/rollout`.

## Locales and visible copy

English is the key source, but every visible string must exist in all supported locales:

`ar`, `de`, `en`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `tr`, `vi`, `zh`.

When adding or removing copy:

1. Update the same namespace file under all 17 locale directories.
2. Preserve interpolation placeholders such as `{name}`, `{coins}`, and `{level}` exactly.
3. Search for removed keys to ensure they are no longer referenced.
4. Run the locale audit.
5. If notification fields changed, publish the reviewed Firestore notification configuration separately.

```bash
pnpm --filter @qwordly/portal check:locales
```

## Testing

Run the standard unit suites:

```bash
pnpm test
pnpm test:functions
```

Run whole-source coverage for Core, Portal, and Functions:

```bash
pnpm test:coverage
```

Coverage is collected across each package's source tree instead of a handpicked module list. Declaration files are excluded, and Portal excludes the Playwright test files themselves. Do not improve reported coverage by excluding untested production modules. Core currently enforces 100% statements, branches, functions, and lines. Portal and Functions use honest global ratchets that must be raised as real tests are added; browser-only behavior is additionally verified by the Playwright suites.

For the authoritative multiplayer slice, run the focused cross-package coverage suites:

```bash
pnpm test:race:coverage
```

Useful focused checks:

```bash
pnpm test:core
pnpm test:web
pnpm --filter @qwordly/portal test:jest-local:playwright
pnpm --filter @qwordly/portal test:mobile-soak
pnpm --dir firebase-functions test:race:rules
```

The mobile soak defaults to ten minutes. Override it only for diagnosis with `PORTAL_SOAK_DURATION_MS`; the release check should use the full duration.

Run the fail-closed release gate before every upload. It includes production dependency, type, lint, coverage, security-rules emulator, build, W3C, browser, and exact archive checks. Use the extended gate before launches and major gameplay releases to append the full mobile soak:

```bash
pnpm verify:production
pnpm verify:production:extended
```

The gate prepares the ignored `@qwordly/core` deploy package before any Functions check, then runs the Functions type, lint, and unit suites through pinned Node.js 22.23.1 in addition to the Node.js 24 workspace checks. GitHub Actions mirrors these checks on clean runners without production secrets; deployed Jest sandbox purchases, subscriptions, activation, and moderation remain explicit owner-run checks.

### Uploaded sandbox build

Generate a short-lived login URL under Developer Console → Sandbox Users, then run:

```bash
JEST_SANDBOX_LOGIN_URL='https://jest.com/...' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

Optional deployed-test values are `JEST_DEPLOYED_GAME_URL`, `JEST_SANDBOX_STORAGE_STATE`, and `JEST_GAME_ID`. The default storage-state file lives under `/tmp`; do not commit authenticated browser state.

Use two sandbox players for referral tests. Reset the invitee before rerunning attribution because Jest attributes the first entry. Local mocks cannot prove real notification delivery, catalog configuration, payment settlement, persistence, or referral conversion.

## Build and release

Build the complete workspace:

```bash
pnpm build
```

Build only the standalone Jest artifact:

```bash
pnpm build:web
```

The uploadable game is written to `packages/portal/dist-jest`. The build checks TypeScript, the implementation tracker, every locale, chunked production output, and the artifact audit. The audit enforces an internal 4.5 MB release budget beneath Jest's 5 MB HTML5 limit, relative local assets, the approved Jest SDK script, and the absence of native modules, external authentication, ads, install prompts, secrets, source maps, and missing entry assets.

After all tests and sandbox checks pass, upload a timestamped build:

```bash
pnpm jest:build-upload
```

The command takes an exclusive release lock and runs the full extended production gate before reading credential-file
contents. It first probes a Linux bubblewrap boundary and refuses to run any child if that boundary is unavailable; there
is no unsandboxed fallback. Gate, build, validator, browser, and uploader children see a read-only host filesystem, a
masked operator home, isolated `HOME`/temporary/PID/proc state, and only the required read-only runtime/browser caches.
Before credentials are read, the gate may write only to the repository and isolated release workspace; `.git`, the
external credential file, ignored `.env*` files, receipt state, and other known secret-bearing paths are overmounted.
The command then materializes the committed Git snapshot in an isolated `/tmp` workspace and switches the repository,
snapshot, and copied trusted release scripts to read-only mounts. It builds the Sentry-tagged artifact there, creates a
version-specific ZIP and receipt, extracts that ZIP into a fresh read-only directory, and runs both browser suites against
the extracted bytes. The parent fingerprints the archive and gate receipt before and after those checks. The Sentry token
is intentionally available to the Vite source-map process and its loaded build dependencies. The game upload token is
framed through an anonymous pipe to the read-only trusted uploader, consumed and closed before it starts any child, and
then sent as an in-process HTTP header rather than an environment variable or command-line argument. The unchanged,
digest-bound archive is uploaded only if the worktree still points to the same clean commit.

This child sandbox protects the configured credential file from release children; it is not an OS-wide secret vault. It
cannot protect against another same-user or privileged host process, a compromised parent release process or runtime,
backups, hard links, or alternate secret copies. Run releases on a dedicated trusted host, keep dependencies reviewed and
locked, and do not place other credentials in readable paths outside the masked home.

Jest responds to a successful submission with HTTP `202`: the build is accepted for background processing, not ready or active. Before transmission, the command writes an owner-private attempt receipt under `packages/portal/.jest-upload-receipts/`. A timeout, interruption, or crash leaves that version blocked as transmitting/ambiguous until an owner reconciles it in the Developer Console or completion email; blindly retrying could duplicate an accepted build. After a documented `202`, the receipt records the version ID and exact archive checksum. The documented API has no authoritative build-status polling endpoint, so the release tool does not invent one. Publication and moderation submission remain manual owner actions.

Deploy backend changes separately:

```bash
pnpm --dir firebase-functions build
pnpm --dir firebase-functions test
pnpm --dir firebase-functions run deploy --project riddle-quest-ec2b2
```

The authoritative single-player protocol is not rolling-compatible with the currently active legacy build: the hardened
backend no longer returns answers for client-side scoring, while the new client depends on the new session endpoints and
status fields. Do not deploy either side while the other is serving normal play, and do not describe this release as
zero-downtime. Use the player-blocking maintenance and staged-activation procedure in
[`docs/jest-html5-operations.md`](docs/jest-html5-operations.md#coordinated-gameplay-protocol-cutover). A failed cutover
stays in maintenance and rolls forward; it must never restore an answer-bearing backend contract.

When Firestore rules or indexes change, deploy those explicitly and test the rules emulator first.

```bash
pnpm --dir firebase-functions test:race:rules
pnpm dlx firebase-tools@15.25.1 deploy \
  --only firestore:rules,firestore:indexes,storage \
  --project riddle-quest-ec2b2
```

## Maintenance workflow

Before merging a change:

1. Keep React components, Jest adapters, Firebase boundaries, and game rules in their existing small modules; avoid rebuilding monolithic files.
2. Validate all client input and all Jest entry payload values.
3. Preserve guest progress by continuing to use the stable Jest `playerId` when registration completes.
4. Keep purchase grants, subscription entitlements, and referral rewards signed, server-authoritative, and idempotent.
5. Update all locales for visible copy and republish Firestore notification copy when applicable.
6. Test cancellation, retryable failure, terminal failure, reload recovery, guest state, and registered state for SDK changes.
7. Verify UI changes in a mobile browser and run the standalone Jest build.
8. Retain release evidence with the relevant operational runbook or acceptance test.
9. Keep exported contracts, public methods, and security-sensitive variables documented with accurate TSDoc; update this README when commands, architecture, configuration, coverage gates, or deployment steps change.
10. Review `git diff` and `git status` to ensure no `.env`, secret, credential, generated archive, or browser state is included.

When updating dependencies:

```bash
corepack pnpm outdated -r
corepack pnpm update -r --latest
pnpm test
pnpm test:functions
pnpm build
```

Review release notes for Vite, React, Firebase, Jest, Three.js, TypeScript, and Node before accepting breaking upgrades. The workspace runs Node 24 tooling while Firebase deploys Functions on Node 22, so verify both environments.

## Operational references

- `docs/jest-html5-operations.md` — hosted emulator, sandbox, Simulator, upload, and acceptance matrix
- `firebase-functions/.env.example` — backend environment field reference
- `packages/portal/jest-release.credentials.example` — external owner-only release-credential template
- [Jest HTML5 SDK documentation](https://docs.jest.com/sdk/html5)
- [Jest sandbox testing](https://docs.jest.com/testing/sandbox)
- [Firebase Functions environment and secrets](https://firebase.google.com/docs/functions/config-env)

If this README and executable configuration disagree, treat `package.json`, environment templates, validation scripts, and server-authoritative catalogs as the source of truth, then update this README in the same change.
