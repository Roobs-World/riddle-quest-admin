# Facebook Instant Games operations

Last updated: 2026-08-22

This runbook describes the Facebook web target currently present in source. It is not release approval. The authoritative acceptance status is
[`facebook-instant-games-progress.html`](facebook-instant-games-progress.html). An exact-hash, non-production role-account test draft is permitted only after the local artifact/backend preflight so P0 Meta-hosted evidence can be collected. Business/Partner approval, production promotion, public traffic, and a claim of release readiness remain forbidden until their required gates pass.

## Build and inspect

```sh
pnpm --filter @qwordly/portal build:facebook
pnpm --filter @qwordly/portal audit:facebook-artifact
```

The build writes `packages/portal/dist-facebook`. It must load only `fbinstant.8.0.js`, contain root `fbapp-config.json`, remain below 5 MiB of critical initial resources and 200 MiB total, contain no source maps or private credentials, and pass the reciprocal Jest-leakage audit. The Jest build remains independently available through `build:jest`; never combine both SDKs in one artifact.

## Server configuration

Run the interactive setup/evidence guide from the repository root when the real Meta app is available:

```sh
pnpm --filter @qwordly/portal facebook:setup
```

The wizard stores the Meta app ID, origins, and deletion-status URL under the ignored, owner-local `.facebook-setup-receipts` directory. It deliberately never accepts secret values, does not collect `FACEBOOK_FIREBASE_APP_ID`, does not write the Functions deployment environment, and never changes tracker statuses. Treat `setup.env` as evidence input only: obtain the canonical Firebase web app ID separately, review all four non-secret values, and deliberately copy them into `firebase-functions/.env.riddle-quest-ec2b2` before backend preflight. Meta approvals remain deferred until the production gate, as requested.

Private values belong in Firebase/Google Secret Manager and CI secret bindings, never `VITE_*`, source files, logs, fixtures, ZIPs, or Meta configuration exports:

- `FACEBOOK_APP_SECRET`: newly issued Meta app secret used to verify signed player and deletion assertions.
- `FACEBOOK_UID_SECRET`: independent fixed HMAC key for generation-separated `facebook_<40 hex>` Firebase UIDs. Current source has no key version, previous-key fallback, or migration; never rotate it in place for an app with existing provider records. If it is exposed, disable Facebook identity until a reviewed dual-key/migration release has moved identity and deletion safely; see the credential-rotation runbook.

Non-secret deployment configuration includes `FACEBOOK_APP_ID`, `FACEBOOK_FIREBASE_APP_ID`, exact comma-separated `FACEBOOK_GAME_ORIGINS`, and the HTTPS `FACEBOOK_DELETION_STATUS_BASE_URL`. The app secret also domain-separates opaque deletion confirmation codes. Historical Facebook values documented in repository history are compromised and must not be reused.

### Firebase backend deployment

All new and changed Functions must be deployed before the Facebook artifact is uploaded. Run `pnpm preflight:facebook-backend` from the repository root first. It validates the Jest and Facebook deployment environments, server-only secret bindings, a 21-entry Facebook-specific/supporting callable/trigger export subset, types, lint, the complete Functions suite, and the deploy build. The subset audit fails for any omitted or duplicate listed entry, but it is not a complete dependency inventory: Facebook also uses shared gameplay/race/account callables such as `deleteAccount`. The full deploy command intentionally includes every exported Function and all dependent rules so those shared paths cannot be selectively omitted. The preflight deliberately fails until the four non-secret Facebook values above are present in `firebase-functions/.env.riddle-quest-ec2b2`; it never accepts a Page name in place of the numeric Meta App ID. Secrets remain in Secret Manager and must not be added to that file.

After reviewing the target project and successful preflight output, the authorized operator runs `pnpm --dir firebase-functions deploy:facebook-backend`. This command targets `riddle-quest-ec2b2` explicitly and deploys all exported Functions together with Firestore rules/indexes, Realtime Database rules, and Storage rules. Deploying only selected new callable names is insufficient because shared gameplay, deletion, identity, presence, social, and rules boundaries changed together. Retain the Firebase release output and deployed revision identifiers as tracker evidence; source tests are not proof of deployment.

`FACEBOOK_DISABLED_FEATURES` is a comma-separated emergency-off list. Accepted names are `identity`, `commerce`, `rewarded_ads`, `interstitials`, `referrals`, `notifications`, `matchmaking`, `tournaments`, and `presence`. Unknown names fail deployment closed. Identity is enforced before nonce issue and exchange. Every switch is projected by the authenticated client-configuration callable; implemented server mutations additionally enforce their relevant switch. The Facebook entry composes referrals, contexts/boards, tournaments, interstitials, and presence only when their independent startup projection is enabled. Notifications and rewarded ads remain staged and expose no platform capability. Interstitials are startup-projected and client-only: an already-running tab does not poll a changed switch before another SDK request, so an incident response must also terminate/reload active Facebook sessions and verify the restarted projection. A configuration read failure hides every optional feature while core play continues. Authenticated Facebook configuration and consent requests mirror the deployed presence value to the server-only `featureGates/facebookPresence` RTDB node. Rules fail Facebook presence closed while that node is missing or false, revoke existing listeners, and deny new Facebook connection writes without affecting Jest.

