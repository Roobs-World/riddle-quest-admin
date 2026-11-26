# Riddle Quest

Riddle Quest is a word game with isolated React HTML5 targets for Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix, Yahoo and GameSnacks, plus a bare React Native Android app. Shared gameplay remains server-authoritative where a trusted backend contract exists; self-contained targets use their permitted local save authority. Provider identity, storage, commerce, social, notification, and lifecycle capabilities appear only where their platform contracts support them.

All development, releases, Jest uploads and monitoring repairs use `main`. Confirm the current branch is `main` and push completed work to `origin/main`. Platform-specific source lives below `platforms/native/<provider>` or `platforms/web/<provider>`. Ads are permitted only in the Facebook artifact. See [platform ownership and build contracts](../architecture/platform-layout.md) before adding or moving code.

## Architecture

| Path | Responsibility |
| --- | --- |
| `platforms/web/<provider>` | Target HTML, composition, SDK adapters, provider-only server integration, assets, tests and release scripts |
| `platforms/web/reddit` | Reddit browser adapter, trusted Devvit `/api/*` gateway, package validation and release receipts; Firebase authority lives separately in `server` |
| `platforms/native/android` | Bare React Native app, native views and device bridges; Android-only Firebase authority lives in `server` |
| `src/gameplay`, `src/races` | Shared rules, controllers, components, persistence, and runtime adapters for play and multiplayer |
| `src/accounts`, `src/commerce`, `src/progression` | Account, shop, economy, achievement, and reward features |
| `src/content`, `src/localization` | Bundled content, content transport, locale helpers, and shared copy |
| `src/app`, `src/platform` | Application composition, shared capability contracts, iframe bridge, and Firebase adapters |
| `src/scenery`, `src/onboarding`, `src/settings` | Rendering, guidance, preferences, and their components |
| `src/observability`, `src/presence`, `src/sharing`, `src/leaderboards`, `src/notifications` | Shared reporting, presence, social, and notification support |
| `firebase-functions` | Shared authoritative gameplay and infrastructure, deployed export composition, and archive-local compiled server output |
| `tooling/sentry-worker` | Background Sentry repair worker with signed deployment checks and bounded Jest/Facebook repair paths |
| `src/locales` | All user-facing translations: 16 locales across target-specific namespaces |
| `assets` | Source images, audio, fonts, and 3D assets |
| `docs` | Operations, architecture decisions, review evidence, assets, and runbooks |

The browser treats the Jest SDK as the platform boundary. `getPlayer()` supplies the stable guest or registered player ID, Jest player data preserves low-integrity client progress, and signed identity/payment/referral payloads are verified by Firebase before any valuable grant is made. Purchases and referral rewards are server-authoritative and idempotent.

Race to 10 is fully server-authoritative. The browser sends player intent only; Firebase selects decks and hints, validates guesses, advances runs, calculates clocks and penalties, resolves outcomes, and grants achievements. Direct browser access to race collections is denied by Firestore rules, and client responses contain answer-safe run projections rather than canonical answers.

Production procedures live in `docs/jest/jest-html5-operations.md`, `docs/facebook/facebook-instant-games-operations.md`, `docs/reddit/reddit-games-operations.md`, and `docs/youtube/youtube-playables-operations.md`.

The Reddit webview may call only its own `/api/*` routes. The request-scoped Devvit server authenticates Reddit context and signs narrowly scoped calls to one approved Firebase Functions host. Firebase remains the global authority; Devvit Redis is limited to installation/post cache state. Reddit ads, push notifications, and commerce remain hidden until an official API and the required approvals are proven.

The YouTube artifact contains its own versioned riddle catalog and uses only the Playables SDK for lifecycle, language, audio, and cloud save. Its local balance and progress never join the global account, and Firebase, analytics, identity, purchases, ads, sharing, and multiplayer are excluded from that artifact.

## Requirements

- Node.js `>=24.17.0` for the workspace and frontend tooling
- Node.js 22 for the deployed Firebase Functions runtime
- pnpm `11.21.0` through Corepack
- Java 21 for HTML validation
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

## Hosted development workflow

The root package scripts build platform artifacts, run static checks and prepare releases or uploads. Local development servers, previews, fixture builds and test launchers are not exposed.

