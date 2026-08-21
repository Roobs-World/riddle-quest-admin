# Reddit Games operations

For first-time app/community provisioning, secrets, private playtest, complete
Firebase deployment, and unchanged-byte promotion, run the resumable guarded wizard:

```bash
./scripts/setup-reddit-games.sh
```

It requires confirmation before external mutations and never writes either Reddit
Firebase secret to an environment file or repository.

Last updated: 2026-08-20

## Release state

Reddit is a separate compile-time target packaged as a Devvit Web app. It is not
approved or deployed. External app creation, the dedicated community, HTTP-fetch
allowlisting, payment eligibility, notification beta, multi-role playtests, real
iOS/Android tests, upload, review, and publication remain blocking acceptance gates.

## Trust and network boundary

The webview contains only the Reddit adapter and calls same-origin `/api/*` routes.
It must not contain the Firebase browser SDK, JestSDK, FBInstant, private credentials,
or external browser endpoints. The request-scoped Devvit server obtains trusted
`userId`, post, subreddit, and app context, then signs one-operation assertions to
`us-central1-riddle-quest-ec2b2.cloudfunctions.net`. That exact host is the only
external domain in `devvit.json`; Reddit approval of it is required before release.

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

Generate unrelated high-entropy values for `REDDIT_GATEWAY_SECRET` and
`REDDIT_UID_SECRET`. Store both in Firebase Secret Manager. Store only the matching
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
`redditStorage`, and `redditGameplay`. Before uploading the Devvit package, run the
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

Populate `docs/evidence/reddit-hosted-evidence.json` from the adjacent example only
after the exact receipts exist. `pnpm --filter @qwordly/reddit-app validate:hosted`
requires the immutable artifact hash/version/commit, the complete four-Function and
four-rules Firebase deployment, fetch/payment/policy/security approvals, all four
roles, all six critical journeys, and passing Reddit web plus physical iOS and
Android evidence. The release gate validates this manifest before packaging.

## Deletion and privacy

In-game deletion is signed by trusted Devvit context. Firebase advances the provider
account generation before cleanup, removes the generation's account data and cached
profile, and makes stale retries unable to delete a recreated generation. A fresh
explicit start creates the next generation with 300 coins. Provider identity records
are server-readable only. Reddit ID and sanitized profile cache never enter browser
responses; the profile cache expires after 24 hours and accepts only approved HTTPS
Reddit image hosts. See `privacy-data-inventory.md` for retention caveats.

## Release and retry barrier

Run `pnpm --filter @qwordly/reddit-app release:gate` only from a clean committed
worktree. It creates a SHA-256/commit-bound receipt and read-only handoff. Once an
upload begins, retain the transmitting/ambiguous barrier until Reddit gives an
authoritative result; never retry uncertain bytes blindly. Upload the exact verified
package as an unlisted version in the dedicated Riddle Quest community. Publication
uses stable SemVer and `devvit publish`; a human requests public listing only after
review and all tracker gates pass. Roll back by disabling affected Reddit features
and selecting a previously verified version, never by editing accepted bytes.

## Monitoring and incidents

Follow `reddit-incident-response.md`. Watch structured gateway failures, signature
rejections, rate-limit spikes, deletion retries, upstream latency/timeouts, and
unexpected capability exposure. Logs must not contain raw Reddit IDs, assertions,
gateway secrets, profile names/photos, guesses, or purchase material.