### Emergency switch procedure

1. Record the incident ID, UTC time, deployed revision, and affected provider capability. Preserve sanitized evidence; never paste assertions, secrets, raw player IDs, receipts, or notification tokens into the incident record.
2. Read the current deployed `FACEBOOK_DISABLED_FEATURES` value. Add only the exact affected name, retain every existing disabled name, and deploy Functions configuration through the normal audited environment workflow. Do not change a `VITE_*` value or rebuild Jest for an emergency server switch.
3. Verify an authenticated Facebook configuration response reports only that capability disabled. This request also synchronizes the RTDB presence rules gate before reading optional commerce state. For `identity`, verify nonce issue and exchange return the expected unavailable response instead. Verify an unrelated Facebook capability and Jest core play still work.
4. For presence, confirm an already-open Facebook status listener is revoked, a new Facebook connection write is denied, opt-out cleanup remains available, and equivalent Jest reads/writes still succeed; stale records may remain server-only until ordinary disconnect cleanup. For commerce/referrals, confirm no new implemented grant boundary can execute. Confirm rewarded ads and notifications remain unexposed. For interstitials, close/reload active sessions and verify the restarted client sees the disabled projection because no per-impression server check exists. For matchmaking/tournaments, confirm writes fail server-side as well as disappearing from the client.
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

Before an in-game Facebook deletion, the shell rotates the local `riddleQuest:facebookAccountDeletionEpoch:v1` value so other current-build tabs reject new gated host/storage work. Those gated operations hold a shared `riddleQuest:facebookPlayerOperations:v1` Web Lock; deletion waits for its exclusive lock and stops presence. Direct context/tournament capability calls do not hold that browser lock, but authenticated server callables use deletion-guarded operation leases, and deletion fails retryably while any such lease remains. A secure runtime without Web Locks fails the destructive request before server mutation. After authoritative success, the shell writes `null` to its two exact FBInstant data keys and flushes. A later reload treats the rotated epoch as its new baseline, allowing the explicit generation-based fresh start. Real Meta webview support and mixed-version/cross-device provider propagation remain P0 acceptance evidence.

## CSP and Meta-hosted acceptance

The root Firebase Hosting CSP is the Jest policy and is not evidence for the Meta-hosted artifact. Capture the effective Meta response headers and every required host from a real role-account session before defining the Facebook CSP allowlist. Prove Firebase Functions, Firestore/App Check, SDK script, overlays, ads, purchases, notifications, contexts, tournaments, web, iOS, and Android without a wildcard expansion. Record lifecycle evidence narrowly: SDK `onPause` currently flushes storage and stops presence, while browser visibility returning to visible restarts eligible presence; independently verify host suspension, gameplay/input, and audio behavior rather than treating the adapter as coverage. Record sanitized network logs and screenshots against the exact ZIP hash.

## Machine translation corpus

Keep `OPENAI_API_KEY` outside the repository and use distinct translator and critic models. Generation is resumable and owner-private; it does not make content eligible by itself:

```sh
pnpm --dir firebase-functions race:translations:generate -- \
  --translator-model TRANSLATOR_MODEL --critic-model DISTINCT_CRITIC_MODEL
pnpm --dir firebase-functions race:translations:audit
```

The final audit reads the exact 16 `race-LOCALE-automated-translation-v1.json` files, revalidates every bundle against the reviewed English source, rejects missing/duplicate locale bundles or any per-item quality issue, and prints source/bundle SHA-256 values plus the required 2,880 total. Retain that manifest before previewing any locale import. It is deterministic structural evidence; the independent model critique and generated-output review remain required semantic evidence.

## Economy and social safety

All coin grants, durable entitlements, refunds, referral settlement, and competitive results must be server-authoritative and idempotent. Meta catalog titles/prices are presentation values; the server allowlist owns product IDs, grants, and entitlement meaning. The commerce ledger accepts only a verified internal purchase/refund object, commits the grant before SDK consumption, stores purpose-scoped hashes instead of raw provider identifiers, applies refund debt before future grants, and fails against the account-deletion guard. It intentionally has no public grant/webhook endpoint until sanitized Meta v8 fixtures prove the purchase and raw-signature verification contract. Do not grant rewarded-video coins from a browser-only `showAsync()` result unless Meta supplies a server-verifiable receipt or callback proven by a captured contract fixture.

