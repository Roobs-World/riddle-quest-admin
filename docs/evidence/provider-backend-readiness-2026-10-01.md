# Facebook and Reddit backend readiness — 1 October 2026

Read-only Firebase MCP and authenticated provider API inspection now distinguish
the deployed backend from the local review candidate. No deployment or production
database mutation was performed.

The deployed Facebook configuration, claim and acceptance Functions are ACTIVE on
Node 22, but still have `FACEBOOK_DISABLED_FEATURES=commerce,rewarded_ads,notifications`.
The [local configuration follow-up](facebook-config-readiness-2026-10-01.md) permits
native bot subscription prompts; it has not changed hosted behavior. Before testing
those prompts, deploy the reviewed complete backend unit and verify the actual
authenticated projection. Enabling a subscription prompt does not activate message
delivery or notification templates.

Firebase MCP lists 90 deployed Functions. The local Facebook export audit requires
22 entry points; the new `facebookContextRetentionScheduler` is absent from the live
list. All four Reddit gateway names are present. These facts do not bind deployed
source bytes to the current dirty worktree. The selected deployed revision names and
update times are retained in
[sanitized configuration evidence](../../artifacts/provider-backend-review-2026-10-01/deployed-configuration.json).

Exact Firestore field GETs, rather than an unpaginated field-list inference, found:

| Expiry field | Deployed policy at inspection |
| --- | --- |
| `facebookIdentityRateLimits.expiresAt` | ACTIVE |
| `facebookContextCompetitionHistory.expiresAt` | ACTIVE |
| `facebookTournaments.expiresAt` | ACTIVE |
| `redditTournaments.expiresAt` | ACTIVE |
| `facebookReferralTokens.expiresAt` | Absent; local policy/backfill prepared |
| `facebookIdentityNonces.expiresAt` | Absent; local policy/backfill prepared |
| `redditGatewayNonces.expiresAt` | Absent; local policy added in this follow-up |
| `redditGatewayRateLimits.expiresAt` | Absent; local policy added in this follow-up |

The Reddit nonce and quota writers already produce Firestore timestamps at their
original 24-hour deadlines. Their policies were missing from both deployment
configuration and the live database. This follow-up adds exactly those two
unindexed collection-group policies. It changes neither assertion acceptance nor
quota windows. No account, identity mapping, purchase receipt or another platform's
collection receives a TTL. The Reddit profile cache is nested in the permanent
provider identity record: its physical cleanup needs a field-removal operation,
because TTL would delete the entire identity mapping.

TTL deletion is asynchronous and does not establish an exact wall-clock removal
time. Existing expired records with valid timestamps become eligible after policy
activation. Missing or malformed historical timestamps require separate inspection;
no production rows were read. [Firebase's TTL documentation](https://firebase.google.com/docs/firestore/ttl)
describes deletion behavior and recommends avoiding unnecessary TTL-field indexes.

Secret Manager metadata inspection accessed no secret payload. Expected secret-name
bindings are present on the selected identity/deletion Functions. Reddit secrets have
one enabled and one disabled version each; the Facebook app secret has two enabled
versions, and its UID secret has one. Version metadata is not proof of value
uniqueness, rotation, historical-value safety or least-privilege IAM. Detailed version
metadata is retained outside the repository in an owner-private directory and files;
repository evidence contains only names and aggregate states. No version was disabled,
destroyed or replaced. Preserve the documented UID-key migration constraints.

Validation and source hashes are retained in the
[manifest](../../artifacts/provider-backend-review-2026-10-01/manifest.json):

- Both target-specific deployment-environment requirements pass; 49 deployment-script
  tests and the 22-entry Facebook / four-entry Reddit export audits pass.
- The local index configuration parses without duplicate field overrides, contains
  the two intended unindexed TTL policies and no TTL on accounts/identity mappings.
- Node 22 Firestore replay/quota integration: four tests pass, including the original
  deadlines and delayed assertion rejection. This does not emulate production TTL.
- All six required target builds and isolation audits pass; Reddit package checks:
  35 tests. The Facebook secret-boundary audit also passes.
- No runtime TypeScript or client source changed in this follow-up. The full
  [1,398-test Node 22 backend run](reddit-assertion-expiry-2026-10-01.md) remains the
  runtime regression capture; the rebuilt Facebook client matches the previous
  399-entry browser-tested candidate.

Remaining rollout includes source review, the complete Functions/rules/indexes release,
bounded Facebook backfill, deployed flag/policy verification, observed physical cleanup,
real signed Devvit forwarding and hosted/device acceptance. Exact host approval,
commerce/reward contracts, secret/IAM proof and the content constraint remain open.
Local green checks do not approve deployment or close the full review-readiness goal.

Follow-up: [Reddit profile retention](reddit-profile-retention-2026-10-01.md) now
implements the field-removal operation locally with six passing emulator tests.
It adds a fifth required Reddit export and a composite index. The earlier four
gateway exports and metadata observations above remain the historical capture;
scheduler deployment and live index readiness are still outstanding.
