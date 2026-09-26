# Jest HTML5 production operations

Riddle Quest is a standard React HTML5 game. It has no React Native, Expo, Android, iOS, admin-panel, external-auth, ad, or native-purchase release path.

For the source-audited map of player data, system boundaries, deletion, export, retention, and unresolved owner/counsel decisions, see the [privacy data inventory](privacy-data-inventory.md).

## Testing modes

### 1. Local Jest SDK mock

Start the normal development server:

```bash
pnpm --filter @qwordly/portal dev:jest
```

Open `http://localhost:5173/targets/jest/`. The game uses Jest's SDK adapter and the SDK's built-in local mock host, while keeping authoritative Firebase operations mocked. Use the **JestSDK** debug menu to switch guest/registered state, set entry payloads, and simulate SDK success, cancellation, and error responses.

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

The embedded-development check selects the real `JestSDK` adapter, not the deterministic local harness. The production deploy validator deliberately rejects localhost origins, so never add `http://localhost:3000` to the deployed `JEST_GAME_ORIGIN` allowlist. Backend-authoritative checks in this mode require a local Functions emulator selected through the ignored `config/vite/portal/.env.jest.local`; otherwise use an uploaded sandbox build for real backend flows. Do not add `harness=` to this URL.

Validate Jest SDK loading, player identity payloads, registration dismissal/completion, entry payloads, cancellation, and retryable SDK errors here. Validate player-data persistence and catalog reads through a local Functions emulator or uploaded sandbox build. Payment settlement, notification delivery, and referral attribution require sandbox users.

### 3. Uploaded build with sandbox users

Create a sandbox user in **Developer Console → Sandbox Users**, deploy the automatically activating build, generate a
login URL, then run with the exact build version from its accepted receipt:

```bash
JEST_SANDBOX_LOGIN_URL='https://jest.com/...' \
JEST_EXPECTED_BUILD_VERSION='1.0.0-dev.YYYYMMDDHHMMSS.commit.attempt' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

If Firebase App Check rejects the automated Chromium session, rerun the deployed gate in a visible browser. This preserves production attestation instead of weakening App Check or introducing a production debug token:

```bash
JEST_DEPLOYED_HEADED=1 \
JEST_SANDBOX_LOGIN_URL='https://jest.com/...' \
JEST_EXPECTED_BUILD_VERSION='1.0.0-dev.YYYYMMDDHHMMSS.commit.attempt' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

Use two sandbox users for referral attribution. Reset the invitee's player state between referral runs because attribution happens on first entry. Sandbox checkout uses the real platform UI at a zero charge; also inspect scheduled notifications and persisted player state in the Developer Console.

### 4. Developer Console Simulator

Use the `pnpm jest:hosted` local URL in the Simulator for SDK embedding and lifecycle checks only. Open the uploaded version for the complete quality checklist and record a self-review that covers onboarding, guest play, registration, one complete riddle, the shop, a canceled checkout, a successful sandbox checkout, subscription state, notifications, sharing, portrait/landscape layout, audio, and background/foreground recovery. Attach the recording to the exact version being submitted for moderation.

After automatic activation, open that exact version in the Simulator and run the sandbox acceptance gate immediately. A
Simulator run is not a substitute for sandbox payment, notification, persistence, or referral validation.

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
JEST_EXPECTED_BUILD_VERSION='1.0.0-dev.YYYYMMDDHHMMSS.commit.attempt' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
```

Generate the short-lived login URL from **Developer Console → Sandbox Users**. The test opens the deployed Riddle Quest
route after sandbox authentication; `JEST_DEPLOYED_GAME_URL` can override the default `https://jest.com/g/riddle-q` route.
It requires `JEST_EXPECTED_BUILD_VERSION` from the accepted upload receipt and rejects an older active iframe before feature
assertions. It also rejects direct storage-origin access, local servers, and `harness=` mock mode; the exact build must run
at the configured `*.builds.jest.com` origin and produce real identity and riddle Function traffic.

The authenticated browser state is cached only in `/tmp/riddle-quest-jest-sandbox-state.json` so a consumed one-time link can be reused while diagnosing a failed run. The writer pre-creates and revalidates it as a regular current-user `0600` file; the payment and subscription gates fail closed on permissive, linked, or foreign-owned state. Set `JEST_SANDBOX_STORAGE_STATE` to override that ephemeral path, keep the custom file owner-only, and remove it after the acceptance evidence is complete. The deployed gate also requires a successful signed `verifyJestReferrals` response and validates its conversion, two-sided reward, reward amount, and balance fields; a sandbox smoke test cannot pass if referral reconciliation is unavailable.