Facebook referral links carry one 32-byte opaque token whose server copy is SHA-256 hashed and is rejected after seven days. The current row has no physical TTL and remains until deletion or a future purge. The invitee binds it only after Facebook Firebase auth/App Check and before a single-player game or purchase establishes the account. A successful bind verifies both live accounts and establishes their server-owned rival relationship; the client cannot nominate either UID. Current establishment checks omit multiplayer counters, and settlement is invoked only by an authoritative single-player win—not a race win. That gap must be resolved before describing the contract as “before any game” or “first win” generally. On an eligible single-player settlement, the invitee receives 100 coins, while the inviter receives 100 only for the first five conversions in that UTC day. Never accept an inviter UID, name, reward amount, win flag, or time from entry-point data.

Facebook commerce is staged behind the provider-verifier boundary. The immutable catalog contract is owned by Core and consumed by both the browser adapter and authoritative Functions ledger; its six consumables are derived from the canonical game pricing catalog, with the Facebook-only durable product added once. The client requires all seven product IDs exactly once, rejects partial, unknown, subscription-like, extra-field, and duplicate catalogs, and verifies each USD `priceAmount` against the shared base price. Non-USD Meta-localized price text and amounts remain presentation values. Purchase and recovery accept at most 100 exact, unconsumed `charge` records, reject extra fields and duplicate payment IDs/tokens, and send only each provider `signedRequest` to the authoritative grant dependency. The server response—not the browser product record—decides whether the purchase token is consumable, so the durable ad-free product is never consumed as a coin pack. A consumption interruption leaves the purchase recoverable; the next attempt passes through the idempotent server ledger again before consumption. One shared client barrier serializes purchase and recovery so they cannot race a provider token; a second concurrent purchase is rejected before opening another provider dialog, while simultaneous lifecycle recovery triggers share one read/grant/consume sequence. Do not expose this coordinator or a commerce capability until a sanitized v8 signed-request fixture proves the decoded claims and a raw refund/webhook fixture proves its signature contract.

The notification lease callables and client coordinator are staged for an authoritative single-player or race win result. The server transaction verifies the exact Facebook identity, at least one authoritative win, permanent acceptance state, and a seven-day retry interval; the `notifications` switch is enforced at claim and acceptance, direct client access is denied, and account deletion removes the lease. However, the Facebook bootstrap deliberately exposes no notification capability, so the coordinator is not constructed and no platform permission UI can open. Do not describe prompting as active until a sanitized Meta contract implements the adapter and hosted web/iOS/Android tests pass.

Facebook names and photos may appear only through the v8 `overlayViews.createProfilePictureOverlayViewAsync` and `overlayViews.createProfileNameOverlayViewAsync` provider surfaces. The game exposes them only for verified 13+ configuration after the authenticated configuration read succeeds, mounts them only in Activity and Tournaments, verifies they represent the authenticated current platform player, and destroys them when leaving the social surface. Game code never calls `getName`/`getPhoto` and never receives the rendered values. The source audit `pnpm check:facebook-profile-boundary` enforces this boundary. Do not copy Meta identity into Firebase, logs, analytics, reports, or game-owned profiles. Presence is opt-in and limited to server-established rivals. Blocks must immediately revoke interaction and presence visibility; categorized reports go to a server-only, rate-limited moderation queue. Chat and an admin panel are out of scope.

The queue's exact intake, least-privilege triage, deletion, unresolved retention, and current lack of an adjudication/sanction workflow are documented in the [Facebook social moderation runbook](facebook-moderation-runbook.md). Do not mutate report status or player state manually until that workflow has owner/counsel approval and an auditable implementation.

The Activity surface exposes safety controls only when its server projection includes a provider-neutral linked-rival Firebase UID. A successful block immediately removes that rival from the client list; subsequent race mutations and presence reads are independently denied by server rules. Reports accept one of five fixed categories, never narrative text, and use the bridge request ID for idempotency. Deleted/unlinked rivals are projected without a safety target.

Each opted-in browser tab/device owns one RTDB `presenceConnections/{uid}/{sessionId}` record, arms `onDisconnect` deletion before publishing, and reports only `online`, `playing`, or `racing`. The server aggregates the highest active state and maintains a separate `presenceOptIn` bit. Rival reads require both a server-written `presenceVisibility/{viewer}/{target}` edge and the target's live opt-in bit; clients cannot write visibility, read its reverse index, or enumerate strangers. A known-rival Firestore trigger creates the edge. A successful block now waits for both visibility directions to be removed, with the Firestore trigger repeating that revocation as reconciliation; deletion uses `presenceViewers` as a server-only reverse index to remove incoming and outgoing edges. When the last connection disappears, aggregation persists an unreadable `offline` status and `presenceOptIn: false`; account deletion removes those records.

