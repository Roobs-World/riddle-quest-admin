# Facebook Instant Games operations

As of 16 October 2026, the hourly Facebook context-retention schedule is removed. Request-time expiry, rollover deletion, account deletion and manual retention commands remain. Untouched expired records are not guaranteed automatic physical cleanup. Analytics does not delete provider data.

Last updated: 2026-11-24

This runbook describes the Facebook web target currently present in source. It is not release approval. The authoritative acceptance status is
[`facebook-instant-games-progress.html`](facebook-instant-games-progress.html). An exact-hash, non-production role-account test draft is permitted only after the local artifact/backend preflight so P0 Meta-hosted evidence can be collected. Business/Partner approval, production promotion, public traffic, and a claim of release readiness remain forbidden until their required gates pass.

## Build and inspect

```sh
pnpm build:facebook
pnpm audit:facebook-artifact
```

The build writes `builds/facebook`. It must load only `fbinstant.8.0.js`, contain root `fbapp-config.json`, remain below 5 MiB of critical initial resources and 200 MiB total, contain no source maps or private credentials, and pass the reciprocal Jest-leakage audit. The Jest build remains independently available through `build:jest`; never combine both SDKs in one artifact.

When using a private output directory, each of the six target builds and its audit
honours that target's `TARGET_BUILD_OUT_DIR` variable (for example,
`FACEBOOK_BUILD_OUT_DIR`). An explicit audit path takes precedence. Netflix and
Yahoo no longer audit a stale default folder after building elsewhere. The
[2 October follow-up](evidence/facebook-review-followup-2026-10-02.md) records
the failing/passing regression, six builds and unchanged Facebook/Jest bytes.

The current local-testing changes and the Meta-hosted acceptance checklist are recorded in
[the 1 October testing preparation](evidence/facebook-testing-readiness-2026-10-01.md).
Startup completes `initializeAsync`, reports 100% SDK loading, and awaits `startGameAsync`
before reading player identity/cloud state. Saved language takes precedence over
`FBInstant.getLocale()`. Meta matchmaking uses the top-level `matchPlayerAsync` API
and tags containing only letters, numbers, and underscores. Provider overlays use the documented show/dismiss lifecycle. An optional runtime
destruction hook is used only when available; the game container is removed on
social-surface exit. A v8 destruction method is not required or claimed as guaranteed. SDK pause/resume
signals now reach shared gameplay/audio as well as storage/presence; browser visibility
remains a fallback. These paths still require Meta-hosted acceptance.

## Server configuration

Run the interactive setup/evidence guide from the repository root when the real Meta app is available:

```sh
pnpm facebook:setup
```

The wizard stores the Meta app ID, origins, and deletion-status URL under the ignored, owner-local `.facebook-setup-receipts` directory. It deliberately never accepts secret values, does not collect `FACEBOOK_FIREBASE_APP_ID`, does not write the Functions deployment environment, and never changes tracker statuses. Treat `setup.env` as evidence input only: obtain the canonical Firebase web app ID separately, review all four non-secret values, and deliberately copy them into `firebase-functions/.env.riddle-quest-ec2b2` before backend preflight. Meta approvals remain deferred until the production gate, as requested.

Private values belong in Firebase/Google Secret Manager and CI secret bindings, never `VITE_*`, source files, logs, fixtures, ZIPs, or Meta configuration exports:

- `FACEBOOK_APP_SECRET`: newly issued Meta app secret used to verify signed player and deletion assertions.
- `FACEBOOK_UID_SECRET`: independent fixed HMAC key for generation-separated `facebook_<40 hex>` Firebase UIDs. Current source has no key version, previous-key fallback, or migration; never rotate it in place for an app with existing provider records. If it is exposed, disable Facebook identity until a reviewed dual-key/migration release has moved identity and deletion safely; see the credential-rotation runbook.

The [1 October access review](../common/firebase-functions/evidence/provider-iam-readiness-2026-10-01.md) confirms the sampled Facebook, Reddit and Jest functions share one runtime principal with access to all four Facebook/Reddit secrets. Exact environment bindings and clean browser artifacts do not prove provider-separated IAM. A reviewed runtime-identity cutover remains required before least privilege can be claimed; no grants or key values were changed.

Non-secret deployment configuration includes `FACEBOOK_APP_ID`, `FACEBOOK_FIREBASE_APP_ID`, exact comma-separated `FACEBOOK_GAME_ORIGINS`, and the HTTPS `FACEBOOK_DELETION_STATUS_BASE_URL`. The app secret also domain-separates opaque deletion confirmation codes. Historical Facebook values documented in repository history are compromised and must not be reused.

### Identity nonce retention

One-use identity challenges keep their original five-minute logical deadline after consumption. New issuer records also write an exact Firestore `expiresAt` timestamp. Consumer validation accepts valid legacy records without that field during rollout, rejects contradictory physical timestamps and clock rollback, and still refuses expired/consumed/missing challenges independently of physical cleanup. The server clock is rechecked after reads, transaction retries and commit. A commit that finishes after expiry remains spent but cannot authorize authentication; the client must obtain a fresh challenge. The committed TTL policy applies only to `facebookIdentityNonces.expiresAt`, with indexing disabled. It does not change provider identity mappings, Jest authentication or another target's data.

The bounded legacy backfill defaults to dry run and requires an explicit project:

```sh
pnpm --dir firebase-functions facebook:nonces:retention \
  --project riddle-quest-ec2b2 --page-size 100
```

After reviewing the page and authorizing maintenance, the same command may use `--apply --confirm-project riddle-quest-ec2b2`. Pass each emitted `--after NONCE_HASH` to continue. It transactionally reads at most 100 nonce rows per page, writes only missing expiry timestamps, retains consumed receipt metadata, and never recreates deleted state. Invalid rows fail the page with aggregate counts; resolve them and retain every page outcome before claiming complete coverage. Unknown/duplicate options and an operator-supplied clock are rejected before SDK initialization.