Headless browsers can be rejected by reCAPTCHA Enterprise even when the hosted build is healthy. Create a dedicated token under **Firebase Console → App Check → Apps → Riddle Quest web app → Manage debug tokens**, keep it out of files and shell history, and inject it only into the test process:

```bash
read -rsp 'App Check debug token: ' RQ_APP_CHECK_DEBUG_TOKEN; echo
FIREBASE_APPCHECK_DEBUG_TOKEN="$RQ_APP_CHECK_DEBUG_TOKEN" \
JEST_EXPECTED_BUILD_VERSION='1.0.0-dev.YYYYMMDDHHMMSS.commit.attempt' \
pnpm --filter @qwordly/portal test:jest-deployed:playwright
unset RQ_APP_CHECK_DEBUG_TOKEN
```

The Playwright context installs this value before any page or iframe JavaScript executes. Production visitors continue using reCAPTCHA Enterprise; the token is never bundled. Revoke the debug token immediately in Firebase if it is disclosed.

Run the destructive-but-zero-dollar payment smoke test separately. It refuses to click checkout unless the hosted dialog explicitly identifies the account as a sandbox user and the confirmation value exactly matches the requested SKU:

```bash
JEST_SANDBOX_PAYMENT_CONFIRM=com.roobsworld.riddlequest.coinpack1 \
pnpm --filter @qwordly/portal test:jest-payments:live
```

This checks the live Jest/Stripe product and subscription catalogs, completes a sandbox checkout, verifies the signed receipt through `grantJestPurchase`, replays the receipt to prove the grant is idempotent, calls `completePurchase`, and confirms the token has left the recovery queue. The backend hashes the signed purchase token before using it as a Firestore receipt ID, and a replay returns the user's current balance rather than the historical post-grant balance. Account deletion removes receipt identity fields but retains the opaque hash as a minimal anti-replay tombstone; older raw-token receipts are migrated when read or deleted. Jest owns the Stripe customer, wallet, checkout, and charge lifecycle; no Stripe secret or direct Stripe client belongs in the game artifact.

Run the separate subscription activation, restoration, and cancellation gate with an exact SKU confirmation:

```bash
JEST_SANDBOX_SUBSCRIPTION_CONFIRM=com.roobsworld.riddlequest.premium.monthly \
pnpm --filter @qwordly/portal test:jest-subscription:live
```

This is a direct SDK sandbox gate. The gate requires Jest's **Sandbox User** checkout marker before it clicks Subscribe, verifies
the signed active entitlement through `syncJestSubscriptions`, reloads the active game to prove restoration, and confirms platform
cancellation. The uploaded Simulator build exposes the configured subscription to registered players so the launch checklist can
exercise `getSubscriptions()` and `beginSubscription()`. The adapter's 30-second retryable timeout contains an unsettled provider
call and reports a retryable failure without inventing an entitlement.

The current CDN SDK exposes `getSubscriptions`, `beginSubscription`, `cancelSubscription`, and `claimRetentionOffer` in localhost
mock mode. Its bundled debug menu does not currently expose the documented subscription outcome controls, however, and direct mock
start/cancel calls return `cancel`. Keep the deterministic repository mocks for success and error coverage, and use the live sandbox
gate for provider behavior rather than treating the localhost mock as proof of checkout configuration.

`build:jest` validates TypeScript, every imported locale JSON file, the production build, and the standalone artifact. The artifact audit enforces a 4.5 MB internal release budget beneath the 5 MB platform limit, local relative assets, the single approved Jest SDK script, and the absence of native modules, external authentication, ads, install prompts, secrets, and source maps.

## Jest testing modes

### Local SDK mock

Run `pnpm --filter @qwordly/portal dev:jest` and open `http://localhost:5173/targets/jest/`. Standalone development uses JestSDK's built-in mock host; use the **JestSDK** debug menu to switch guest/registered state, inspect calls and entry payloads, and simulate success, cancellation, and error responses. Add `?harness=jest` only when you need the repository's deterministic browser-test adapter instead.

Run both deterministic browser suites with:

```bash
pnpm --filter @qwordly/portal test:jest-local:playwright
```

