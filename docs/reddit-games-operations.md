# Reddit Games operations

For first-time app/community provisioning, secrets, a non-promotable private
playtest, and the sandbox Firebase deployment, run the resumable guarded wizard:

```bash
./scripts/setup-reddit-games.sh
```

It requires confirmation before external mutations and never writes either Reddit
Firebase secret to an environment file or repository. Its `playtest:upload` is a
bootstrap artifact only; it is not an immutable production candidate or promotion
receipt.

Last updated: 2026-10-01

## Release state

Reddit is a separate compile-time target packaged as a Devvit Web app. Private
prerelease `0.0.1.23` is installed in `r/riddle_quest_dev`; it still calls the
denied Cloud Functions hostname. The current local package calls the first-party
`www.roobsworld.com` proxy. The public route now passes the unsigned-request
check, returning JSON `signature-required`; authenticated forwarding and Reddit's
host approval still require hosted evidence. Run
`pnpm --filter @qwordly/reddit-app check:hosted-gateway` before a private upload.
Production approval and publication are not complete. HTTP-fetch
approval for the current host, payment eligibility, policy review, multi-role
playtests, physical iOS/Android tests, hosted evidence, and exact-artifact release
verification remain outstanding. Notifications remain disabled unless separately
approved. See [the current review check](evidence/facebook-reddit-review-followup-2026-10-01.md).

The game Terms are now published at https://roobsworld.com/riddle-quest/terms.
The Reddit app details contain that Terms URL and the general website Privacy
Policy URL. Both public pages now include Reddit game coverage and return HTTP
200; publication does not establish Reddit approval. Current local Gold
checkout coverage is recorded in [the currency verification](evidence/reddit-gold-2026-09-19.md).

For another private bootstrap upload, choose an unused numeric prerelease version
from the app dashboard and pass it explicitly:

```bash
pnpm --filter @qwordly/reddit-app playtest:upload <major.minor.patch.prerelease>
```

Devvit 0.14.1 computes `upload --bump prerelease` from the latest stable version,
ignoring existing prereleases, which caused a duplicate-version failure on
2026-09-17. The wrapper validates the package and requires an explicit prerelease;
it never retries an uncertain upload. Inspect that exact version with
`devvit view riddle-quest@<version>` before deciding whether to retry. Upload does
not update an existing installation: use `devvit install <test-subreddit>
riddle-quest@<version>` to install the confirmed private version.

The private uploader now holds `.reddit-release-receipts/playtest.lock` through
validation and transmission. It persists an immutable attempt before invoking
Devvit and retains the CLI outcome separately. An uncertain or interrupted attempt
blocks every later version, and an attempted version is never reused. A failed
local package check creates no attempt. These records are private bootstrap
evidence, not an immutable production candidate or proof of installed bytes.

After inspecting the exact provider version, record its authoritative outcome
without uploading anything:

```bash
pnpm --filter @qwordly/reddit-app playtest:resolve <version> accepted --confirm-version <version>
```

Use `confirmed-absent` only when Reddit definitively confirms no such version was
created; a timeout, authentication failure or unavailable dashboard does not prove
absence. Resolution appends a separate immutable record and preserves the original
attempt and uncertain outcome. Choose a new unused version for the next upload.
If an interrupted process leaves the lock behind, inspect its recorded PID and
confirm the owning process is terminal before removing only `playtest.lock`.
The retained attempt still requires outcome resolution. Do not delete journal
records to bypass the barrier; malformed or orphaned evidence needs investigation.
See [private upload recovery evidence](evidence/reddit-playtest-recovery-2026-10-01.md).

## Canonical game-post creation

Install, upgrade and moderator requests share the installation-local Redis key
`riddle-quest:canonical-post:v1`. Existing `t3_` references remain compatible. New
creation atomically claims that key with `creation-pending:v1` using the real
Devvit SDK's `set(..., {nx: true})`, then replaces the marker with Reddit's returned
post ID after a successful submission. There is no process-local lock or expiry
that could authorize a duplicate submission after a timeout.

An overlapping request may fail temporarily while the winner is working; retrying
after successful completion reuses the retained post. A pending or corrupt record,
an unavailable retained post, or an ambiguous provider/Redis response does not
authorize replacement. Inspect the exact installation and Reddit post outcome.
For an uncertain submission, recover the confirmed existing `t3_` reference through
a reviewed installation-scoped maintenance action. Clear a pending marker only
after Reddit positively confirms no post was created and every original execution
is terminal. An unavailable dashboard or a timeout does not prove absence. This
repository exposes no automatic reset or public recovery endpoint; provider
inspection and any maintenance action remain operator work. Never roll back to
the old implementation while a pending marker exists: it deletes non-`t3_` values
and can submit another post.

The [canonical post test](evidence/reddit-canonical-post-2026-10-01.md) records the
three-submission reproduction and local concurrency/failure checks. Hosted
install/upgrade/moderator acceptance remains required before review.

## Trust and network boundary

