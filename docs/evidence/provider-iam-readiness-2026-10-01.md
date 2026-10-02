# Provider access and Reddit UID-key safety — 1 October 2026

The read-only review found two concrete deployment gaps and corrected a setup
instruction that could break existing Reddit accounts. No live permissions,
credentials, account records, deployments or uploads changed.

Authenticated Secret Manager policy GETs succeeded for `FACEBOOK_APP_SECRET`,
`FACEBOOK_UID_SECRET`, `REDDIT_GATEWAY_SECRET` and `REDDIT_UID_SECRET`. Each has one
unconditional secret-accessor principal and no public principal. Exact metadata
reads of seven ACTIVE Functions show Facebook identity/callback deletion, shared
in-game deletion, Reddit identity/gameplay/storage and Jest identity use that same
runtime service account. Declared environment secrets differ by function, but the
shared runtime identity has IAM access to all four provider secrets. These reads
do not establish provider-separated least privilege.

The project policy read succeeded: the sampled runtime principal holds Editor,
Eventarc event receiver and Cloud Run invoker. It has no project-level owner,
Secret Manager administrator or accessor role in that policy. Editor is broad but
does not itself include secret payload access; the per-secret grants do. Folder/
organization inheritance and effective custom permissions were not inspected.
[Google Secret Manager access control](https://docs.cloud.google.com/secret-manager/docs/access-control)

Raw principal/policy metadata is stored outside the repository in an owner-private
directory (`0700`) with a `0600` metadata file. The repository summary contains
function IDs, secret names, roles and aggregate counts, without raw principals or
secret version values. See
`artifacts/provider-iam-review-2026-10-01/iam-summary.json`. No secret payload was
accessed. The [credential runbook](../credential-rotation-runbook.md) now describes
the reviewed runtime-identity cutover needed before old permissions are revoked.

The Reddit setup wizard previously always wrote a new `REDDIT_UID_SECRET`, and
the incident/rotation runbooks instructed in-place replacement. Current code
derives active UIDs and prior deleted-generation hashes using one fixed key and
rejects mismatches. There is no previous-key fallback or migration. Replacing it
would prevent existing identity and deletion operations from resolving safely.

The wizard now reads existing UID-secret metadata, requires the operator to verify
its enabled/deployed version, and never requests or writes the UID value. Missing
metadata/access or declined verification stops before gateway secret entry or
mutation. Ordinary gateway rotation still writes the coordinated Firebase/Devvit
gateway value and sandbox setting. Initial UID provisioning for an account-free
app remains a separate reviewed action. Exposure requires disabling Reddit identity
and a reviewed migration before replacing the key; deleting mappings or resetting
generations is not a recovery path.

`pnpm check:reddit-setup` passes Bash syntax and four tests. The new tests execute
the actual guarded stage in an isolated temporary environment with a stubbed
provider executable: success makes exactly one UID metadata read and three
gateway/settings writes, while metadata failure, denied verification and invalid
gateway input cause no writes. Secrets and private provider diagnostics remain
absent from output. The complete interactive wizard was not run.

The profile-index follow-up resolved the initial HTTP 400: the API reported that
only default page size `0` is supported. Using that value with next-page-token
handling returned ten indexes, no further token and no matching ascending
`provider`/`redditProfile.expiresAt` index on `providerIdentities`. The required
index is confirmed absent. The earlier failed capture is retained; the successful
summary is
`artifacts/reddit-profile-retention-review-2026-10-01/index-metadata-followup.json`.
The listing is read-only and accesses no account rows.

Client/runtime source is unchanged in this pass. The preceding six-build
verification remains the build reference; current artifact hashes are recorded
alongside it. Facebook continues to match the retained browser-tested reference. The review trackers retain pending
provider approval, real contracts, hosted/device acceptance, complete translation
matrix, clean-source and coordinated deployment gates. These findings do not make
either platform eligible for public release.
