# Facebook Instant Games operations

Last updated: 2026-08-19

This runbook describes the Facebook web target currently present in source. It is not release approval. The authoritative acceptance status is
[`facebook-instant-games-progress.html`](facebook-instant-games-progress.html); a draft or production upload is forbidden until its required gates pass.

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

The wizard stores only non-secret app identifiers and URLs under the ignored, owner-local `.facebook-setup-receipts` directory. It deliberately never accepts secret values and never changes tracker statuses. Meta approvals remain deferred until the final gate, as requested.

Private values belong in Firebase/Google Secret Manager and CI secret bindings, never `VITE_*`, source files, logs, fixtures, ZIPs, or Meta configuration exports:

- `FACEBOOK_APP_SECRET`: newly issued Meta app secret used to verify signed player and deletion assertions.
- `FACEBOOK_UID_SECRET`: independent, versioned HMAC key for stable `facebook_<40 hex>` Firebase UIDs.

Non-secret deployment configuration includes `FACEBOOK_APP_ID`, `FACEBOOK_FIREBASE_APP_ID`, exact comma-separated `FACEBOOK_GAME_ORIGINS`, and the HTTPS `FACEBOOK_DELETION_STATUS_BASE_URL`. The app secret also domain-separates opaque deletion confirmation codes. Historical Facebook values documented in repository history are compromised and must not be reused.

### Firebase backend deployment

All new and changed Functions must be deployed before the Facebook artifact is uploaded. Run `pnpm preflight:facebook-backend` from the repository root first. It validates the Jest and Facebook deployment environments, server-only secret bindings, the complete 21-entry Facebook callable/trigger export surface, types, lint, the complete Functions suite, and the deploy build. The export audit fails for any omitted or duplicate entry point. The preflight deliberately fails until the four non-secret Facebook values above are present in `firebase-functions/.env.riddle-quest-ec2b2`; it never accepts a Page name in place of the numeric Meta App ID. Secrets remain in Secret Manager and must not be added to that file.

After reviewing the target project and successful preflight output, the authorized operator runs `pnpm --dir firebase-functions deploy:facebook-backend`. This command targets `riddle-quest-ec2b2` explicitly and deploys all exported Functions together with Firestore rules/indexes, Realtime Database rules, and Storage rules. Deploying only selected new callable names is insufficient because shared gameplay, deletion, identity, presence, social, and rules boundaries changed together. Retain the Firebase release output and deployed revision identifiers as tracker evidence; source tests are not proof of deployment.

`FACEBOOK_DISABLED_FEATURES` is a comma-separated emergency-off list. Accepted names are `identity`, `commerce`, `rewarded_ads`, `interstitials`, `referrals`, `notifications`, `matchmaking`, `tournaments`, and `presence`. Unknown names fail deployment closed. Identity is enforced before nonce issue and exchange. Every other switch is projected by the authenticated client-configuration callable and is also enforced at its implemented server boundary. The Facebook entry composes referrals, contexts/boards, tournaments, notifications, interstitials, and presence only when their independent projection is enabled; a configuration read failure hides every optional feature while core play continues. Authenticated Facebook configuration and consent requests mirror the deployed presence value to the server-only `featureGates/facebookPresence` RTDB node. Rules fail Facebook presence closed while that node is missing or false, revoke existing listeners, and deny new Facebook connection writes without affecting Jest.

### Emergency switch procedure

1. Record the incident ID, UTC time, deployed revision, and affected provider capability. Preserve sanitized evidence; never paste assertions, secrets, raw player IDs, receipts, or notification tokens into the incident record.
2. Read the current deployed `FACEBOOK_DISABLED_FEATURES` value. Add only the exact affected name, retain every existing disabled name, and deploy Functions configuration through the normal audited environment workflow. Do not change a `VITE_*` value or rebuild Jest for an emergency server switch.
3. Verify an authenticated Facebook configuration response reports only that capability disabled. This request also synchronizes the RTDB presence rules gate before reading optional commerce state. For `identity`, verify nonce issue and exchange return the expected unavailable response instead. Verify an unrelated Facebook capability and Jest core play still work.
4. For presence, confirm an already-open Facebook status listener is revoked, a new Facebook connection write is denied, opt-out cleanup remains available, and equivalent Jest reads/writes still succeed; stale records may remain server-only until ordinary disconnect cleanup. For commerce/referrals/rewarded ads, confirm no new grant boundary can execute. For matchmaking/tournaments, confirm writes fail server-side as well as disappearing from the client.
5. Record the configuration revision and verification evidence. Re-enable by removing only the incident's name after root-cause remediation has passed the same checks and a second person approves the change.

Local parser/projection regression command:

```sh
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand \
  src/__tests__/facebookFeatureFlags.test.ts \
  src/__tests__/facebookClientConfiguration.test.ts
```

## Identity and deletion