Use the provider's uploaded private version for gameplay acceptance. For Jest, use an inactive uploaded build and approved sandbox accounts; for Facebook, use the Meta Testing assignment and app-role accounts. Follow the target's operations guide before uploading. Keep localhost out of deployed origin allowlists.

## Configuration

Configuration is split by trust level. Values prefixed with `VITE_` are compiled into the browser and are public. Upload tokens, Jest shared secrets, and OpenAI keys are private and must never enter a Vite environment file or the built artifact.

### Browser and Jest build values

The dedicated Jest build loads `platforms/web/jest/.env.jest`. Use
`platforms/web/jest/.env.jest.local` for ignored machine-specific public overrides. Vite's `envDir` points outside the
shared browser source root, so legacy `packages/web-game/.env*` files are never loaded and the production security audit rejects
them.

| Variable | Required | Meaning |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Public Firebase web API key |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase web application ID |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_DATABASE_URL` | For presence | Realtime Database URL used by opt-in rival presence |
| `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID` | No | Public GA4 web stream ID for the selected Jest or Facebook target. Collection requires an affirmative player opt-in in Settings |
| `VITE_FIREBASE_FUNCTIONS_REGION` | No | Functions region; defaults to `us-central1` |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | Yes | Public reCAPTCHA Enterprise site key used by Firebase App Check; the production security audit rejects an empty value |
| `VITE_JEST_FUNCTIONS_BASE_URL` | Production | Base URL for the authoritative Jest HTTP endpoints |
| `VITE_RACE_TO_10_ENABLED` | No | Set to `1` to expose multiplayer in the normal game; rollout rules still apply server-side |

After changing browser values, rebuild the game. Vite values are compile-time settings and do not change an already uploaded artifact.

Recurring subscriptions are intentionally fail-closed in every uploaded production build. Local development and focused unit tests
retain the subscription UI, while the direct live sandbox script exercises the configured SDK SKU. Do not expose the offer
to production players until the full activation, restoration, cancellation, and entitlement-benefit lifecycle passes against
Jest's live sandbox checkout.

Jest and Facebook builds configure their existing Google Analytics streams through an off-by-default consent control in Settings. The Google tag loads only after opt-in in an authenticated production session. Withdrawal cancels initialization, disconnects collection and clears GA cookies. Pre-consent actions are discarded. Never add names, answers, guesses, email addresses, account IDs or purchase tokens to event parameters. See [Google Analytics and action events](../observability/google-analytics.md) for the event catalogue, native Android transport and restricted-platform boundaries.

Sentry remains optional essential error reporting. Browser reporting excludes product/session-context integrations, console capture, performance traces, default PII, and free-form messages. Firebase Functions also use zero performance-trace sampling. Provider retention, access, and production envelope review remain deployment-owner responsibilities.

Never place `JEST_SHARED_SECRET`, `OPENAI_API_KEY`, a service-account key, or `JEST_GAME_UPLOAD_TOKEN` in a `VITE_` variable.

### Encryption and transport security

Production game traffic uses HTTPS in both directions. Browser API clients validate page and endpoint schemes and reject redirects. Firebase region configuration cannot select custom endpoint URLs. Android release builds forbid cleartext and emulator configuration; debug builds permit local emulator hosts. Firebase Hosting and the notification manager send one-year HSTS policies and block mixed content. Plain HTTP is limited to explicit local development and Google's private runtime metadata token service.

Firebase Authentication identifies players, App Check protects production browser-facing callables, and Firebase-managed Firestore, Storage, Functions, logging, and secrets are encrypted at rest by Google Cloud. Run the committed configuration audit after changing hosting headers or endpoint policy:

```bash
pnpm check:security
```

The game does not claim zero-knowledge end-to-end encryption where Firebase cannot decrypt gameplay. That model is incompatible with an authoritative server validating guesses and granting rewards. See `docs/common/security/SECURITY.md` for the complete trust model and private vulnerability-reporting guidance.

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
install -D -m 600 platforms/web/jest/jest-release.credentials.example \
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
`1.0.0-dev.YYYYMMDDHHMMSS.<commit>.<attempt>` version, and uploads it with automatic activation bound to the exact gated
archive. Jest makes the version active only after background processing succeeds. This does not make a private game
public or submit it for moderation. Never persist `JEST_UPLOAD_IS_ACTIVE` or
`JEST_CONFIRM_ACTIVATION` in the credential file; the parser rejects both, and the canonical release interface rejects
either value in its process environment because activation policy is fixed in reviewed release code.

## Jest Developer Console setup

Repository values and Developer Console values must agree.

1. Select Manual loading mode. The game reports meaningful progress and calls `markGameLoaded()` when input is available.
2. Configure the game ID and copy its shared secret into Firebase Secret Manager.
3. Create each enabled consumable with the exact SKU used by the backend catalog. Keep the subscription SKU configured for the direct sandbox gate; normal uploaded builds hide it from the player-facing catalog until the live lifecycle gate passes.
4. Upload and approve the logo, Hero image, and any notification asset. Notification imagery should use the current Jest-recommended ratio.
5. Create at least two sandbox users for purchases and referral conversion testing.
6. Keep direct-to-game registration and onboarding payloads compatible with `customName`, campaign, reference, challenge, and UTM entry fields.
7. Use the Simulator to record the self-review for the exact version submitted to moderation.

### Maintaining products and subscriptions

Monetization configuration has three locks, and all three must be changed together:

1. Create or update the SKU in the Jest Developer Console.
2. Add its trusted grant or entitlement in `platforms/web/jest/server/jestProductCatalog.ts`.
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

### Notification content

Author notification titles, bodies and images in the [notification manager](../notifications/service.md). The game no longer builds notification copy from locale files or reads `config/notifications` from Firestore. See [platform delivery](../notifications/platform-delivery.md) for the required Jest, Meta and native transport integration paths.

### Race to 10 content

Classic and Daily generation, including new offline English additions, use `gpt-6.1-sol`.
The shared online generator also blind-solves and independently reviews each candidate with that model;
`OPENAI_MODEL` cannot override it. Questions must be unambiguous, keyboard-compatible, factual,
and distinct from prior content. Daily and Classic pass their own mode and question history to the generator.

Author a new multiplayer bank with `OPENAI_API_KEY` supplied securely in the environment:

```bash
pnpm --dir firebase-functions race:content:author \
  --source content/race-en-reviewed-v2.json \
  --output content/race-en-sol61-v1.json