### Hosted emulator

Start the local server on the port expected by Jest:

```bash
pnpm jest:hosted
```

While logged into the developer account, open `https://jest.com/g/riddle-q?host=http://localhost:3000`. The game detects that it is embedded and uses the live Jest SDK with the local authoritative-backend mock. This lets the Developer Console exercise interrupted-purchase recovery through grant and `completePurchase()` without sending its synthetic signed payloads to production. Exercise registration dismissal/completion, stable player identity, entry payloads, platform overlays, and mobile iframe sizing here; use an uploaded sandbox build for production-backend-authoritative behavior.

### Uploaded build and sandbox users

Deploy the audited automatically activating build, generate a login link under **Developer Console → Sandbox Users**, then
run `test:jest-deployed:playwright` with its exact receipt build version using the command above. Manually exercise
notifications, purchase success/cancel/error/recovery, subscriptions, persistence, and two-player referrals. Sandbox
checkout shows the real checkout UI but charges zero.

### Simulator and version preview

Before review, select the exact active version in the Developer Console Simulator, complete its quality checklist, and
record a self-review covering onboarding, guest play, registration, the first solved riddle, shop entry, and multiplayer
entry. The canonical production command activates after processing, so perform this check and the sandbox gate immediately
after the Console or completion email confirms the version.

These environments are complementary: local mocks prove application branches, the hosted emulator proves the live SDK boundary, sandbox users prove platform-backed state, and the Simulator produces moderator evidence.

## Current projects

- Firebase project: `riddle-quest-ec2b2`
- Firebase web app: `1:329028367192:web:b85776d379ea3356b7eb2d`
- Jest team: `019faa67-d2a6-7169-aa29-a4411a3a3c3d`
- Jest game: `019faa68-f3ec-755d-9ab5-c887fb426801`
- Jest outer origin: `https://jest.com`
- Jest build origin: `https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com`
- Functions base URL: `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net`

The committed `config/vite/portal/.env.jest` contains public Firebase client configuration. Vite loads only that dedicated repository-level directory; any legacy `packages/portal/.env*` file blocks the production audit and timestamped release. `JEST_SHARED_SECRET` remains in Firebase Secret Manager. The only deployed Functions are the authoritative Jest identity, purchase, referral, profile, leaderboard, riddle, and gameplay boundaries; the obsolete legacy-migration Functions have been deleted.

### Google Cloud runtime health

The production project uses Application Default Credentials with `riddle-quest-ec2b2` as both the active and quota
project. Compute Engine, Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Eventarc, Pub/Sub, Scheduler,
Firestore, Secret Manager, IAM Credentials, Logging, and Monitoring APIs are enabled.

Firebase callable Functions are public at the Cloud Run ingress layer so browser requests can reach Firebase callable
authentication. This does not make gameplay data public: authenticated callables still reject missing or invalid Firebase
identity, Jest platform endpoints verify signed Jest payloads, and Firestore competitive collections remain server-only.
After creating a new HTTP/callable Function, verify that its Cloud Run service has `allUsers` bound to
`roles/run.invoker`; a missing binding appears as a Google HTML 403 rather than a structured Firebase error.

### Username reservation rollout

Username changes fail closed until the versioned `usernameReservationMigrations/v1` document is complete. Deploy the
Functions that create deterministic reservations first, wait for traffic to move off the previous revision, and then
process existing users in bounded pages. Preview never writes; apply requires the exact project ID twice:

```bash
pnpm --dir firebase-functions usernames:migrate -- --project riddle-quest-ec2b2 --page-size 100
pnpm --dir firebase-functions usernames:migrate -- --project riddle-quest-ec2b2 --page-size 100 --apply --confirm-project riddle-quest-ec2b2
```

Repeat preview then apply until an apply invocation reports `complete: true`; the final empty page is what opens the
username-change gate. Each successful user advances a persisted cursor, so rerunning after interruption is idempotent.
If preview or apply reports an invalid username or case/NFKC collision, stop. The owner whose reservation was already
committed deterministically keeps the name; correct only the reported, not-yet-migrated legacy
`users/{uid}.username` value to a valid unclaimed display name. Leave the migration gate closed and rerun the same page;
the migration transaction will claim the corrected name and synchronize its leaderboard copy. Never move the cursor or
set `complete` manually.

## Build and upload