FBInstant context IDs are validated in the browser boundary and stored only as domain-separated SHA-256 keys. Both players must independently authenticate and join the same context before the server writes bilateral known-rival relationships. Context membership is locale-bound, capped at 50, logically expires after seven days, and elects the earliest active join (then UID) as host. A context switch joins the new board before leaving the old one so retries converge without a membership gap. Completed authoritative runs create per-member best-time entries; clients receive only rank, adjusted milliseconds, and a current-player bit. On rollover, all prior entry documents are deleted before a fresh board is written, and only identity-free board metadata is archived for 30 days. The committed TTL covers `entries` but not the `facebookContextCompetitions` parent, so an abandoned expired parent can remain at rest until rollover, deletion, or a future parent TTL/purge. Account deletion removes the UID and score entry from every indexed board, re-elects the host, and deletes every remaining entry before deleting an empty board.

## Release and incident rules

- Keep Meta Business verification and Approved Partner approval deferred as requested. An audited non-production role-account test draft may be uploaded to gather P0 hosted evidence, but do not promote, expose public traffic, or call the project complete without the approvals.
- The target build first rebuilds and audits the Facebook artifact. The draft preparer then runs the server-only Meta secret-boundary audit, reruns the artifact audit, creates the root-content ZIP, and records its SHA-256 and source commit. Upload only those exact bytes as a non-production test draft after the local/backend gates required for that test pass.
- A human promotes the unchanged verified bytes. There is no geographic soft launch.
- If an upload result is ambiguous, retain its hash-scoped retry barrier and reconcile the dashboard state before transmitting again. The code does not globally lock different hashes; operators must inspect all prior barriers and must not begin another hash while any attempt is transmitting or ambiguous.
- During an incident, disable only the affected Facebook feature, preserve Jest/core play where safe, record timestamps/revisions/hashes, and retain sanitized evidence for review.

The exact-byte handoff is deliberately human-controlled because no verified Meta upload transport contract is committed. From a clean reviewed commit, use the canonical command below. It runs the existing preflight and then opens one hash-scoped handoff; it never contacts Meta. The build performs its normal artifact audit first; the preparer then runs the source secret-boundary audit, reruns the artifact audit, and creates the ZIP. `begin` copies the verified bytes once to an owner-private, read-only, hash-named snapshot under `.facebook-upload-receipts`; upload only that printed snapshot path:

```sh
pnpm release:facebook
```

The package-level `preflight:facebook-upload` and `facebook:draft begin` commands remain the target-native implementation and may be run separately for diagnosis. A preflight alone creates only the rebuildable ZIP and is not a release handoff.

Do not rerun preflight, change `HEAD`, or begin a different hash until the active handoff has been accepted and, when applicable, promoted. Outcome commands currently resolve the singleton `gated-artifact.json` and `build-facebook.zip`; a later preflight preserves the old immutable snapshot but prevents those commands from selecting its barrier. If `begin` is interrupted after writing `artifact-SHA.zip` but before writing `upload-SHA.json`, stop and inspect the receipt directory—rerunning fails closed on the existing archive. Do not upload unless the read-only archive and matching transmitting barrier both exist and have been independently reconciled.

If the outcome is unknown, do not begin again or retransmit. Reconcile the existing draft in Meta first. After Meta shows the non-production draft, save a redacted dashboard capture outside the repository and bind its bytes plus the draft ID to the accepted ZIP:

```sh
pnpm --dir packages/portal facebook:draft ambiguous \
  --reason "dashboard result unknown after transmission"
```

This transition is exclusive for that hash and retained; concurrent or repeated transitions of its barrier fail closed. After reconciling the existing artifact in Meta, bind its redacted evidence plus draft ID to the accepted ZIP:

```sh
pnpm --dir packages/portal facebook:draft accept \
  --draft-id META_DRAFT_ID \
  --evidence /absolute/path/to/redacted-draft-evidence
```

After every gate and review passes, a human promotes that existing draft without uploading new bytes. Obtain or independently download and hash the production artifact; the following command refuses any hash different from the accepted draft and writes an owner-private promotion receipt:

```sh
pnpm --dir packages/portal facebook:draft promote \
  --production-hash EXACT_64_HEX_SHA256 \
  --evidence /absolute/path/to/redacted-promotion-evidence
```

The evidence paths must be absolute, evidence files remain outside source control, and receipts remain under the ignored owner-private `.facebook-upload-receipts` directory. Barrier transitions take an exclusive per-hash local lock, and the final production-promotion receipt is write-once; preserving a mistaken receipt requires manual investigation rather than overwriting history. These commands verify local consistency only; their existence is not evidence that Meta accepted or promoted anything.