```

This creates 180 reviewed English questions: 20 easy and 10 medium per category, with no hard questions.
Easy means recognition from everyday knowledge; medium means one straightforward inference.
The independent editor checks difficulty and category before acceptance. A card gets at most three attempts;
the command fails without writing a bank if generation or final import validation fails. Approved progress is
saved beside the output as `.checkpoint.json`; rerun the same command to resume it. The checkpoint is bound to
the source and model. Existing output files are never overwritten. Authoring does not change Firestore or existing daily challenges.

Multiplayer translation is also pinned to `gpt-6.1-sol`; supply a distinct `--critic-model` and the new
`--source` to `race:translations:generate`. Use a fresh output directory for a new source/model contract.
Translate and validate the bank for each enabled locale before importing it. Historical content and
offline translation/critic provenance remain intact; rebuilding does not regenerate released content.

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

`ar`, `de`, `en`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `tr`, `vi`.

When adding or removing copy:

1. Update the same namespace file under all 16 locale directories.
2. Preserve interpolation placeholders such as `{name}`, `{coins}`, and `{level}` exactly.
3. Search for removed keys to ensure they are no longer referenced.
4. Run the locale audit.
5. If notification fields changed, publish the reviewed Firestore notification configuration separately.

```bash
pnpm check:locales
```

## Build checks and hosted acceptance

Run the production preparation checks before an upload:

```bash
pnpm verify:production
```

This runs dependency and security audits, type and lint checks, production builds, HTML validation and exact-artifact preparation. It does not start local games, emulators, unit suites or browser harnesses. Functions compatibility checks use the pinned Node.js 22 runtime alongside the Node.js 24 workspace toolchain.

These checks establish build and configuration results, not playable behavior. Complete manual acceptance against the exact uploaded version in the provider's private environment before publication. Record the version, artifact hash, backend revision, device and observed outcome. Keep login links, credentials and identifiable captures private.

GitHub Actions remains manual-only behind its runner-usage confirmation gate. Uploads, activation, review submission and publication retain their separate authorization requirements.

## Build and release

The canonical per-platform interface is documented in [`docs/common/releases/release-operations.md`](../releases/release-operations.md). Inspect every target without running its build or external adapter:

```bash
pnpm release:plan
```

Build one isolated shipping target:

```bash
pnpm build:jest
pnpm build:facebook
pnpm build:youtube
pnpm build:reddit
```

Every target command starts from its own HTML document and composition root, writes only its own `dist-*` directory, runs the source import firewall, and then runs an independent byte-level artifact audit. There is no generic Vite target fallback. Run the source boundary by itself with `pnpm check:target-boundaries`.

Build the established backend and non-YouTube production path:

```bash
pnpm build
```

Build the established Jest, Facebook, and Reddit web targets plus the Reddit App package:

```bash
pnpm build:web
```

This preserves the existing deployment path and writes isolated artifacts to `platforms/web/jest/build/dist`, `platforms/web/facebook/build/dist`, and `platforms/web/reddit/build/dist`. It does not build or package YouTube. Each target keeps its own SDK, resource, and forbidden-code audit; the Jest audit additionally enforces an internal 4.5 MB release budget beneath Jest's 5 MB HTML5 limit.

Build and audit all configured client targets:

```bash
pnpm verify:all-targets
```

This uses the production content and artifact checks for each target; it does not run local tests or fixture builds.

Prepare the immutable Facebook handoff for manual upload from a clean reviewed commit:

```bash
pnpm release:facebook
```

The command rebuilds and audits Facebook, creates the source/hash-bound ZIP receipt, then snapshots those exact bytes to an owner-private, read-only, hash-named archive and opens that hash's retry barrier. It does not contact Meta. Upload only the printed archive path as a non-production Draft. Before beginning, inspect all retained barriers and never start another hash while an older attempt is transmitting or ambiguous; follow [`docs/facebook/facebook-instant-games-operations.md`](../../facebook/facebook-instant-games-operations.md) for the current preflight, acceptance, ambiguity, and promotion constraints.

Build and package a YouTube release candidate through the separate fail-closed path after all 16 audited content bundles exist:

```bash
pnpm build:youtube
pnpm release:youtube
```

The release build writes `platforms/web/youtube/build/dist`; a successful preflight writes `platforms/web/youtube/build/build-youtube.zip`, `platforms/web/youtube/build/build-youtube.manifest.json`, and `platforms/web/youtube/build/build-youtube.test-report.json` at the repository root. The legacy report filename now contains build and audit results, not test results. Hosted acceptance remains separate. See [`docs/youtube/youtube-playables-operations.md`](../../youtube/youtube-playables-operations.md) for content authoring, exact-hash evidence, and the manual Portal workflow.

After reviewing the build checks and authorizing the upload, create a timestamped Jest build:

```bash
pnpm release:jest
```

The command takes an exclusive release lock and runs the production build and audit gate before reading credential-file
contents. It first probes a Linux bubblewrap boundary and refuses to run any child if that boundary is unavailable; there
is no unsandboxed fallback. Gate, build, validator and uploader children see a read-only host filesystem, a
masked operator home, isolated `HOME`/temporary/PID/proc state, and only the required read-only runtime caches.
Before credentials are read, the gate may write only to the repository and isolated release workspace; `.git`, the
external credential file, ignored `.env*` files, receipt state, and other known secret-bearing paths are overmounted.
The command then materializes the committed Git snapshot in an isolated `/tmp` workspace and switches the repository,
snapshot, and copied trusted release scripts to read-only mounts. It builds the Sentry-tagged artifact there, creates a
version-specific ZIP and receipt, extracts that ZIP into a fresh read-only directory, and audits the extracted bytes
and HTML. The parent fingerprints the archive and gate receipt before and after those checks. The Sentry token
is intentionally available to the Vite source-map process and its loaded build dependencies. The game upload token is
framed through an anonymous pipe to the read-only trusted uploader, consumed and closed before it starts any child, and
then sent as an in-process HTTP header rather than an environment variable or command-line argument. The unchanged,
digest-bound archive is uploaded only if the worktree still points to the same clean commit.

This child sandbox protects the configured credential file from release children; it is not an OS-wide secret vault. It
cannot protect against another same-user or privileged host process, a compromised parent release process or runtime,
backups, hard links, or alternate secret copies. Run releases on a dedicated trusted host, keep dependencies reviewed and
locked, and do not place other credentials in readable paths outside the masked home.

Jest responds to a successful submission with HTTP `202`: the build and automatic-activation request are accepted for
background processing, not ready or active yet. Before transmission, the command writes an owner-private attempt receipt
under `platforms/web/jest/build/.jest-upload-receipts/`. A timeout, interruption, or crash leaves that version blocked as
transmitting/ambiguous until an owner reconciles it in the Developer Console or completion email; blindly retrying could
duplicate an accepted build. After a documented `202`, the receipt records the version ID, exact archive checksum, and
activation intent. The documented API has no authoritative build-status polling endpoint, so the release tool does not
invent one. Jest activates the exact version after processing succeeds; publication and moderation submission remain
manual owner actions.

Prepare the Reddit release handoff separately after its hosted prerequisites are complete:

```bash
pnpm release:reddit
```

This command creates a commit/hash-bound immutable candidate and does not call Devvit. Package-level `release:upload` and `release:publish` shortcuts fail closed because the installed Devvit commands rebuild or create a new version. Remote ingestion remains blocked until it can be proven to preserve the candidate bytes; follow [`docs/reddit/reddit-games-operations.md`](../../reddit/reddit-games-operations.md).

Deploy backend changes separately:

```bash
pnpm --dir firebase-functions build
pnpm --dir firebase-functions run deploy --project riddle-quest-ec2b2
```

The historical answer-bearing single-player cutover is complete. A client-only comparison against the previously selected
`ef53cce7` build was not sufficient: production still ran the `67384b8` Functions cohort, which predated the
server-authoritative session response required by the client. On 2026-08-23, `getCurrentClassicRiddle`,
`getCurrentDailyChallenge`, `submitSinglePlayerGuess`, `completeGame`, `getHint`, `spendCoins`, and `skipRiddle` were
deployed together and verified `ACTIVE` on one Firebase source hash. Before future automatic activation, verify the live
Function cohort as well as client compatibility. Releases that change those contracts must stop before
`pnpm release:jest` and follow the guarded inactive workflow requirement in
[`docs/jest/jest-html5-operations.md`](../../jest/jest-html5-operations.md#automatic-activation-compatibility).

When Firestore rules or indexes change, review the access rules and deploy them explicitly. Verify the resulting behavior through the authorized hosted acceptance procedure.

```bash
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
6. Build and audit the affected isolated artifacts.
7. Use the exact uploaded private version for manual acceptance, including recovery, saving and supported provider features.
8. Retain release evidence with the relevant operational runbook.
9. Keep exported contracts, public methods and security-sensitive variables documented with accurate TSDoc; update this README when commands, architecture, configuration or deployment steps change.
10. Review `git diff` and `git status` to ensure no `.env`, secret, credential, generated archive or browser state is included.

When updating dependencies:

```bash
corepack pnpm outdated -r
corepack pnpm update -r --latest
pnpm check:types
pnpm verify:production
```

Review release notes for Vite, React, Firebase, Jest, Three.js, TypeScript, and Node before accepting breaking upgrades. The workspace runs Node 24 tooling while Firebase deploys Functions on Node 22, so verify both environments.

## Operational references

- `docs/jest/jest-html5-operations.md` — hosted emulator, sandbox, Simulator, upload, and acceptance matrix
- `firebase-functions/.env.example` — backend environment field reference
- `platforms/web/jest/jest-release.credentials.example` — external owner-only release-credential template
- [Jest HTML5 SDK documentation](https://docs.jest.com/sdk/html5)
- [Jest sandbox testing](https://docs.jest.com/testing/sandbox)
- [Firebase Functions environment and secrets](https://firebase.google.com/docs/functions/config-env)

If this README and executable configuration disagree, treat `package.json`, environment templates, validation scripts, and server-authoritative catalogs as the source of truth, then update this README in the same change.