The browser requests a one-use nonce, asks FBInstant for signed player information bound to that exact nonce, and exchanges the assertion for a Firebase custom-auth token and a one-hour custom App Check token. The server verifies the HMAC, algorithm, player, nonce, issue time, size, replay state, configured app secret, origin, and request limits. A local limiter sheds bursts and a Firestore transaction enforces the shared 20-request-per-minute identity quota across instances. Its record key is a domain-separated HMAC of the client key, never the raw address, and its committed `expiresAt` TTL removes it after 24 hours. Reuse fails closed unless that timestamp is present and exactly 24 hours after the fixed window reset; malformed retention metadata is never silently repaired by accepting another request. Deploy and verify the `facebookIdentityRateLimits.expiresAt` TTL policy before opening role-account traffic. Provider records are server-only and custom claims contain `provider: facebook` and `accountGeneration`, not Meta names or photos.

In-game deletion and Meta's signed form callback use the same idempotent cleanup path. Before destructive work starts, the callback transaction writes a replay receipt that freezes the provider scope and exact account generation being deleted. Every processing retry restores only that frozen deterministic UID; it never resolves the provider's then-current generation. If a lost response is retried after the player has explicitly started the next generation, the old generation is accepted as already deleted without touching the new UID. A completed deletion advances the provider account generation and clears its active UID; a later explicit play session receives a different HMAC-derived UID and the standard 300-coin fresh profile. Only the hashed old UID and minimum generation/deletion timestamps remain in the provider record. The public callback returns an opaque confirmation code and configured HTTPS status URL without exposing an identity.

Before an in-game Facebook deletion, the shell rotates the local `riddleQuest:facebookAccountDeletionEpoch:v1` value so other current-build tabs reject new player work. Ordinary operations hold a shared `riddleQuest:facebookPlayerOperations:v1` Web Lock; deletion waits for an exclusive lock, stops presence, and invokes the server only after accepted work drains. A secure runtime without Web Locks fails the destructive request before server mutation. After authoritative success, the shell writes `null` to its two exact FBInstant data keys and flushes. A later reload treats the rotated epoch as its new baseline, allowing the explicit generation-based fresh start. Real Meta webview support and mixed-version/cross-device provider propagation remain P0 acceptance evidence.

## CSP and Meta-hosted acceptance

The root Firebase Hosting CSP is the Jest policy and is not evidence for the Meta-hosted artifact. Capture the effective Meta response headers and every required host from a real role-account session before defining the Facebook CSP allowlist. Prove Firebase Functions, Firestore/App Check, SDK script, overlays, ads, purchases, notifications, contexts, tournaments, pause/resume, web, iOS, and Android without a wildcard expansion. Record sanitized network logs and screenshots against the exact ZIP hash.

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

Facebook referral links carry one 32-byte opaque token whose server copy is SHA-256 hashed and expires after seven days. The invitee binds it only after Facebook Firebase auth/App Check, before any game or purchase establishes the account. A successful bind verifies both live accounts and establishes their server-owned rival relationship; the client cannot nominate either UID. The first authoritative win retries an idempotent settlement: the invitee receives 100 coins, while the inviter receives 100 only for the first five conversions in that UTC day. Never accept an inviter UID, name, reward amount, win flag, or time from entry-point data.

Facebook commerce is staged behind the provider-verifier boundary. The immutable catalog contract is owned by Core and consumed by both the browser adapter and authoritative Functions ledger; its six consumables are derived from the canonical game pricing catalog, with the Facebook-only durable product added once. The client requires all seven product IDs exactly once, rejects partial, unknown, subscription-like, extra-field, and duplicate catalogs, and verifies each USD `priceAmount` against the shared base price. Non-USD Meta-localized price text and amounts remain presentation values. Purchase and recovery accept at most 100 exact, unconsumed `charge` records, reject extra fields and duplicate payment IDs/tokens, and send only each provider `signedRequest` to the authoritative grant dependency. The server response—not the browser product record—decides whether the purchase token is consumable, so the durable ad-free product is never consumed as a coin pack. A consumption interruption leaves the purchase recoverable; the next attempt passes through the idempotent server ledger again before consumption. One shared client barrier serializes purchase and recovery so they cannot race a provider token; a second concurrent purchase is rejected before opening another provider dialog, while simultaneous lifecycle recovery triggers share one read/grant/consume sequence. Do not expose this coordinator or a commerce capability until a sanitized v8 signed-request fixture proves the decoded claims and a raw refund/webhook fixture proves its signature contract.

The notification permission prompt is triggered only from an authoritative single-player or race win result. Before opening platform UI, the client claims a server-owned `facebookNotificationPromptLeases/{uid}` lease through an App Check-protected callable. The transaction verifies the exact Facebook identity, at least one authoritative win, permanent acceptance state, and a seven-day retry interval. A same-origin exclusive Web Lock still serializes sibling tabs; the server lease additionally makes concurrent tabs, devices, and origins converge on one prompt attempt. Acceptance is written to the server before local preferences are marked accepted. The `notifications` emergency switch is enforced at both claim and acceptance mutations. Direct client access to the lease is denied, and account deletion removes it. This still does not prove the exact Meta permission API or real-device semantics; retain those as P0/P5 acceptance gates until sanitized platform fixtures and hosted tests exist.

