# Jest HTML5 production operations

Riddle Quest is a standard React HTML5 game. It has no React Native, Expo, Android, iOS, admin-panel, external-auth, ad, or native-purchase release path.

For the source-audited map of player data, system boundaries, deletion, export, retention, and unresolved owner/counsel decisions, see the [privacy data inventory](../common/security/privacy-data-inventory.md).

## Hosted acceptance

Use an uploaded build in Jest's Developer Console and sandbox. The root package no longer exposes local development servers, local previews, browser harnesses or test-suite commands. Release preparation builds and audits the artifact without running local tests.

1. Create the required accounts under **Developer Console → Sandbox Users**.
2. Upload the approved build through the release command and wait for the Console or completion email to confirm its exact version and final status.
3. Generate a sandbox login link and open the exact uploaded version through Jest's game shell. Keep sandbox login links private.
4. Check onboarding, guest play, registration, one completed riddle, saving, shop entry, cancellation and recovery in the supported hosts.
5. Use two sandbox users to confirm real multiplayer and referral delivery. Reset invitee state only when the account is explicitly disposable and resetting it is authorized.
6. Complete the Developer Console Simulator quality checklist for that same version, including layout, audio, background/resume, enabled payments, subscriptions, notifications and sharing. Record the result against the exact accepted ZIP and backend revision.

Sandbox checkout uses the real platform UI at zero charge. Confirm the account's **Sandbox User** marker before any authorized purchase. Purchase acceptance must include signed receipt verification, a one-time grant, recovery after interruption and successful consumption. Subscription acceptance must include platform activation, restoration and cancellation. Jest owns its Stripe customer, wallet, checkout and charge lifecycle; no Stripe secret or direct Stripe client belongs in the game artifact.

Use dedicated sandbox accounts for purchase acceptance, separate from accounts used for ordinary economy playtesting. Sandbox checkout adds the advertised coins to the saved game even though it charges no money. The [26 November balance reconciliation](evidence/coin-balance-reconciliation-2026-11-26.md) removed 17,350 owner-approved test coins from an otherwise ordinary play account. Any approved correction must retain purchase replay receipts and Premium's last-grant timestamp, record an idempotent adjustment, and preserve concurrent gameplay changes.

A local build or artifact audit does not establish hosted gameplay, payment, notification, persistence or referral acceptance. Keep production App Check and origin restrictions intact while investigating a hosted failure. Do not add localhost to the deployed `JEST_GAME_ORIGIN` allowlist.

## Build and artifact verification

The [November 26 shorter instructions release](evidence/instructions-copy-2026-11-26.json) removes the guessing-tips paragraph, its unused heading and locale keys, and the extra onboarding grid row. Jest confirmed version `01a219ab-03a7-751d-8f5c-bc5dfcb02ccd` ready and active at 21:02:54 UTC. Production checks passed; tests and browser viewport checks were not run.

The [November 26 subscription details release](evidence/subscription-details-2026-11-26.json) displays Premium benefits immediately and keeps known plan details visible during ownership refresh or failure. Checkout actions remain unavailable until verification succeeds. Jest confirmed version `01a2199a-2cdd-7453-9169-81a028de8c9f` ready and active at 20:44:32 UTC. The production gate and artifact checks passed; tests and browser checks were not run.

The [November 26 Growth Fund fixes](evidence/growth-fund-fixes-2026-11-26.json) add first-session guest registration, registration before subscription checkout, and early manager-owned D1–D7 reminders with approved images and distinct bodies of 69–84 characters. Supabase, Vercel and the authenticated Firebase handoff are deployed. Jest confirmed version `01a21988-b3e9-75d9-89ab-8518bd6d5c34` ready and active at 20:25:27 UTC. The production gate and artifact checks passed; tests, browser harnesses and Simulator acceptance were not run. Refresh the whole Simulator page before replaying the checks because Reload app retains earlier recorded failures.