Deploy and verify the updated backend and TTL policy as part of the target backend release. A read-only exact-field check on 2026-10-01 found no live nonce TTL configuration. No production backfill or policy deployment has occurred. [Firestore TTL](https://firebase.google.com/docs/firestore/ttl) deletion is asynchronous; verify physical cleanup separately and keep the server's immediate logical expiry. See [nonce retention evidence](evidence/facebook-nonce-retention-2026-10-01.md).

### Firebase backend deployment

All new and changed Functions must be deployed before the Facebook artifact is uploaded. Run `pnpm preflight:facebook-backend` from the repository root first. It validates the Jest and Facebook deployment environments, server-only secret bindings, a 22-entry Facebook-specific/supporting callable/trigger/scheduler export subset, types, lint, the complete Functions suite, and the deploy build. The subset audit fails for any omitted or duplicate listed entry, but it is not a complete dependency inventory: Facebook also uses shared gameplay/race/account callables such as `deleteAccount`. The full deploy command intentionally includes every exported Function and all dependent rules so those shared paths cannot be selectively omitted. The preflight deliberately fails until the four non-secret Facebook values above are present in `firebase-functions/.env.riddle-quest-ec2b2`; it never accepts a Page name in place of the numeric Meta App ID. Secrets remain in Secret Manager and must not be added to that file.

After reviewing the target project and successful preflight output, the authorized operator runs `pnpm --dir firebase-functions deploy:facebook-backend`. This command targets `riddle-quest-ec2b2` explicitly and deploys all exported Functions together with Firestore rules/indexes, Realtime Database rules, and Storage rules. Deploying only selected new callable names is insufficient because shared gameplay, deletion, identity, presence, social, and rules boundaries changed together. Retain the Firebase release output and deployed revision identifiers as tracker evidence; source tests are not proof of deployment.

`FACEBOOK_DISABLED_FEATURES` is a comma-separated emergency-off list. Accepted names are `identity`, `commerce`, `rewarded_ads`, `interstitials`, `referrals`, `notifications`, `matchmaking`, `tournaments`, and `presence`. Unknown names fail deployment closed. Identity is enforced before nonce issue and exchange. Every switch is projected by the authenticated client-configuration callable; implemented server mutations additionally enforce their relevant switch. The Facebook entry composes referrals, native shares, contexts/boards, tournaments, notifications, ads, and presence only when their independent authenticated startup projection permits them, the configured audience is 13+, and the relevant SDK APIs are advertised. Commerce is composed only after authentication, advertised Meta payment APIs, and the server webhook-readiness gate permit it. Rewarded video has a real SDK adapter and a locally verified, session-bounded extra-try path, but no coin grant may depend on its browser completion alone. The extra-try callable enforces `rewarded_ads`; deployment/activation and acceptance are described below. Interstitials are startup-projected and client-only: an already-running tab does not poll a changed switch before another SDK request, so an incident response must also terminate/reload active Facebook sessions and verify the restarted projection. A configuration read failure hides every optional feature while core play continues. Authenticated Facebook configuration and consent requests mirror the deployed presence value to the server-only `featureGates/facebookPresence` RTDB node. Rules fail Facebook presence closed while that node is missing or false, revoke existing listeners, and deny new Facebook connection writes without affecting Jest.

### Emergency switch procedure

1. Record the incident ID, UTC time, deployed revision, and affected provider capability. Preserve sanitized evidence; never paste assertions, secrets, raw player IDs, receipts, or notification tokens into the incident record.
2. Read the current deployed `FACEBOOK_DISABLED_FEATURES` value. Add only the exact affected name, retain every existing disabled name, and deploy Functions configuration through the normal audited environment workflow. Do not change a `VITE_*` value or rebuild Jest for an emergency server switch.
3. Verify an authenticated Facebook configuration response reports only that capability disabled. This request also synchronizes the RTDB presence rules gate before reading optional commerce state. For `identity`, verify nonce issue and exchange return the expected unavailable response instead. Verify an unrelated Facebook capability and Jest core play still work.
4. For presence, confirm an already-open Facebook status listener is revoked, a new Facebook connection write is denied, opt-out cleanup remains available, and equivalent Jest reads/writes still succeed; stale records may remain server-only until ordinary disconnect cleanup. For commerce/referrals, confirm no new implemented grant boundary can execute. Confirm the disabled projection removes the corresponding native ad or bot-subscription capability after restart. For interstitials, close/reload active sessions and verify the restarted client sees the disabled projection because no per-impression server check exists. For matchmaking/tournaments, confirm writes fail server-side as well as disappearing from the client.
5. Record the configuration revision and verification evidence. Re-enable by removing only the incident's name after root-cause remediation has passed the same checks and a second person approves the change.

Local parser/projection regression command:

```sh
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand \
  src/__tests__/facebookFeatureFlags.test.ts \
  src/__tests__/facebookClientConfiguration.test.ts
```

## Identity and deletion

The browser requests a one-use nonce, asks FBInstant for signed player information bound to that exact nonce, and exchanges the assertion for a Firebase custom-auth token and a one-hour custom App Check token. The server verifies the HMAC, algorithm, player, nonce, issue time, size, replay state, configured app secret, origin, and request limits. A local limiter sheds bursts and a Firestore transaction enforces the shared 20-request-per-minute identity quota across instances. Its record key is a domain-separated HMAC of the client key, never the raw address, and its committed `expiresAt` TTL removes it after 24 hours. Reuse fails closed unless that timestamp is present and exactly 24 hours after the fixed window reset; malformed retention metadata is never silently repaired by accepting another request. Deploy and verify the `facebookIdentityRateLimits.expiresAt` TTL policy before opening role-account traffic. Provider records are server-only and custom claims contain `provider: facebook` and `accountGeneration`, not Meta names or photos.

In-game deletion and Meta's signed form callback use the same idempotent cleanup path. Before destructive work starts, the callback transaction writes a replay receipt that freezes the provider scope and exact account generation being deleted. Every processing retry restores only that frozen deterministic UID; it never resolves the provider's then-current generation. If a lost response is retried after the player has explicitly started the next generation, the old generation is accepted as already deleted without touching the new UID. A completed deletion advances the provider account generation and clears its active UID; a later explicit play session receives a different HMAC-derived UID and the standard 300-coin fresh profile. The server-only provider record retains the raw game-scoped Meta player ID, app ID, provider, creation metadata, generation/status, hashed old UID, and deletion metadata so the next deterministic generation can be derived. The public callback returns an opaque confirmation code and configured HTTPS status URL without exposing an identity.

The 2 October Chrome Basic settings check shows the saved callback
`https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/facebookDataDeletionCallback`.
Its unsigned GET returns 405 and its Function is ACTIVE with the correct app ID.
The MCP's empty generic deletion URL does not prove this callback is absent.
Keep the configured value; signed deployed acceptance and independent review
remain required. No settings were changed during this inspection.

Before an in-game Facebook deletion, the shell rotates the local `riddleQuest:facebookAccountDeletionEpoch:v1` value so other current-build tabs reject new gated host/storage work. Those gated operations hold a shared `riddleQuest:facebookPlayerOperations:v1` Web Lock; deletion waits for its exclusive lock and stops presence. Direct context/tournament capability calls do not hold that browser lock, but authenticated server callables use deletion-guarded operation leases, and deletion fails retryably while any such lease remains. A secure runtime without Web Locks fails the destructive request before server mutation. After authoritative success, the shell writes `null` to its two exact FBInstant data keys and flushes. A later reload treats the rotated epoch as its new baseline, allowing the explicit generation-based fresh start. Real Meta webview support and mixed-version/cross-device provider propagation remain P0 acceptance evidence.

## CSP and Meta-hosted acceptance

The root Firebase Hosting CSP is the Jest policy and is not evidence for the Meta-hosted artifact. Capture the effective Meta response headers and every required host from a real role-account session before defining the Facebook CSP allowlist. Prove Firebase Functions, Firestore/App Check, SDK script, overlays, ads, purchases, notifications, contexts, tournaments, web, iOS, and Android without a wildcard expansion. SDK `onPause` flushes storage, stops presence, and pauses shared gameplay/audio. SDK `onResume` resumes visible gameplay and eligible presence; browser visibility remains available as fallback. The injected harness verifies the provider events while the document remains visible, but host suspension, gameplay/input, audio, and physical-device behavior still need independent hosted verification. Record sanitized network logs and screenshots against the exact ZIP hash.

## Machine translation corpus

Keep `OPENAI_API_KEY` outside the repository and use distinct translator and critic models. Generation is resumable and owner-private; it does not make content eligible by itself:

```sh
pnpm --dir firebase-functions race:translations:generate -- \
  --translator-model TRANSLATOR_MODEL --critic-model DISTINCT_CRITIC_MODEL
pnpm --dir firebase-functions race:translations:audit
```

The final audit reads the exact 16 `race-LOCALE-automated-translation-v1.json` files, revalidates every bundle against the reviewed English source, rejects missing/duplicate locale bundles or any per-item quality issue, and prints source/bundle SHA-256 values plus the required 2,880 total. Retain that manifest before previewing any locale import. It is deterministic structural evidence; the independent model critique and generated-output review remain required semantic evidence.

The [2026-10-01 generation evidence](evidence/facebook-translation-generation-2026-10-01.md) records 90 actual drafts and 89 accepted independent critiques. No complete bundle exists. Native answers for some fixed canonical concepts exceed seven letters; retain the strict gate and resolve the source/content constraint before completing the corpus. The separate revision proposal is unapproved and cannot be imported as reviewed content.

## Economy and social safety

All coin grants, durable entitlements, refunds, referral settlement, and competitive results must be server-authoritative and idempotent. Meta catalog titles/prices are presentation values; the server allowlist owns product IDs, grants, and entitlement meaning. The commerce ledger accepts only a verified internal purchase/refund object, commits the grant before SDK consumption, stores purpose-scoped hashes instead of raw provider identifiers, applies refund debt before future grants, and fails against the account-deletion guard. The grant callable verifies the app-signed receipt and matches its purchase token to an authenticated V2 webhook owner before committing value. The webhook authenticates the raw request body and records refunds independently of checkout availability. See [Facebook payments](facebook-payments.md) for deployment and webhook setup. Do not grant rewarded-video coins from a browser-only `showAsync()` result unless Meta supplies a server-verifiable receipt or callback proven by a captured contract fixture.

The tournament tab offers an explicit native share only when authenticated configuration enables tournaments, the audience is 13+, the host advertises all four v8 tournament APIs, and an official current-player score exists. The adapter reads fresh server standings before each dialog. Outside a native tournament, only the SDK's explicit `TOURNAMENT_NOT_FOUND` result permits `tournament.createAsync`; creation itself opens Meta UI. Within an exactly matching locale/day/context, `tournament.shareAsync` receives only `score` and `data`, as the public v8 JavaScript SDK requires. Network and permission failures never trigger creation. All native dialogs share the existing SDK-instance guard.

The Live PvP entry now keeps a Facebook-owned Play/Tournaments destination alongside live matches. Its official recorder also resolves private live tickets and matches, requiring the human winner to have solved ten answers on the creator’s frozen deck. A public completed projection or forfeit cannot qualify. Server hint/skip penalties and the authoritative finish day determine the idempotent best; this operation awards no coins. Both seats, midnight recovery and unchanged economy are covered by real-engine emulator tests. See [Live PvP tournament follow-up](evidence/facebook-live-tournaments-2026-10-02.md). The existing live winner outbox now recovers eligible official scores without a mounted browser; board reloads restore native presentation from confirmed standings. Tournament/referral switches, retry acknowledgement, source quarantine and deletion leases remain independent and covered. See [score recovery evidence](evidence/facebook-live-score-recovery-2026-10-02.md). Meta-hosted acceptance remains outstanding.

Native scores are presentation of authoritative adjusted milliseconds with `LOWER_IS_BETTER` and `NUMERIC` formatting. The small payload contains only a versioned kind, locale, official daily ID, and UTC start/end timestamps. A confirmed official board or record projects the fresh official best into the matching native context through `postScoreAsync`, including an idempotent record or board reload. Native posts are serialized and successful scores deduplicated per exact context; provider failure cannot fail the official submission. Never use Meta standings, invitation scores or native tournament IDs to grant currency or replace official ranks. A live, exact incoming envelope opens the tournament tab only when the target exposes the authenticated capability. It forwards only the invitation locale as a screen hint, keeps the selected language, and shows existing localized incompatibility guidance for a different language. Expired/malformed hints and disabled features keep ordinary play. Entry navigation neither starts a run nor consumes retained race recovery hints. Hosted invite/open, numeric display, UTC expiry, cancellation, age/API support, and web/iOS/Android acceptance remain required. See [native tournament evidence](evidence/facebook-native-tournaments-2026-10-01.md) and [incoming-route verification](evidence/facebook-native-tournament-entry-2026-10-01.md).

Facebook referral links carry one 32-byte opaque token whose server copy is SHA-256 hashed and is rejected after seven days. New rows include a Firestore `expiresAt` timestamp at the same seven-day deadline, and the committed field policy enables TTL for `facebookReferralTokens.expiresAt`. Permanent bindings retain the exact issuance window so an already-bound invitation can retry after temporary-row deletion without rebinding or granting currency. Legacy rows require the bounded atomic backfill below. A read-only check on 2026-10-01 confirmed this TTL field policy is not deployed in `riddle-quest-ec2b2`; local configuration does not prove physical deletion. The invitee binds it only after Facebook Firebase auth/App Check and before solo play, multiplayer play, multiplayer publication, or a purchase establishes the account. A successful bind verifies both live accounts and establishes their server-owned rival relationship; the client cannot nominate either UID. Settlement recognizes a server-recorded solo or multiplayer win. Both challenger-win and creator-win race deliveries keep their existing durable outbox pending until the idempotent referral grant finishes. An owner projection marker and the creator inbox receipt prevent repeated performance or achievement writes if the grant or final acknowledgement fails. Live PvP winners now enqueue Facebook-only work in that same owner-delivery queue atomically with their ordinary win grant. The live variant validates its private ticket, match, human winner, win counter, immutable receipt binding and retention before calling the same ledger. It does not update recorded-race performance; transient grant/acknowledgement failures retain bounded retries, corrupt authority is quarantined, and operator replay revalidates the private live source. Jest and Reddit enqueue no Facebook work. See [Live PvP referral evidence](evidence/facebook-live-referrals-2026-10-02.md). On an eligible settlement, the invitee receives 100 coins, while the inviter receives 100 only for the first five conversions in that UTC day. Never accept an inviter UID, name, reward amount, win flag, or time from entry-point data.

Referral retention rollout is prepared but has not been executed against production. Deploy the updated bind/issue code before enabling TTL. The operator command defaults to a read-only page, requires an explicit project, returns only aggregate counts and an opaque continuation cursor, and never logs raw invitations or provider identities:

```sh
pnpm --dir firebase-functions facebook:referrals:retention \
  --project riddle-quest-ec2b2 --page-size 100
```

After reviewing the dry run and authorizing the data maintenance, the matching page is applied with `--apply --confirm-project riddle-quest-ec2b2`; pass each emitted `--after TOKEN_HASH` to continue. Each transaction validates the original seven-day window and all matching lifetime bindings, persists missing binding window metadata, and only then adds token expiry. Malformed state and more than 200 bindings for one token fail closed without changing that token. Investigate skipped rows rather than treating a zero-error final page as evidence for previous pages. Keep all page outcomes, verify complete coverage, and only then deploy/verify the committed TTL policy. New issuance racing this migration already writes complete metadata; no expired row is recreated.

[Firestore TTL](https://firebase.google.com/docs/firestore/ttl) is asynchronous, so the server's logical seven-day rejection remains authoritative even while an expired row awaits physical deletion. The emulator tests simulate token deletion; they do not prove the production TTL worker. See [referral retention evidence](evidence/facebook-referral-retention-2026-10-01.md) for transaction tests, dry-run guards and the read-only deployed-policy result.

Facebook commerce uses `FBInstant.payments` after its `onReady` callback. The shared catalog defines six consumables and the durable Remove Interstitial Ads product. The browser displays Meta's formatted prices and sends only the signed purchase request to `grantFacebookPurchase`. The server verifies the HMAC, app, product, purchase state and token, then requires the matching signed webhook to establish player ownership and account generation. `developerPayload` is deprecated and is never used for authorization. Purchases wait for webhook confirmation rather than trusting browser identity. Consumption happens only after the durable grant, and durable products are never consumed. Startup and resume recover unconsumed purchases through the same serialized adapter. An authoritative durable grant immediately suppresses interstitials without resetting ad frequency limits. Refund state refreshes on recovery and resume.

The local environment and checked-in template now leave `FACEBOOK_DISABLED_FEATURES` empty so Facebook payments, interstitials, and rewarded continuation can use their target-owned adapters. Deploy the changed Functions configuration before expecting the authenticated projection to report ads enabled. Payments additionally require a configured V2 webhook and `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED=1`; an empty emergency-off list alone never exposes checkout. The [1 October configuration check](evidence/facebook-config-readiness-2026-10-01.md), [1 October backend readiness review](../common/firebase-functions/evidence/provider-backend-readiness-2026-10-01.md), and [2 October check](../jest/evidence/jest-auth-readiness-2026-10-02.md) describe historical configuration, not the current deployed values. An empty emergency-off list does not schedule messages or activate Meta notification templates. Rewarded video never grants coins from its browser completion alone.

### Rewarded extra-try rollout

The [2 October rewarded-continue evidence](evidence/facebook-rewarded-continue-2026-10-02.md) records the local implementation and tests. After five wrong Classic/Daily guesses, the eligible Facebook loss modal offers a video or the existing 100-coin continue. Both share one server-controlled extra attempt; no coins are minted for watching. `grantFacebookRewardedContinue` requires Facebook authentication, App Check, and the shared deletion guard. It validates the session transaction and enforces the server switch. The enabled configuration uses `FBInstant.getRewardedVideoAsync()` with `VITE_FACEBOOK_REWARDED_PLACEMENT_ID`; interstitials use `FBInstant.getInterstitialAdAsync()` with `VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID`. Both still require the configured 13+ audience and advertised SDK API support. Deploy the changed configuration and callable with the full Functions unit, then follow the device-acceptance steps in [the shared launch checklist](facebook-launch-todo.md).

Meta's browser `showAsync()` success is not an independently verifiable ad receipt. A modified authenticated client can request this bounded extra try without watching. The enabled flow accepts that limitation for one server-controlled extra attempt. Pending claim retries reuse an in-memory ID without another watch; this observation is lost on a full reload. Do not persist it as trusted proof, and never use this callable for coin rewards. Interstitials remain limited to results, with 90 seconds between impressions, 90 seconds after rewarded video, and ten impressions per session. The durable ad-free entitlement suppresses interstitials. Jest has no ad capability.


The [2 October server notification transport](evidence/facebook-notification-transport-2026-10-02.md) prepares the documented Gaming Domain send/cancel requests without exposing a new callable or activating delivery. Default transport use requires a real fixture-backed decoder and explicit server readiness/authorization before a request. Concurrent challenge-push work also offers an explicit conservative mode that can transmit once without a decoder and keeps its response uncertain; this is not provider delivery acceptance and must not release reserved capacity. The [transactional dispatch ledger](evidence/facebook-notification-dispatch-2026-10-02.md) now stages canonical identity/generation checks, server-recorded consent and deletion gating, five-slot accounting, one-use receipts and conservative send/cancel locking. Actual current Meta consent, original server-event issuance, uncertain-outcome reconciliation and cancellation before an account sweep remain required before activation. Its receipt TTL is source-only and its slots never expire automatically. The ledger is separate from Jest notification APIs. Never automatically retry an unconfirmed send/cancel or treat HTTP 200 alone as provider acceptance. Sending’s off switch still permits authorized label-scoped cleanup once the protocol is ready.

The notification lease callables and client coordinator support an authoritative single-player or race win result. The server transaction verifies the exact Facebook identity, at least one authoritative win, permanent acceptance state, and a seven-day retry interval; the `notifications` switch is enforced at claim and acceptance, direct client access is denied, and account deletion removes the lease. The Facebook entry now composes a real v8 bot-subscription adapter only after authenticated configuration allows notifications, the age configuration is 13+, and the host advertises all three `player.canSubscribeBotAsync`, `player.isSubscribedBotAsync`, and `player.subscribeBotAsync` APIs. The adapter checks existing subscription and eligibility, opens Meta UI, and confirms subscription before reporting acceptance. Native shares, subscription prompts and ads share an SDK-instance dialog guard. The injected browser proves a wrong answer does not prompt, an authoritative win claims the server lease and opens Meta subscription UI once, and acceptance finishes before the result interstitial loads. The Facebook Live PvP result callback now also reaches that coordinator independently of tournament support. Fresh injected journeys prove no startup/loss/tie prompt and one lease/native subscription after the first live win, with tournaments both enabled and disabled. See [Live PvP consent evidence](evidence/facebook-live-consent-2026-10-02.md). This is local contract evidence; hosted web/iOS/Android permission behavior remains unverified. The SDK adapter reports individual scheduling and cancellation as unavailable. The live dashboard has no notification templates; it offers native event-based reminders after last play. D1/D3/D7 draft copy for all 16 locales is prepared for owner review, without saving or activating player messages. Race-specific delivery, replacements, opt-out, and deep-link acceptance remain outstanding.

Facebook names and photos may appear only through the v8 `overlayViews.createProfilePictureOverlayViewAsync` and `overlayViews.createProfileNameOverlayViewAsync` provider surfaces. The game exposes them only for verified 13+ configuration after the authenticated configuration read succeeds, mounts them only in Activity and Tournaments, verifies they represent the authenticated current platform player, and dismisses them when leaving the social surface, removing the game-owned container and using an optional destruction hook only when supplied by the runtime. Game code never calls `getName`/`getPhoto` and never receives the rendered values. The source audit `pnpm check:facebook-profile-boundary` enforces this boundary. Do not copy Meta identity into Firebase, logs, analytics, reports, or game-owned profiles. Presence is opt-in and limited to server-established rivals. Blocks must immediately revoke interaction and presence visibility; categorized reports go to a server-only, rate-limited moderation queue. Chat and an admin panel are out of scope.

The queue's exact intake, least-privilege triage, deletion, unresolved retention, and current lack of an adjudication/sanction workflow are documented in the [Facebook social moderation runbook](facebook-moderation-runbook.md). Do not mutate report status or player state manually until that workflow has owner/counsel approval and an auditable implementation.

Live PvP now exposes translated block/report controls for a retained human opponent through the authenticated Facebook and Reddit adapters. The client submits only its own opaque live ticket; the existing server endpoints resolve both private seats, same-provider match/pool/run bindings, account existence and deletion guards inside the mutation transaction. Bots, foreign, expired, cancelled and deleted seats cannot become report targets. Legacy linked-rival requests remain compatible, and the default Jest adapter does not opt into the new controls. Successful blocking synchronously revokes bilateral presence visibility and masks the opponent locally; the existing live engine ends an unfinished blocked pair as a tie without a reward and excludes future pairing. Reports retain the five fixed categories, no narrative, stable retry identity and five-per-UTC-day cap, with a hashed live-ticket binding preventing request-ID reuse for another match. Reddit uses its existing same-origin signed safety routes and the shared account-operation lease. The current Activity destination exposes context standings and read-only recent Live PvP results through the opted-in Facebook adapter. The private history reader honors locale, retention, account deletion and bilateral blocks; confirmed blocking immediately retires visible rows. Live rematches now reserve the original authoritative human through an opt-in authenticated adapter, with explicit inbox acceptance, stable retries, bilateral blocks and real account-deletion cleanup. The 3 October rematch follow-up passes 64 emulator cases, both provider browsers, six selected Jest regressions and all six isolated builds/audits; hosted acceptance remains pending. See [rematch evidence](../common/hosted/evidence/live-race-rematches-2026-10-03.md). See [history evidence](../common/hosted/evidence/live-race-history-2026-10-02.md). See [live safety evidence](../common/hosted/evidence/live-race-safety-2026-10-02.md). These local browser/emulator checks do not establish hosted role-account acceptance.

Each opted-in browser tab/device owns one RTDB `presenceConnections/{uid}/{sessionId}` record, arms `onDisconnect` deletion before publishing, and reports only `online`, `playing`, or `racing`. The server aggregates the highest active state and maintains a separate `presenceOptIn` bit. Rival reads require both a server-written `presenceVisibility/{viewer}/{target}` edge and the target's live opt-in bit; clients cannot write visibility, read its reverse index, or enumerate strangers. A known-rival Firestore trigger creates the edge. A successful block now waits for both visibility directions to be removed, with the Firestore trigger repeating that revocation as reconciliation; deletion uses `presenceViewers` as a server-only reverse index to remove incoming and outgoing edges. When the last connection disappears, aggregation persists an unreadable `offline` status and `presenceOptIn: false`; account deletion removes those records.

FBInstant context IDs are validated in the browser boundary and stored only as domain-separated SHA-256 keys. Both players must independently authenticate and join the same context before the server writes bilateral known-rival relationships. Context membership is locale-bound, capped at 50, logically expires after seven days, and elects the earliest active join (then UID) as host. A context switch joins the new board before leaving the old one so retries converge without a membership gap. Completed authoritative runs create per-member best-time entries; clients receive only rank, adjusted milliseconds, and a current-player bit. On rollover, all prior entry documents are deleted before a fresh board is written, and only identity-free board metadata is archived for 30 days. The committed TTL covers `entries`; parent TTL remains deliberately absent because it cannot cascade score deletion. The manual retention helper prepares bounded cleanup of up to 20 expired parents and 50 entries per parent, deleting each parent and its complete score set in one transaction. It revalidates the board after selection so a concurrent rollover survives. History contains no member/run IDs, retains the original expiry-plus-30-day deadline, and is not recreated after that deadline. The scheduler was absent from a read-only deployed-Functions check on 2026-10-01: no automatic physical cleanup is claimed until deployment and hosted acceptance. Account deletion removes the UID and score entry from every indexed board, re-elects the host, and deletes every remaining entry before deleting an empty board.

A read-only operator preview uses the same context cleanup authority and the current server clock:

```sh
pnpm --dir firebase-functions facebook:contexts:retention \
  --project riddle-quest-ec2b2 --limit 20
```

Writes require a separately reviewed maintenance action with `--apply --confirm-project riddle-quest-ec2b2`. The command does not accept a caller-supplied future clock. Review one bounded page at a time and repeat until a fresh scan is empty; a dry-run `complete` means page coverage only, not deletion. Invalid records or excessive entry fan-out remain unchanged and produce incomplete aggregate evidence. The scheduler reports the same failure without private provider diagnostics. A persistent invalid page needs operator investigation; do not silently widen the write budget. Cleanup never changes known rivals, accounts, balances, settlements or another provider's records. Retain the reviewed server deployment revision and exercise expiration, fresh rejoin and account deletion in the hosted test app. See [context retention evidence](evidence/facebook-context-retention-2026-10-01.md).

## Release and incident rules

Selected-context private Live PvP is prepared in the [3 October context challenge evidence](evidence/facebook-context-challenges-2026-10-03.md). `platforms/web/facebook/fbapp-config.json` declares the `race_context_challenge` custom-update template and the Facebook mode selects it. On an advertised callable `updateAsync` host, an explicit native choice starts the existing private lobby in the selected category; another explicit click sends its opaque handle to that same native context with `NO_PUSH`. Native context changes, language retirement and account deletion cannot retarget that invitation. The template is registered through a testing bundle upload, rather than the dashboard's scheduled User Notifications editor. The current dashboard still shows version 6 as Testing; this source manifest and SDK integration have not been uploaded or accepted. The shared dirty checkout has no eligible canonical handoff. Keep actual two-role delivery/acceptance and device coverage open after a clean reviewed candidate is prepared.

- Keep Meta Business verification and Approved Partner approval deferred as requested. An audited non-production role-account test draft may be uploaded to gather P0 hosted evidence, but do not promote, expose public traffic, or call the project complete without the approvals.
- The target build first rebuilds and audits the Facebook artifact. The draft preparer then runs the server-only Meta secret-boundary audit, reruns the artifact audit, creates the root-content ZIP, and records its SHA-256 and source commit. Upload only those exact bytes as a non-production test draft after the local/backend gates required for that test pass.
- A human promotes the unchanged verified bytes. There is no geographic soft launch.
- If an upload result is ambiguous, retain its hash-scoped retry barrier and reconcile the dashboard state before transmitting again. Preparation and draft commands share an exclusive local lock across every hash in the receipt directory. Preparation/begin scan all retained attempts and refuse transmitting, ambiguous, malformed or interrupted handoffs; reconcile the existing attempt before another artifact.
- During an incident, disable only the affected Facebook feature, preserve Jest/core play where safe, record timestamps/revisions/hashes, and retain sanitized evidence for review.

The dashboard handoff preserves the exact gated bytes. From a clean reviewed commit, use the canonical command below. It runs the existing preflight and then opens one hash-scoped handoff; it never contacts Meta. The build performs its normal artifact audit first, then the Facebook browser suite plays the game end to end and must pass before any ZIP is prepared; the preparer then runs the source secret-boundary audit, reruns the artifact audit, and creates the ZIP. Run tests and browser harnesses only when explicitly requested. `begin` copies the verified bytes once to an owner-private, read-only, hash-named snapshot under `.facebook-upload-receipts`; upload only that printed snapshot path:

```sh
pnpm release:facebook
```

The package-level `preflight:facebook-upload` and `facebook:draft begin` commands remain the target-native implementation and may be run separately for diagnosis. A preflight alone creates only the rebuildable ZIP and is not a release handoff.

### Remote draft upload authorization

The Meta Social Technologies MCP connection currently grants `read` access to Riddle Quest. Its Read and Manage scopes govern developer tools such as configuration inspection and webhook management. Neither scope supplies a game-bundle upload tool. Increasing that connection's permissions does not establish upload authorization. See [Meta's MCP scope reference](https://developers.facebook.com/documentation/mcp/devtools-mcp).

Meta documents a separate [Graph API bundle upload flow](https://developers.facebook.com/documentation/games/launch/upload-bundle). In app `1748953042991569`, open **Instant Games → Web Hosting → Get Asset Upload Access Token**. Obtain a user upload token through the app's admin or developer account. Keep the credential in a private local prompt or secret store. Do not put it in chat, command arguments, source, receipts or logs. The upload token is separate from the MCP consent grant and the server's app secret.

After an explicit upload request, use `upload` instead of `begin` for a clean, reviewed and gated `main` candidate. Supply its exact hash from `.facebook-upload-receipts/gated-artifact.json`:

```sh
read -r -s -p "Meta asset upload token: " facebook_asset_upload_token
printf '\n'
printf '%s' "$facebook_asset_upload_token" | pnpm facebook:draft upload --archive-hash EXACT_64_HEX_SHA256
unset facebook_asset_upload_token
```

This command verifies the clean source and archive, creates the immutable handoff and retry barrier, then transmits those exact bytes. It uses Graph API v24.0 for the upload session and selects `gg_graph_api` for `GG` tokens or `fb_game_bundle` for `EAA` tokens. Requests have bounded timeouts and no automatic retries. It records only response hashes, HTTP status and validated bundle metadata in the private `remote-upload-SHA.json` receipt.

A successful HTTP upload establishes submission, not completed processing or acceptance. The barrier remains `ambiguous` until Meta Web Hosting provides exact-artifact evidence and the existing `accept` command records it. A timeout, failed response or interrupted command also requires reconciliation before another transmission. Do not run `begin` before the remote command or reuse a handoff already opened for dashboard upload. Remote upload does not assign a Testing version, promote a bundle, publish the game or submit a review.

The local syntax checks for this transport do not establish credential validity or remote acceptance. A live upload still requires the separately granted upload token and an explicit upload request.

The preparer refuses to replace the rebuildable ZIP while any retained handoff is unresolved. Every outcome command requires `--archive-hash` and re-verifies that exact read-only snapshot and matching barrier, independently of current `HEAD`, the latest ZIP or the singleton gate receipt. If `begin` is interrupted after writing `artifact-SHA.zip` but before writing `upload-SHA.json`, `recover --archive-hash EXACT_64_HEX_SHA256` verifies the retained bytes and creates an ambiguous barrier without replacing the archive or authorizing transmission. Reconcile Meta before acceptance; recovery never prints a new upload instruction. A crashed process can leave `release.lock` or a per-hash transition lock. Inspect the process and retained evidence before manually clearing a confirmed stale lock; no command automatically steals it.

If the outcome is unknown, do not begin again or retransmit. Reconcile the existing draft in Meta first. After Meta shows the non-production draft, save a redacted dashboard capture outside the repository and bind its bytes plus the draft ID to the accepted ZIP:

```sh
pnpm facebook:draft ambiguous \
  --archive-hash EXACT_64_HEX_SHA256 \
  --reason "dashboard result unknown after transmission"
```

This transition is exclusive for that hash and retained; concurrent or repeated transitions of its barrier fail closed. After reconciling the existing artifact in Meta, bind its redacted evidence plus draft ID to the accepted ZIP:

```sh
pnpm facebook:draft accept \
  --archive-hash EXACT_64_HEX_SHA256 \
  --draft-id META_DRAFT_ID \
  --evidence /absolute/path/to/redacted-draft-evidence
```

After every gate and review passes, a human promotes that existing draft without uploading new bytes. Obtain or independently download and hash the production artifact; the following command refuses any hash different from the accepted draft and writes an owner-private promotion receipt:

```sh
pnpm facebook:draft promote \
  --archive-hash EXACT_64_HEX_SHA256 \
  --production-hash EXACT_64_HEX_SHA256 \
  --evidence /absolute/path/to/redacted-promotion-evidence
```

The evidence paths must be absolute, evidence files remain outside source control, and receipts remain under the ignored owner-private `.facebook-upload-receipts` directory. Commands hold the shared receipt-directory lock; barrier transitions also retain their exclusive per-hash lock. Promotion writes an exclusive `promotion-SHA.json` for those exact bytes, preserving earlier receipts and permitting later accepted releases. A mistaken receipt requires manual investigation rather than overwriting history. See [handoff verification evidence](evidence/facebook-handoff-safety-2026-10-01.md). These commands verify local consistency only; their existence is not evidence that Meta accepted or promoted anything.

The [2026-10-01 SDK follow-up evidence](evidence/facebook-sdk-followup-2026-10-01.md) records the Facebook MCP registration/authentication blocker, verified Audience Network placement IDs, bot-subscription integration, current Meta setup gaps, and isolated platform regression results.

The [Meta Social Technologies MCP follow-up](../common/web-game/evidence/meta-social-technologies-mcp-2026-10-01.md) registers the official `/devtools` endpoint as `facebook_devtools`, restricted to eight read tools. The owner completed authentication; the 2 October app inventory confirms read-only access to Riddle Quest and the tools are callable. The [authenticated readiness evidence](evidence/meta-facebook-readiness-2026-10-02.md) records app configuration, review/compliance observations and webhook state. The dashboard shows an unsubmitted Zero Permission draft; conflicting MCP approval/submission fields are not treated as acceptance. This connector does not replace FBInstant or prove an upload/commerce contract.

## Native invitation testing

Context selection and native matchmaking now share the SDK-instance dialog guard
with ads, bot subscription, referral shares and tournament shares. While one
provider operation is open, competing calls return unavailable without opening
another SDK UI. Successful, cancelled and failed native operations release the
guard. The [context dialog check](evidence/facebook-context-dialog-2026-10-01.md)
records the reproduced overlap, current injected-browser regressions and updated
local review ZIP. A provider promise that has not settled still owns its dialog;
there is no timeout that silently authorizes another UI over an unresolved one.
Retain actual Meta-hosted web/iOS/Android dialog and lifecycle evidence before review.

Facebook profile invitations, solo result shares, and published race challenges use `FBInstant.shareAsync` with a locally rendered PNG and `switchContext: false`. The entry payload contains an opaque server-issued referral token plus at most a bounded game mode or challenge ID. It contains no provider/Firebase identity, answers, claimed reward, or competitive score. SDK success never grants currency. Incoming challenge references route to the existing server-authorized race entry. The adapter closes on unmount/account deletion, prevents overlapping provider dialogs, treats Meta dismissal as cancellation, and rechecks token expiry before opening the dialog.

Facebook uses translated plain invitation labels in all 16 locales; it does not promise coins merely for sharing or registering. Jest retains its own SDK sharing, attribution, screenshots, reminders, and existing copy. The shared PNG card renderer moved to the provider-neutral play module with a Jest re-export preserving its existing interface. See [native sharing and referral evidence](evidence/facebook-native-sharing-2026-10-01.md) for exact local validation and remaining hosted acceptance.


## Live account-deletion verification

The [2 October live-data cleanup evidence](../common/hosted/evidence/live-race-deletion-2026-10-02.md)
covers real server matchmaking, deletion and surviving-player economy/referrals.
The guard and lease drain precede the live-data sweep. Searching tickets, active
pointers, queue references, copied match identity/progress, invitations, challenge
push metadata and game-owned board entries are covered. Unfinished matches close
without a new grant; already committed surviving results remain intact. An
anonymous cancelled creator deck preserves independent Facebook score validation.

Ship the live participant index, cleanup, native score validator and Firestore
TTL/collection-group policies together. Historical unindexed records are paged;
missing root expiries are restored from their original source deadline or accepted
start, without extending retention from deletion time. Verify deployed indexes,
TTL readiness and an actual deletion retry in the reviewed backend release.
The emulator does not prove provider-side erasure or message/score retraction.


The [Reddit live tournament regression evidence](../reddit/evidence/reddit-live-tournaments-2026-10-02.md)
extracts shared board presentation and private frozen-source validation while
keeping each target capability and native SDK boundary intact. Facebook native
create/share/entry/score/reload browser checks, official delivery/referral/deletion
cases and all six isolated artifact audits pass. A fresh Meta MCP read confirms
Riddle Quest in development mode with caller permission `read`; no provider
configuration write or hosted acceptance is implied by these local checks.


The [notification byte-binding follow-up](evidence/facebook-notification-byte-binding-2026-10-02.md)
compares the transport’s exact serialized-body digest with the original server
work before private ledger admission. Modified targeting, copy, payload, label
or scheduled delay sends nothing and reserves no capacity; unchanged work retains
its one-use and conservative uncertain-response behavior. The live push emulator
suite is now registered. No notification rollout switch or response contract is
activated by these 34 emulator, 48 Functions and 169 platform cases; both provider
browsers and all six target audits pass. Current external consent, D1/D3/D7 work,
unknown-outcome reconciliation and deletion-time cancellation remain required.

The [2 October live-context follow-up](evidence/facebook-live-contexts-2026-10-02.md)
restores Activity standings, native context selection and social overlays after the
Live PvP migration. Eligible live wins record through the existing context adapter
independently of tournaments, with private match/deck authority and no extra grant.
The [3 October durable-context follow-up](evidence/facebook-live-context-delivery-2026-10-03.md)
binds new seats to the synchronized FBInstant context before joining and recovers
eligible ten-solve scores through the existing worker after the browser closes.
Private board/member epochs prevent retries, native context switches, rollover or
rejoining from moving a retained score. Legacy unbound seats keep the optional
browser submission. All 105 emulator cases, both injected provider journeys, six
selected Jest browser regressions and all six isolated builds/audits pass.
This does not bind the global queue to a selected friend. Hosted/device acceptance
and deployed-source equivalence remain required. The authenticated read-only Meta
review check still reports `UNSUBMITTED`, with no submission/completion timestamps.

The [3 October context-capability check](evidence/facebook-context-capabilities-2026-10-03.md)
also removes an unnecessary dependency on native matchmaking: an advertised,
callable `context.chooseAsync` keeps the existing chooser and context boards
available when `matchPlayerAsync` is absent or unadvertised. Native matching
checks its own exact advertisement and callable implementation before use.
Audience, authenticated rollout and dialog exclusion remain enforced. Fresh
chooser-only/full-SDK Facebook journeys, Reddit and six selected Jest browser
regressions pass alongside all six isolated builds/audits; hosted API acceptance
remains required.

For the shared presence mirror rollout, use the [presence permission reconciliation runbook](../common/hosted/presence-visibility-reconciliation.md) after the matching backend/rules are staged and older writers have drained. Its local verification does not establish hosted inventory coverage or acceptance.

The [3 October native context-event check](evidence/facebook-context-events-2026-10-03.md)
observes `FBInstant.onContextChange` for the authenticated session, including
changes made through Meta overlays while Activity is unmounted. Mounted boards
retire late reads immediately, and returning to solo removes the previous social
membership. The [solo-state follow-up](evidence/facebook-solo-context-2026-10-03.md)
treats that normal absence as no optional board/score destination, preserving the
server-error retry path without showing a false transport error during solo play.

A fresh authenticated Meta MCP review read on 3 October still reports
`UNSUBMITTED` without submission/completion timestamps. Requirements nevertheless
say a prior submission is in review, and privileges list Instant Games Zero
Permission Access as rejected with no live access or reason. These conflicting
responses require provider/dashboard resolution; the aggregate `is_approved`
flag does not establish Zero Permission Access or Instant Games release approval.
No review submission or provider setting was changed by these checks.