The webview contains only the Reddit adapter and calls same-origin `/api/*` routes.
It must not contain the Firebase browser SDK, JestSDK, FBInstant, private credentials,
or external browser endpoints. The request-scoped Devvit server obtains trusted
`userId`, post, subreddit, and app context, then signs one-operation assertions to
`www.roobsworld.com/api/reddit-gateway/*`. That exact hostname is the only
external domain in `devvit.json`; Reddit approval of it is required before release.

Gateway assertions must remain fresh through replay-record persistence. The
[1 October verifier check](evidence/reddit-assertion-expiry-2026-10-01.md) rejects
requests that expire while their nonce is being written. A successfully written
nonce remains spent after that rejection; obtain a fresh server-signed request
rather than reusing the old assertion. Physical nonce cleanup remains separate
from the 60-second logical acceptance window.

The exact signed `gameplay.presence.poll` operation now has a server-owned quota
of 60 requests per user per UTC minute. This supports the required two-second race
polling plus bounded state changes and consent revocation. Every other operation
retains its 20-request limit. Requests are still signature-verified and replay
checked before quota consumption, and the larger budget cannot be selected by a
browser payload. The [presence quota check](evidence/reddit-presence-quota-2026-10-01.md)
records the reproduced failure and passing emulator tests. This backend fix is
prepared locally and needs the complete reviewed deployment unit before hosted
testing can prove the behavior. Rolling back to the old 20-request implementation
also requires handling any existing polling bucket above 20; the old validator
rejects those records even after the minute boundary until they are removed.

The [1 October backend metadata review](evidence/provider-backend-readiness-2026-10-01.md)
found no deployed TTL on `redditGatewayNonces.expiresAt` or
`redditGatewayRateLimits.expiresAt`. Both unindexed policies are now committed for
the complete reviewed deployment unit. Nonce deadlines are 24 hours after issue;
quota deadlines are 24 hours after the current one-minute reset. Verify policy
activation and actual asynchronous deletion after rollout. The nested Reddit
profile cache now has a prepared field-only cleanup scheduler; never apply a TTL
to its enclosing `providerIdentities` record. See the profile cleanup runbook below.

Firebase is the authoritative global identity, profile, economy, riddle, and race
store. Devvit Redis may cache installation/post state but must never be the canonical
balance, receipt, entitlement, or global account store. Logged-out players may use
local solo play only; valuable persistence and social actions require trusted Reddit
identity. Login reloads the post, so guest state must be preserved before prompting.

Devvit owns the webview CSP. Keep client requests same-origin and validate the built
package with `pnpm --filter @qwordly/reddit-app validate`; do not weaken the boundary
with a permissive HTML meta policy.

## Build and local verification

```bash
pnpm --filter @qwordly/portal build:reddit
pnpm --filter @qwordly/reddit-app build
pnpm --filter @qwordly/reddit-app validate
pnpm --filter @qwordly/reddit-app playtest
```

The package must retain the inline localized launch entry, regular game entry, CJS
server bundle, generated licenses, reciprocal SDK/endpoint audit, critical-load
budget below 5 MB, and individual files below 100 MB. Browser evidence must use the
injected Reddit harness; Devvit playtest and uploaded evidence require multiple role
accounts on Reddit web and physical iOS and Android devices.

## Secrets and configuration

Only initial provisioning for a genuinely account-free app generates unrelated
high-entropy values for `REDDIT_GATEWAY_SECRET` and `REDDIT_UID_SECRET`. Store both in Firebase Secret Manager. The UID key is fixed
account identity material: current code has no key-version fallback or migration.
Never rotate it in place for existing accounts or deleted-generation mappings.
The setup wizard now checks existing UID metadata and preserves that key; initial
provisioning requires a separately reviewed account-free setup. Store only the matching
gateway value in the Devvit global secret setting `redditGatewaySecret`; the UID
secret never leaves Firebase. Never reuse historical Meta/Jest credentials.
Set the non-secret Devvit global setting `redditEnvironment` to exactly `sandbox`
for playtest builds or `production` for reviewed releases. Referral requests fail
closed when it is missing or invalid; the browser cannot override it.

`REDDIT_DISABLED_FEATURES` is the provider-scoped emergency deny list.
`REDDIT_APPROVED_FEATURES` is a second gate for approval-bound `commerce` and
`notifications`. An approval flag does not substitute for code, contract fixtures,
review, or device evidence. Ads are unsupported and must remain absent.

`REDDIT_COMMERCE_SANDBOX_ENABLED` must be explicitly `0` or `1`. A value of `1`
accepts commerce only when the signed Devvit session identifies the environment as
`sandbox`; it never enables production purchases. Production commerce additionally
requires `commerce` in `REDDIT_APPROVED_FEATURES`.

## Firebase deployment unit

The Reddit gateway depends on `exchangeRedditIdentity`, `deleteRedditAccount`,
`redditStorage`, and `redditGameplay`. The supporting
`redditProfileRetentionScheduler` is the fifth required Reddit export. Its indexed
field cleanup must ship with the complete reviewed backend release. Before uploading the Devvit package, run the
full Functions type, lint, unit/integration, rules, and deployment preflight, set the
two Reddit secrets, and deploy every new or changed Function in one reviewed release.
Record the project, revision, source commit, command output, and post-deploy probes.
Do not deploy a public gateway before the Devvit app identity and matching secret are
configured; an unusable public endpoint is not completion evidence.