The [November 26 profile avatar release](evidence/jest-profile-avatar-2026-11-26.json) makes the profile image open avatar selection and displays the saved game avatar in Profile and multiplayer. Guests are prompted to register. Jest confirmed version `01a2193e-f9a4-734e-a149-a50ae15385a9` ready and active at 19:04:55 UTC. Production builds and audits passed; tests, browser harnesses and hosted avatar upload acceptance were not run.

The [November 26 completion first-paint release](evidence/jest-completion-first-paint-2026-11-26.json) opens victory with its confirmed award and first milestone already visible. The solved board remains visible while confirmation is pending. The matching `submitSinglePlayerGuess` update accepts the receipt opt-in and returns the already-committed completion, avoiding a separate completion request. Both configured Functions regions were deployed and their exact source archives verified. Jest confirmed version `01a217b0-3062-716a-b0ed-6c02155db364` ready and active at 11:50:23 UTC. Production builds and audits passed; tests, browser harnesses and hosted gameplay acceptance were not run.

The [November 26 achievement popup timing release](evidence/jest-achievement-popup-timing-2026-11-26.json) increases the achievement hold from one second to three seconds before its exit animation. Jest confirmed version `01a217a8-b677-7498-95d8-18b251a63b84` ready and active at 11:41:17 UTC. Production builds and audits passed; tests, browser harnesses and hosted gameplay acceptance were not run.

The [November 26 achievement popup release](evidence/jest-achievement-popups-2026-11-26.json) uses only confirmed unlock receipts and records shown achievements per account in browser storage. Reloads and replayed receipts skip achievements already presented in that browser. Jest confirmed version `01a2179e-0a01-73bc-b5e2-db8e4a7afdf1` ready and active at 11:29:36 UTC. Production builds and audits passed; tests, browser harnesses and hosted gameplay acceptance were not run.

The [November 26 idle multiplayer inbox release](evidence/jest-idle-multiplayer-inbox-2026-11-26.json) prevents an optional background invitation lookup failure from displaying a race error on the multiplayer menu. Invitation discovery retries automatically and preserves validated invitations during temporary failures. Jest confirmed version `01a21788-be4e-7078-b4e3-921ea25c0ca3` ready and active at 11:06:23 UTC. Production builds and audits passed; tests, browser harnesses and hosted gameplay acceptance were not run.

The [November 26 multiplayer waiting alignment release](evidence/jest-multiplayer-waiting-alignment-2026-11-26.json) centers the opponent waiting message across the gameplay grid, including short landscape layouts. Jest confirmed version `01a2164a-8489-7497-bb35-bc5af56ba9d9` ready and active at 05:18:39 UTC.

Run the production build and audit gate:

```bash
pnpm verify:production
```

This runs the retained dependency, security, type, backend lint/runtime, production build, W3C, artifact and packaging checks. It does not run unit suites, emulator tests, local browser journeys or a mobile soak. A failed build or audit stops release preparation.

Facebook source-secret, build and artifact checks remain part of this gate. Its separate ZIP and handoff preparation runs only through the explicit Facebook preflight, so a pending Facebook upload does not prevent verification of the independent Jest archive.

The [November 26 completion milestone release](evidence/jest-completion-milestones-2026-11-26.json) records version `01a21650-d6d1-7746-9031-031b0da256cb`, built from `9f9d06ace274`. Jest confirmed it ready and active at 05:25 UTC. Victory waits for the completion receipt and every applicable level-up and achievement before enabling Next. Delayed profile refreshes and auxiliary rewards no longer discard these milestones.

The [November 26 victory chest release](evidence/jest-victory-chest-stability-2026-11-26.json) records version `01a21644-c073-77b5-9177-ec2dadc43fe2`, built from `9637a79c7cde`. Jest confirmed it ready and active at 05:12 UTC. The victory modal displays its chest immediately and reserves the reward text space while confirmation is pending.