Install the credential template outside the repository with owner-only permissions, then set the game upload token and notification email. The release rejects repository-local, linked, group-readable, or world-readable credential files:

```bash
install -D -m 600 packages/portal/jest-release.credentials.example \
  "${XDG_CONFIG_HOME:-$HOME/.config}/riddle-quest/jest-release.env"
pnpm release:jest
```

Keep `JEST_UPLOAD_IS_ACTIVE` and `JEST_CONFIRM_ACTIVATION` out of that persistent file; the credential parser rejects
both so a stale file cannot change release behavior. The canonical `release:jest` interface also rejects either variable
in its process environment. Automatic activation is a fixed, reviewed property of the canonical release code.

For GitHub Actions CD, create a protected `jest-production` environment, require the desired reviewers, restrict it to
the `jest` branch, and add `JEST_GAME_UPLOAD_TOKEN` plus `JEST_NOTIFICATION_EMAIL` as environment secrets. Dispatch
`Deploy Jest production` from the `jest` branch. The workflow uses the same canonical release command and a
non-cancellable production concurrency lock; it does not provide a shorter CI-only upload path. Facebook, Reddit, and
YouTube retain their separately documented manual handoff boundaries.

The command refuses a dirty worktree, acquires an exclusive release lock, adds the source commit and a random attempt ID
to its timestamped version, and runs `verify:production:extended` before reading credential-file contents. Timestamped
releases require Linux and functional `/usr/bin/bwrap`; the command probes the boundary first and refuses an unsandboxed
fallback. Every gate, build, validator, browser, and uploader child receives a minimal environment and runs with the
operator home hidden, isolated home/temp/PID/proc state, a read-only host filesystem, and required runtime/browser caches
rebound read-only. During the credential-free gate, only the repository and isolated release workspace are writable;
`.git`, ignored `.env*` files, receipt state, other known secret-bearing paths, and the exact configured credential path
are overmounted. Before reading credentials, the repository, committed snapshot, and copied trusted release scripts are
switched to read-only mounts. Network remains shared because dependency/W3C audits, emulator setup, and browser tests
require it. The command fingerprints the pnpm/npm lock and workspace manifests
plus the installed root/core/portal/Functions dependency trees when it acquires the lock, then
requires the same fingerprint immediately before upload. It materializes the committed Git snapshot in a unique
`/tmp` workspace, builds there with the Sentry token scoped to the direct Vite process, packages a version-specific
archive, extracts it into a fresh read-only directory, and reruns the artifact, W3C, and both browser gates against those
extracted bytes. Parent-held pre/post fingerprints and the trusted uploader independently bind the Git commit and clean
state, ZIP size, SHA-256, version, game, receipt, and activation intent before the unchanged ZIP is uploaded with
`isActive=true`. Jest activates that exact version only after background processing succeeds. This does not make a private
game public or submit it for review.

The sandbox prevents release children from opening the configured credential path or inspecting the parent through the
host PID namespace. It does not isolate the release from other same-user or privileged host processes, a compromised
parent release process/runtime, backups, hard links, or alternate copies. The Vite process and its loaded dependencies
intentionally receive the Sentry token when source-map upload is enabled; the uploader process intentionally receives the
Jest token, and both retain network access. Use a dedicated trusted release host and reviewed locked dependencies.

For readable browser stack traces, create a dedicated Sentry organization token
with the minimum release/project permissions required for artifact upload and set
the following values only in the external owner-only credential file:

```bash
SENTRY_UPLOAD_SOURCEMAPS=1
SENTRY_AUTH_TOKEN=your-dedicated-build-token
SENTRY_ORG=roobs-world-limited
SENTRY_PROJECT=riddle-quest
```

The timestamped release command supplies the same immutable release identifier to
the browser SDK and Sentry build plugin. It generates hidden source maps, uploads
them privately, finalizes the production release, and deletes every `.map` file
before the artifact audit and Jest packaging steps. A requested upload with any
missing Sentry value fails the build; ordinary builds never generate source maps.

To exercise the complete packaging preflight without transmitting anything:

```bash
pnpm --filter @qwordly/portal preflight:jest-upload
```

The direct preflight overwrites `build.zip` and its default gate receipt together; the timestamped release instead uses
version-specific workspace paths. There is deliberately no direct live-upload package command. Only the sandboxed
timestamped release may transmit: it binds the source commit and clean state, ZIP bytes, build version, game ID, and
activation intent to the receipt, then frames the token through an anonymous pipe. The uploader consumes and closes that
pipe before starting any child and sends the token only as an in-process HTTPS header, never in an exec-time environment
or command-line argument.