## Hosted contract fixtures

Capture each real `auth`, `payment`, `refund`, `post-entry`, `realtime`, and
`notification` JSON payload without writing its raw bytes to the repository. Pipe
it through `pnpm --filter @qwordly/reddit-app capture:contract <type> -` and store
only the resulting sanitized JSON under `docs/evidence/reddit-contracts`. The
capture command strips credentials, provider IDs, profiles, and URL query data and
records a source digest and timestamp. Run
`pnpm --filter @qwordly/reddit-app validate:contracts`; the immutable release gate
will fail until all six provenance-bound fixture types pass validation.

Create the immutable candidate only after the contract fixtures pass:

```bash
pnpm release:reddit
```

The command always rebuilds the Reddit client and server from the same clean commit;
it never stages an older ignored client artifact. Remote ingestion is currently
blocked because the installed Devvit CLI rebuilds and has no documented prebuilt
archive input. Do not treat the bootstrap playtest upload as release evidence.

After an approved exact-byte ingestion path exists and the retained candidate has
been reviewed, populate `docs/evidence/reddit-hosted-evidence.json` from the adjacent
example. `pnpm --filter @qwordly/reddit-app release:promotion` requires the immutable
artifact hash/version/commit, proves the hash and commit match the gated receipt and
read-only handoff, validates the complete five-Function and four-rules Firebase
deployment, fetch/payment/policy/security approvals, all four roles, all six critical
journeys, and passing Reddit web plus physical iOS and Android evidence.

## Deletion and privacy

In-game deletion is signed by trusted Devvit context. Firebase advances the provider
account generation before cleanup, removes the generation's account data and cached
profile, and makes stale retries unable to delete a recreated generation. A fresh
explicit start creates the next generation with 300 coins. Provider identity records
are server-readable only. Reddit ID and sanitized profile cache never enter browser
responses; the profile cache expires after 24 hours and accepts only approved HTTPS
Reddit image hosts. See `privacy-data-inventory.md` for retention caveats.

## Reddit profile cleanup

The [1 October retention evidence](evidence/reddit-profile-retention-2026-10-01.md)
records the new cleanup and emulator verification. The scheduler is prepared locally
and runs at minute 29 of each UTC hour after deployment. It selects at most 50
expired Reddit caches, re-reads each mapping in a transaction, and removes only
`redditProfile`. Concurrent refreshes, deleted mappings, account generation, raw
provider identity, Firebase UID and every other provider remain intact.

Before rollout, verify the `providerIdentities` composite index for ascending
`provider` and ascending `redditProfile.expiresAt` is READY. The emulator does not
prove production index readiness. Record the scheduler's deployed revision and
actual field removal in the reviewed release receipt; the scheduler is absent
from the 1 October deployed-function listing. The initial metadata index read was
rejected; the follow-up using the API-supported default page size completed and
confirmed the required index is absent. See the [access and index review](evidence/provider-iam-readiness-2026-10-01.md).

The operator command defaults to a read-only dry run and requires an explicit
project. Apply requires the same project confirmation and accepts no clock override:

```bash
pnpm --dir firebase-functions reddit:profiles:retention --project riddle-quest-ec2b2
pnpm --dir firebase-functions reddit:profiles:retention --project riddle-quest-ec2b2 --apply --confirm-project riddle-quest-ec2b2 --limit 50
```

Only aggregate counts are emitted. An `invalid` count requires investigation of
malformed state or failed transactions; do not discard a mapping to clear a cache.
`complete: false` means the bounded page has a backlog or failure. Monitor those
counts and repeat bounded apply pages as required. The 50-record hourly budget
makes no exact physical deletion deadline; social reads already suppress the cache
at its 24-hour logical expiry. Missing/malformed expiry fields need separate
operator inspection. Never configure identity/account TTL or recreate missing rows.

## Release and retry barrier

Run `pnpm release:reddit` only from a clean committed worktree. It creates a
SHA-256/commit-bound receipt and read-only candidate handoff, then stops. The legacy
package `release:gate` delegates to the same candidate command for one migration
cycle. Package-level `release:upload` and `release:publish` commands fail closed: the
installed Devvit upload builds again, and `devvit publish` creates and uploads a new
version rather than proving promotion of reviewed bytes.

No production transmission command is currently approved. Before adding one, it must
verify the exact read-only handoff, create the existing transmitting barrier before
calling Devvit, and preserve ambiguous outcomes until Reddit gives an authoritative
result. Publication must promote the already reviewed exact version rather than
create another version. Until those capabilities are proven, Reddit remote release is
blocked. Roll back a future release by disabling affected features and selecting a
previously verified version, never by editing accepted bytes.

## Monitoring and incidents

Follow `reddit-incident-response.md`. Watch structured gateway failures, signature
rejections, rate-limit spikes, deletion retries, upstream latency/timeouts, and
unexpected capability exposure. Logs must not contain raw Reddit IDs, assertions,
gateway secrets, profile names/photos, guesses, or purchase material.