The [November 26 transport encryption release](../common/security/evidence/transport-encryption-2026-11-26.json) records version `01a21614-d1d7-7132-9400-7126639803b7`, built from `af20085bce70`. Jest reports it ready, with activation at 04:19:55 UTC. The game encrypts its own API bodies, including application errors and live-race streams, and reads profiles through the authenticated encrypted callable. HTTPS remains required, and the browser owner can still inspect decoded runtime data.

The [November 25 manager registration release](evidence/jest-manager-registration-only-2026-11-25.json) records the completed upload and activation of version `01a211e5-afe7-7735-a223-04c1e3f67488`, built from `89eb0c737`. Jest confirmed processing complete and active status at 08:50 UTC. Games expose registration and consent only, with no device-status polling, popup tracking or enrollment response listener. The manager and device own push delivery and notification responses.

The earlier [November 25 notification modal release](evidence/jest-notification-modal-2026-11-25.json) records version `01a21081-324d-7632-a164-140a09e3827d`, activated at 02:20 UTC. The separate post-menu modal and private manager handoff remain in the newer registration-only release.

The earlier [November 25 guest registration release](evidence/jest-guest-registration-2026-11-25.json) records version `01a21016-96b0-70b8-b024-b0321c3ac82a`, activated at 00:24 UTC. Guests see registration after Daily completion or every third completed Classic word, after the completion panels close.

The earlier [November 25 guest notification toggle release](evidence/jest-guest-notification-toggle-2026-11-25.json) records version `01a21003-7613-7479-be52-bbe911ea742c`, activated at 00:03 UTC. The Settings notification control is disabled and shown Off for guests.

Individual build and lint commands remain available:

```bash
pnpm build:jest
pnpm --dir firebase-functions lint
pnpm build
```

`build:jest` validates TypeScript, every imported locale JSON file, the production build and the standalone artifact. The artifact audit enforces a 4.75 MiB internal release budget beneath the 5 MiB artifact cap, retaining 0.25 MiB of headroom for the actual-screen capture renderer. The renderer is lazy-loaded only for screenshot requests and the 0.55 MiB initial-resource budget remains unchanged. The audit also checks relative assets, the single approved Jest SDK script, and the absence of native modules, external authentication, ads, install prompts, secrets and source maps.

## Current projects

- Firebase project: `riddle-quest-ec2b2`
- Firebase web app: `1:329028367192:web:b85776d379ea3356b7eb2d`
- Jest team: `019faa67-d2a6-7169-aa29-a4411a3a3c3d`
- Jest game: `019faa68-f3ec-755d-9ab5-c887fb426801`
- Jest outer origin: `https://jest.com`
- Jest build origin: `https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com`
- Functions base URL: `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net`

The committed `platforms/web/jest/.env.jest` contains public Firebase client configuration. Vite loads only that dedicated repository-level directory; any legacy `packages/web-game/.env*` file blocks the production audit and timestamped release. `JEST_SHARED_SECRET` remains in Firebase Secret Manager. The only deployed Functions are the authoritative Jest identity, purchase, referral, profile, leaderboard, riddle, and gameplay boundaries; the obsolete legacy-migration Functions have been deleted.

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

Profile and the local multiplayer player display the current Riddle Quest username and saved avatar from the authenticated game profile, with the Jest SDK profile as a fallback. Pressing the profile image opens the existing photo picker for registered players or registration for guests. Avatar uploads use the authenticated game profile service, and the saved image takes precedence over the Jest photo. This does not rename either account or change the platform-owned Jest profile.

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

Build and upload from a clean, committed `main` checkout. Confirm `git branch --show-current` returns `main` and push the reviewed source to `origin/main` before preparing the release.

The user's standing instruction is to update Jest after each completed Jest game build. Run `pnpm release:jest` to upload and activate that build without requesting permission again, unless the user explicitly asks for a build-only, dry-run or inactive result. The production gate's internal builds and immutable rebuild form part of that one release; they do not start additional uploads. Confirm the exact uploaded version is ready and has the requested activation state through Jest before reporting completion. Publication, review submission and GitHub Actions runner usage retain their separate authorization requirements.