Before sending bytes, the uploader stores atomic mode-`0600` barriers for both the exact game/build version and the
game/source commit. The documented upload API returns HTTP `202` with a `versionId` and `buildStatus: "processing"`; that
means the upload and automatic-activation request were accepted for background processing, not that the build is already
ready or active. A timeout, termination, or crash leaves the source barrier
blocked as transmitting/ambiguous, so generating a new timestamped build version from the same source cannot bypass the
uncertain attempt. Reconcile it through the [Developer Console build status and build-completion email](https://docs.jest.com/dev-console/builds).
After a documented `202`, both receipts transition to accepted-pending and record the version ID and exact ZIP checksum;
the source-wide barrier deliberately remains. Only after the Console or completion email reports an authoritative final
status may an owner manually remove the corresponding `<game-id>.<source-commit>.unresolved-upload.json` file from
`packages/portal/.jest-upload-receipts`; retain the accepted build-specific receipt as the audit record, or reconcile it
before ever retrying that exact version. Do not delete either barrier and retry blindly: Jest may already have accepted
the first request. Jest does not currently document an authoritative build-status polling endpoint, so the tooling
deliberately does not infer readiness from elapsed time or poll an unofficial URL. Use the Developer Console or completion
email to confirm that the receipt's exact version became active, then run the deployed sandbox smoke.

### Automatic activation compatibility

The canonical command is a production promotion, not a preview workflow. Run it only when the client is rolling-compatible
with the deployed backend and rules. Do not infer backend compatibility from the previously active client alone. Before
automatic activation, verify that `getCurrentClassicRiddle`, `getCurrentDailyChallenge`, `submitSinglePlayerGuess`,
`completeGame`, `getHint`, `spendCoins`, and `skipRiddle` are all `ACTIVE` and belong to one reviewed Firebase deployment
cohort. If a future release introduces an incompatible client/server protocol, migration, or maintenance-window
requirement, stop before running `pnpm release:jest` and add a separately reviewed inactive-Draft workflow. Do not attempt
to override the canonical policy with ambient or persistent activation variables.

Automatic build activation is separate from publication. The upload token cannot approve the game, complete Simulator or
moderation requirements, or change a private listing to Public; those remain owner actions in the Developer Console.

## Developer Console setup

Owner access to `https://jest.com/developers` is required:

1. Treat [the desired Developer Console manifest](jest-developer-console.json) as the source of truth for the game ID,
   public listing, loading mode, exact asset bytes, catalog SKUs, and any separately published onboarding games. Validate all known values and assets:

   ```bash
   pnpm --filter @qwordly/portal check:jest-console
   ```

2. The owner-approved publisher is `Jest`, and the approved Console privacy-policy URL is
   `https://roobsworld.com/privacy`. Keep both values exact; the privacy URL is Console metadata and must not be added to
   the in-game About page because Jest requires external links to be removed. The stricter check binds both decisions:

   ```bash
   pnpm --filter @qwordly/portal check:jest-console:release
   ```

3. Copy the manifest's exact listing values into the Console, select its logo and hero from the Asset Library, select Manual
   loading mode, and confirm the game is Approved and Public. The validator is read-only and never changes Console state.
4. Create the six consumable SKUs and monthly subscription SKU in the manifest. Registered players must read their signed
   subscription entitlement before the shop renders, and an active subscription must never be offered again.
5. Keep the approved notification image reference aligned with `VITE_JEST_NOTIFICATION_ASSET_REFERENCE`.
6. Create at least two sandbox players. The manifest currently lists no separate onboarding games; referral links enter Riddle Quest directly.
7. Verify that the automatically activated build matches the receipt's exact version ID and build version, then run the
   acceptance matrix below.

## Sandbox acceptance matrix

- Identity: guest and registered startup; dismissal and cancellation; stable player ID; invalid and stale token rejection.
- Loading: every manual phase advances; no 15-second timeout; retry works; overlay closes only when input is enabled.
- Analytics: every authoritative win calls `markFirstMilestone()`; Jest deduplicates the signal per session; registration and attribution events contain no personal data.
- Notifications: D1-D7 engagement and Race-to-10 reminder replacement/removal; registered-only behavior; Daily Cosmic Riddle and race-inbox payload return.
- Payments: success, cancellation, internal error, invalid SKU/token, timeout, interruption before completion, and multi-page recovery.
- Subscriptions: signed entitlement sync, inactive offer, successful or cancelled checkout, active offer suppression, restoration, and cancellation.
- Referrals: canceled victory, profile, and Race-to-10 shares; result links remain in the normal game; race links open the exact challenge; first-entry attribution; both players receive 100 coins; duplicate, cross-campaign duplicate, self, tampered, and unrelated-reference rejection.
- Layout/input: keyboard, pointer, and touch in portrait and landscape; background/foreground; audio unlock; offline restart.
- Stability: lower-end iOS Safari and Android Chrome cold/warm launch plus a 10-minute foreground/background soak.

Retain screenshots, recordings, event IDs, and device traces with the relevant release or incident evidence. Do not commit authenticated browser state, private player data, or secrets.

## Jest Games Fund readiness

- **User acquisition:** guests see the custom registration step immediately after the instructions and again after an authoritative win when the cooldown permits. Jest onboarding `customName`, campaign, source, and reference values are preserved through the native registration overlay.
- **Notifications:** registered players receive a fuzzy D1-D7 series early in the session. Stable identifiers replace the existing schedule whenever level, wins, streak, name, or locale changes. Each localized message has distinct reward-focused copy and carries template, offset, campaign, and callback attribution back into the Daily Cosmic Riddle.
- **Virality:** victory, profile, and Race-to-10 surfaces create outside-network Jest referral shares with localized benefit-led copy and branded spoiler-free images. Jest upserts a player's link when `shareReferralLink` receives the same `reference`, so the generic profile invite keeps one stable campaign reference while every personalized victory or race share receives a bounded opaque reference; a later share cannot mutate an older riddle or challenge link. Result invites enter normal play, race invites open the exact race, and contextual registration names the inviter. Strict backend reference families remain reward-eligible and grant 100 coins to each player from signed conversion data, with one idempotency key per inviter/invitee pair across campaigns. Reconciliation overwrites one non-identifying latest-verification checkpoint per Jest player rather than retaining every fresh signed snapshot; the pair reward receipts remain permanent replay-prevention tombstones. A visible reward fanfare closes the loop when the inviter returns.
- **Monetization:** production exposes the configured consumable and subscription products. Signed receipts and subscription entitlements are verified server-side; SKU grants are idempotent; active subscriptions are never re-offered; canceled or failed transactions do not mutate balances; and incomplete purchases are recovered page-by-page before normal play.

Account deletion is authoritative for Riddle Quest data, deletes the player's latest referral-verification checkpoint, and anonymizes referral and purchase anti-replay receipts. Before calling the server, the client verifies an authoritative-pending marker and rotates a same-origin deletion generation. Current-build tabs dynamically reject later SDK/server/browser-state work, while a shared Web Lock drains in-flight work before deletion runs exclusively. An ambiguous response remains authoritative-pending; reload obtains a fresh signed Jest assertion and calls the dedicated idempotent deletion-retry endpoint without minting Firebase identity. A tombstone discovered on another device is treated as deletion intent, not proof that the sweep finished: the client first performs the same signed idempotent retry, then runs local notification, SDK, and browser cleanup before the terminal view. Confirmed deletion advances to client-cleanup-pending, unschedules every current and legacy app-owned engagement or race identifier, clears every app-owned Jest SDK/browser key, and stops startup so it cannot recreate the account. All notification removals are attempted even if one fails, and no marker, notification, SDK, browser, or retry failure may display false success. The Jest HTML5 SDK does not expose deletion of the platform-owned Jest player identity or profile, so players must use Jest's own account controls for that separate platform record.

Every authenticated non-deletion callable holds a Firestore `activeOperations` lease until its handler settles. Deletion writes the permanent guard first and refuses to sweep while any lease remains. The lease `expiresAt` is diagnostic only: an HTTP/callable timeout does not prove the underlying Cloud Run execution stopped, so runtime code never auto-deletes a past-deadline or malformed lease. If an orphan lease blocks deletion, keep the account tombstoned and the deletion retry pending. Remove that lease only through an audited operator reconciliation after proving the originating execution and old deployed revision cannot write; then retry the idempotent deletion endpoint and retain the incident evidence.

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