Facebook names and photos may appear only through the v8 `overlayViews.createProfilePictureOverlayViewAsync` and `overlayViews.createProfileNameOverlayViewAsync` provider surfaces. The game mounts these overlays only in Activity and Tournaments, verifies they represent the authenticated current platform player, and destroys them when leaving the social surface. Game code never calls `getName`/`getPhoto` and never receives the rendered values. The source audit `pnpm check:facebook-profile-boundary` enforces this boundary. Do not copy Meta identity into Firebase, logs, analytics, reports, or game-owned profiles. Presence is opt-in and limited to server-established rivals. Blocks must immediately revoke interaction and presence visibility; categorized reports go to a server-only, rate-limited moderation queue. Chat and an admin panel are out of scope.

The queue's exact intake, least-privilege triage, deletion, unresolved retention, and current lack of an adjudication/sanction workflow are documented in the [Facebook social moderation runbook](facebook-moderation-runbook.md). Do not mutate report status or player state manually until that workflow has owner/counsel approval and an auditable implementation.

The Activity surface exposes safety controls only when its server projection includes a provider-neutral linked-rival Firebase UID. A successful block immediately removes that rival from the client list; subsequent race mutations and presence reads are independently denied by server rules. Reports accept one of five fixed categories, never narrative text, and use the bridge request ID for idempotency. Deleted/unlinked rivals are projected without a safety target.

Each opted-in browser tab/device owns one RTDB `presenceConnections/{uid}/{sessionId}` record, arms `onDisconnect` deletion before publishing, and reports only `online`, `playing`, or `racing`. The server aggregates the highest active state and maintains a separate `presenceOptIn` bit. Rival reads require both a server-written `presenceVisibility/{viewer}/{target}` edge and the target's live opt-in bit; clients cannot write visibility, read its reverse index, or enumerate strangers. A known-rival Firestore trigger creates the edge, either directed block removes both directions, and deletion uses `presenceViewers` as a server-only reverse index to remove incoming and outgoing edges. Missing last connection removes the opt-in bit so stale ACLs alone cannot reveal status.

FBInstant context IDs are validated in the browser boundary and stored only as domain-separated SHA-256 keys. Both players must independently authenticate and join the same context before the server writes bilateral known-rival relationships. Context membership is locale-bound, capped at 50, expires after seven days, and elects the earliest active join (then UID) as host. A context switch joins the new board before leaving the old one so retries converge without a membership gap. Completed authoritative runs create per-member best-time entries; clients receive only rank, adjusted milliseconds, and a current-player bit. On rollover, all prior entry documents are deleted before a fresh board is written, and only identity-free board metadata is archived for 30 days. TTL applies independently to parent and entry documents because Firestore does not cascade parent TTL deletion. Account deletion removes the UID and score entry from every indexed board, re-elects the host, and deletes every remaining entry before deleting an empty board.

## Release and incident rules

- Keep Meta Business verification and Approved Partner approval deferred as requested, but do not upload, promote, or call the project complete without them.
- Run the server-only Meta secret-boundary audit before inspecting artifact bytes, then create an immutable root-content ZIP, record its SHA-256 and source commit, and upload those exact bytes as a non-production draft only after all preflight gates pass.
- A human promotes the unchanged verified bytes. There is no geographic soft launch.
- If an upload result is ambiguous, retain a retry barrier and reconcile the dashboard state before transmitting again.
- During an incident, disable only the affected Facebook feature, preserve Jest/core play where safe, record timestamps/revisions/hashes, and retain sanitized evidence for review.

The exact-byte handoff is deliberately human-controlled because no verified Meta upload transport contract is committed. From a clean reviewed commit, run the preflight, then open the exclusive handoff. The preflight runs the source secret-boundary audit before the artifact audit and ZIP step; direct invocation of the preparer retains this ordering. `begin` copies the verified bytes once to an owner-private, read-only, hash-named snapshot under `.facebook-upload-receipts`; upload only that printed snapshot path. A later preflight may replace `build-facebook.zip`, but it cannot change the active handoff bytes:

```sh
pnpm --filter @qwordly/portal preflight:facebook-upload
pnpm --dir packages/portal facebook:draft begin
```

If the outcome is unknown, do not begin again or retransmit. Reconcile the existing draft in Meta first. After Meta shows the non-production draft, save a redacted dashboard capture outside the repository and bind its bytes plus the draft ID to the accepted ZIP:

```sh
pnpm --dir packages/portal facebook:draft ambiguous \
  --reason "dashboard result unknown after transmission"
```

This transition is exclusive and retained; concurrent or repeated attempts fail closed. After reconciling the existing artifact in Meta, bind its redacted evidence plus draft ID to the accepted ZIP:

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

The evidence paths must be absolute, evidence files remain outside source control, and receipts remain under the ignored owner-private `.facebook-upload-receipts` directory. Barrier transitions take an exclusive local lock, and the final production-promotion receipt is write-once; preserving a mistaken receipt requires manual investigation rather than overwriting history. These commands verify local consistency only; their existence is not evidence that Meta accepted or promoted anything.