Install the credential template outside the repository with owner-only permissions, then set the game upload token and notification email. The release rejects repository-local, linked, group-readable, or world-readable credential files:

```bash
install -D -m 600 platforms/web/jest/jest-release.credentials.example \
  "${XDG_CONFIG_HOME:-$HOME/.config}/riddle-quest/jest-release.env"
pnpm release:jest
```

Keep `JEST_UPLOAD_IS_ACTIVE` and `JEST_CONFIRM_ACTIVATION` out of that persistent file; the credential parser rejects
both so a stale file cannot change release behavior. The canonical `release:jest` interface also rejects either variable
in its process environment. Build activation is allowed. Game publication, review submission and listing visibility changes remain held. Set `JEST_RELEASE_INACTIVE=true` for an explicitly inactive build.

For GitHub Actions CD, create a protected `jest-production` environment, require the desired reviewers, restrict it to
the `main` branch, and add `JEST_GAME_UPLOAD_TOKEN` plus `JEST_NOTIFICATION_EMAIL` as environment secrets. Dispatch
`Upload and activate Jest build` from the `main` branch. The workflow uses the same canonical release command and a
non-cancellable production concurrency lock; it does not provide a shorter CI-only upload path. Facebook, Reddit, and
YouTube retain their separately documented manual handoff boundaries.

The command refuses a dirty worktree, acquires an exclusive release lock, adds the source commit and a random attempt ID
to its timestamped version, and runs `verify:production` before reading credential-file contents. Timestamped
releases require Linux and functional `/usr/bin/bwrap`; the command probes the boundary first and refuses an unsandboxed
fallback. Every gate, build, validator and uploader child receives a minimal environment and runs with the
operator home hidden, isolated home/temp/PID/proc state, a read-only host filesystem, and required runtime caches
rebound read-only. During the credential-free gate, only the repository and isolated release workspace are writable;
`.git`, ignored `.env*` files, receipt state, other known secret-bearing paths, and the exact configured credential path
are overmounted. Before reading credentials, the repository, committed snapshot, and copied trusted release scripts are
switched to read-only mounts. Network remains shared for dependency and W3C audits. The command fingerprints the pnpm/npm lock and workspace manifests
plus the installed root/core/portal/Functions dependency trees when it acquires the lock, then
requires the same fingerprint immediately before upload. It materializes the committed Git snapshot in a unique
`/tmp` workspace, builds there with the Sentry token scoped to the direct Vite process, packages a version-specific
archive, extracts it into a fresh read-only directory, and reruns the artifact and W3C audits against those
extracted bytes. Parent-held pre/post fingerprints and the trusted uploader independently bind the Git commit and clean
state, ZIP size, SHA-256, version, game, receipt, and activation intent before the unchanged ZIP is uploaded with
`isActive=true` by default. Processing activates that exact build. `JEST_RELEASE_INACTIVE=true` retains an inactive build. Neither mode submits the game for review, publishes it, or changes listing visibility.

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
pnpm preflight:jest-upload
```

The direct preflight overwrites `build.zip` and its default gate receipt together; the timestamped release instead uses
version-specific workspace paths. There is deliberately no direct live-upload package command. Only the sandboxed
timestamped release may transmit: it binds the source commit and clean state, ZIP bytes, build version, game ID, and
activation intent to the receipt, then frames the token through an anonymous pipe. The uploader consumes and closes that
pipe before starting any child and sends the token only as an in-process HTTPS header, never in an exec-time environment
or command-line argument.

Before sending bytes, the uploader stores atomic mode-`0600` barriers for both the exact game/build version and the
game/source commit. The documented upload API returns HTTP `202` with a `versionId` and `buildStatus: "processing"`; that
means the upload was accepted for background processing, not that the build is ready or active. A timeout, termination, or crash leaves the source barrier
blocked as transmitting/ambiguous, so generating a new timestamped build version from the same source cannot bypass the
uncertain attempt. Reconcile it through the [Developer Console build status and build-completion email](https://docs.jest.com/dev-console/builds).
After a documented `202`, both receipts transition to accepted-pending and record the version ID and exact ZIP checksum;
the source-wide barrier deliberately remains. Only after the Console or completion email reports an authoritative final
status may an owner manually remove the corresponding `<game-id>.<source-commit>.unresolved-upload.json` file from
`platforms/web/jest/build/.jest-upload-receipts`; retain the accepted build-specific receipt as the audit record, or reconcile it
before ever retrying that exact version. Do not delete either barrier and retry blindly: Jest may already have accepted
the first request. Jest does not currently document an authoritative build-status polling endpoint, so the tooling
deliberately does not infer readiness from elapsed time or poll an unofficial URL. Use the Developer Console or completion
email to confirm that the receipt's exact build finished processing and became active, then complete hosted sandbox acceptance.

### Build activation and game publication

The user permits Jest build activation and Firebase Functions deployment. The
canonical command activates the processed build, while game publication remains
held. Verify the exact build in the Simulator and sandbox against its intended
backend/rules cohort. Before activation, verify that
`getCurrentClassicRiddle`, `getCurrentDailyChallenge`, `submitSinglePlayerGuess`,
`completeGame`, `getHint`, `spendCoins`, and `skipRiddle` belong to one reviewed
Firebase deployment cohort. Use `JEST_RELEASE_INACTIVE=true` when an inactive
build is wanted instead.

Build activation does not authorize game approval, moderation submission,
publication or listing visibility changes. Those remain separate owner actions.

## Developer Console setup

Owner access to `https://jest.com/developers` is required:

1. Treat [the desired Developer Console manifest](jest-developer-console.json) as the source of truth for the game ID,
   public listing, loading mode, exact asset bytes, catalog SKUs, and any separately published onboarding games. Validate all known values and assets:

   ```bash
   pnpm check:jest-console
   ```

2. The owner-approved publisher is `Jest`, and the approved Console privacy-policy URL is
   `https://roobsworld.com/privacy`. Keep both values exact; the privacy URL is Console metadata and must not be added to
   the in-game About page because Jest requires external links to be removed. The stricter check binds both decisions:

   ```bash
   pnpm check:jest-console:release
   ```

3. Copy the manifest's exact listing values into the Console, select its logo and hero from the Asset Library, select Manual
   loading mode, and confirm the game is Approved and Public. The validator is read-only and never changes Console state.
4. Create the six consumable SKUs and monthly subscription SKU in the manifest. All players must read their signed
   subscription entitlement before the shop renders, and an active subscription must never be offered again.
5. Deploy the manager-owned Jest daily plan and its authenticated Firebase handoff before releasing the client. Keep the `riddle-q-notification` image reference approved and unarchived in the Image Library. See [platform delivery](../common/notifications/platform-delivery.md#jest).
6. Create at least two sandbox players. The manifest currently lists no separate onboarding games; referral links enter Riddle Quest directly.
7. Verify that the activated build matches the receipt's exact version ID and build version, then run the
   acceptance matrix below.

## Sandbox acceptance matrix

- Identity: guest and registered startup; dismissal and cancellation; stable player ID; invalid and stale token rejection.
- Returning guests: after completing onboarding on an earlier visit, Play closes the welcome screen and opens registration. A previous dismissal does not suppress this prompt. Registered players proceed without registration. First-time guests see the dismissible registration flow immediately after completing the instructions.
- Loading: every manual phase advances; no 15-second timeout; retry works; overlay closes only when input is enabled.
- Analytics: `markGameLoaded()` reports actual readiness; registration and attribution events contain no personal data. Jest's current SDK deprecates `markFirstMilestone()` as a no-op, so use the game's events for win analytics.
- Notifications: after registered startup or registration, the manager supplies seven distinct English reminders for D1–D7, each at most 100 characters and referencing an approved library image. Validate replacement of stable identifiers, Settings Off, explicit opt-out across reload, retry after a manager outage, and account deletion cleanup. No guest schedules or notification-response rewards.
- Payments: success, cancellation, internal error, invalid SKU/token, timeout, interruption before completion, and multi-page recovery.
- Subscriptions: signed entitlement sync, guest Subscribe opens registration before any billing call, successful or cancelled checkout, active offer suppression, restoration, and cancellation. Premium benefits appear immediately, including before the first catalog response. Known subscription details remain visible during refresh or failure; the Subscribe action stays hidden while ownership is loading or unavailable. After activating a plan in the Simulator Config panel, reload the app to read that ownership.
- Referrals: canceled profile and Race-to-10 shares; existing result links remain in the normal game; race links open the exact challenge; first-entry attribution; both players receive 100 coins; duplicate, cross-campaign duplicate, self, tampered, and unrelated-reference rejection. The victory modal has no share action.
- Layout/input: keyboard, pointer, and touch in portrait and landscape; background/foreground; audio unlock; offline restart.
- Stability: lower-end iOS Safari and Android Chrome cold/warm launch plus a 10-minute foreground/background soak.

Retain screenshots, recordings, event IDs, and device traces with the relevant release or incident evidence. Do not commit authenticated browser state, private player data, or secrets.

## Jest Games Fund readiness

Jest multiplayer friend invitations use the [Referrals API](https://docs.jest.com/sdk/referrals). Select a category and choose **Challenge a friend** to reserve a private lobby, then choose **Challenge a friend** in the lobby to open Jest's share dialog with the message and exact challenge link. The SDK call runs directly in the click handler after a synchronous account-deletion check. Each share has its own reference so a later lobby cannot replace an earlier invitation. Dismissing the dialog keeps the lobby available for another attempt; a provider failure shows the translated retry notice. The player chooses the recipient and messaging destination in the platform dialog. SDK success does not prove SMS delivery. Confirm actual guest, registered-player, retry, recipient-entry and messaging behavior with two Jest sandbox users on the exact uploaded version before publication.

- **User acquisition:** returning guests see the custom registration step after pressing Play on the welcome screen, attributed to `returning_player`. First-time guests see the dismissible custom registration flow after the instructions, attributed to `post_instructions`, and can choose Play as guest. Guests also see registration after completing the Daily challenge or every third completed Classic word, once completion rewards and achievements close. The Classic count continues from saved guest progress. Registration remains available from Profile. Jest onboarding `customName`, campaign, source, and reference values are preserved through the native registration overlay.
- **Notifications:** opted-in registered players receive the manager-owned fuzzy D1–D7 plan early in the session. Seven stable identifiers replace prior schedules on return or opt-in. The manager supplies distinct English copy, CTA, day and the approved `riddle-q-notification` asset reference. The adapter adds no gameplay payload, tap handler or reward. The backend must be deployed before the client; see [the handoff](../common/notifications/platform-delivery.md#jest).
- **Virality:** profile and Race-to-10 surfaces create outside-network Jest referral shares with localized benefit-led copy and branded spoiler-free images. Jest upserts a player's link when `shareReferralLink` receives the same `reference`, so the generic profile invite keeps one stable campaign reference while each personalized race share receives a bounded opaque reference; a later share cannot mutate an older riddle or challenge link. Existing result invites enter normal play, race invites open the exact race, and contextual registration names the inviter. The victory modal shows the chest award and next-round action without a share button or reward breakdown. Strict backend reference families remain reward-eligible and grant 100 coins to each player from signed conversion data, with one idempotency key per inviter/invitee pair across campaigns. Reconciliation overwrites one non-identifying latest-verification checkpoint per Jest player rather than retaining every fresh signed snapshot; the pair reward receipts remain permanent replay-prevention tombstones. A visible reward fanfare closes the loop when the inviter returns.
- **Monetization:** production exposes the configured consumable and subscription products. Signed receipts and subscription entitlements are verified server-side; SKU grants are idempotent; active subscriptions are never re-offered; canceled or failed transactions do not mutate balances; and incomplete purchases are recovered page-by-page before normal play.

Account deletion is authoritative for Riddle Quest data, deletes the player's latest referral-verification checkpoint, and anonymizes referral and purchase anti-replay receipts. Before calling the server, the client verifies an authoritative-pending marker and rotates a same-origin deletion generation. Current-build tabs dynamically reject later SDK/server/browser-state work, while a shared Web Lock drains in-flight work before deletion runs exclusively. An ambiguous response remains authoritative-pending; reload obtains a fresh signed Jest assertion and calls the dedicated idempotent deletion-retry endpoint without minting Firebase identity. A tombstone discovered on another device is treated as deletion intent, not proof that the sweep finished: the client first performs the same signed idempotent retry, then runs local notification, SDK, and browser cleanup before the terminal view. Confirmed deletion advances to client-cleanup-pending, unschedules every current and legacy app-owned engagement or race identifier, clears every app-owned Jest SDK/browser key, and stops startup so it cannot recreate the account. All notification removals are attempted even if one fails, and no marker, notification, SDK, browser, or retry failure may display false success. The Jest HTML5 SDK does not expose deletion of the platform-owned Jest player identity or profile, so players must use Jest's own account controls for that separate platform record.

Every authenticated non-deletion callable holds a Firestore `activeOperations` lease until its handler settles. Deletion writes the permanent guard first and refuses to sweep while any lease remains. The lease `expiresAt` is diagnostic only: an HTTP/callable timeout does not prove the underlying Cloud Run execution stopped, so runtime code never auto-deletes a past-deadline or malformed lease. If an orphan lease blocks deletion, keep the account tombstoned and the deletion retry pending. Remove that lease only through an audited operator reconciliation after proving the originating execution and old deployed revision cannot write; then retry the idempotent deletion endpoint and retain the incident evidence.

Automated coverage proves the integration contract and failure handling. Before a Fund submission, repeat the Notifications, Payments, and Referrals rows above with real Jest sandbox players and retain the Developer Console evidence; local mocks cannot prove catalog configuration, delivery by the messaging network, or live payment settlement.

## User acquisition configuration

1. Keep the Explore logo, hero image, and short description aligned with the first-play experience.
2. Use the direct game URL for paid and creator campaigns. Jest-preserved `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content` values are allowlisted and attached to the `session_started` analytics event.
3. Use structured `entryPayload` values for referrals, onboardings, and notifications. Riddle Quest validates these values before routing and carries `customName`, campaign, and reference into registration.
4. Compare `session_started`, `registration_prompt_shown`, `registration_prompt_dismissed`, and `registration_completed` in Jest analytics by campaign. Events contain attribution labels and booleans only, never player names or other personal data.
5. Preserve the returning-guest prompt after Play and the completion prompts after each Daily win and Classic words 3, 6, 9, and so on. Returning guests see registration on each new visit after Play, regardless of previous dismissals.

## Viral funnel scorecard

Review by `campaign` and `surface` at least weekly:

1. Share intent rate: `viral_share_intent` / authoritative wins or profile visits.
2. Share-dialog non-cancel rate: successful `viral_share_dialog_result` / `viral_share_intent`. This is a dialog outcome, not proof that a message was delivered.
3. Invite open rate: `viral_invite_opened` / non-canceled share dialogs, interpreted directionally because the platform does not expose delivery.
4. Attributed registration rate: `viral_invite_registered` / `viral_invite_opened`.
5. Signed conversion and reward rate: rewarded registrations from `viral_referrals_reconciled` / invite opens.
6. Viral coefficient proxy: distinct signed registrations / players who opened a share dialog, split between `friend_challenge_v2`, `open_invite_v1`, and `race_to_10_v1`.

Do not rename stable Jest share references after launch. Campaign and surface labels may evolve for experiments, but the backend allowlist and per-pair reward key must remain migration-compatible. Validate any reward-copy or amount experiment against the server-owned `JEST_REFERRAL_REWARD_COINS` constant before release.
