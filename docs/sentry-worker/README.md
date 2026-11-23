# Sentry repair worker on Vercel

The current source policy uses `main` for worker development and repair PR bases. Dated deployment observations below record the service revision that was actually checked; updating source does not update the deployed worker or its environment. Verify the deployed configuration before relying on the main-only policy in production.

On 2026-11-22 the documented endpoint returned HTTP 404
`DEPLOYMENT_NOT_FOUND`. Authenticated lookup of the old project ID and name also
returned 404, and team-scoped project search was empty. There was no deployed
worker revision at that target before this change.

The replacement project is `riddle-quest-sentry-worker`,
`prj_Odf4SGWgXFCJGFMzp7mteljZIgbN`, on team
`craig-beswethericks-projects-d44935d2`,
`team_Q3bXo2jPBKdjs3tuoKLtqUe2`. The restored production deployment is
`dpl_92fHZavA1kCmgJK5r2vbnenruEkW`, source `012020b5d`, at
<https://riddle-quest-sentry-worker.vercel.app/api/sentry-webhook>.
After explicit owner approval, service credentials were configured in this
project. Live health reports `configured`, `workerEnabled: true`, and
`autoMergeEnabled: true`. On 2026-11-23 the owner explicitly requested automatic
merging of repair PRs. The existing merge path was enabled through production
configuration without changing its CI or deployment checks. Live health verified
the enabled flag and exact source revision again at 01:50 UTC. No Sentry repair PRs were
open when it was enabled. Unsigned webhooks are rejected; signed stale-preview
webhooks and authenticated polling check current deployment identity and block
stale events. The first manual poll checked eight issues and launched no paid work.
The enabled Sentry app `riddle-quest-bb1edf` already points to this endpoint.
The hourly worker claimed the 10:00 UTC paid work budget on 2026-11-23 and opened
[repair PR #20](https://github.com/Grindhead/riddle-quest/pull/20) at 10:03:44 UTC
for scheduler issue `RIDDLE-QUEST-14`. This verifies a paid repair run and PR
creation. Its signed base `fb658bb81` was stale after `jest` advanced to
`464e4f541`, and the worker's base guard correctly blocked merging. The fixes
were then integrated manually and peer-reviewed at source
`5887d9279b768dd8a5ec055555868eecf1389631`.
[PR readiness run 45180137753](https://github.com/Grindhead/riddle-quest/actions/runs/45180137753)
completed successfully at 14:53 UTC with 4,048 workspace tests, 3,389 backend
tests, all four browser jobs and their 140 distinct plan commands. GitGuardian
also passed. The PR workflow intentionally skips the development receipt; the
later same-source push workflow and its receipt remain separate.

Under the owner's merge authorization, the exact tested source advanced into
`jest` and `origin/jest`. GitHub recorded PR #20 as merged at 14:54:42 UTC with
that same merge commit. This integration did not weaken the original ticket's
stale-base guard. The Jest repair preview completed processing as READY and
inactive, version `1.0.0-dev.20261123145501.5887d9279b76.24302180`, ID
`01a208e7-756d-7345-9610-52641a1dca1d`. Both authenticated sandbox accounts
passed English Settings, catalog, Premium, tab-switch, live two-player race and
reload-persistence checks on that exact preview. The passive probe recorded no
negative catalog replies or uncaught exceptions. The exact-release Sentry query
returned zero groups at 15:00:50 and 15:02:28 UTC, subject to ingestion delay.
Cloud Logging returned all 44 subscription-sync POST requests in the test window,
all HTTP 200 with no HTTP 429. Historical issues were not marked resolved.

Health at 15:02 UTC remained HTTP 200 and configured at worker revision
`012020b5d`, with automatic merging enabled. Production Functions deployment,
Jest activation and Facebook release remain separate operations. No backend
deployment or Facebook upload occurred in this pass. Sentry-originated webhook
delivery has not been independently verified. See the
[readiness evidence](../common/releases/evidence/jest-facebook-readiness-2026-11-23.md) for the source,
upload fingerprint, timed observations and remaining Meta acceptance limit.

The worker watches Sentry organization `roobs-world-limited`, project
`riddle-quest`, numeric project `4511885926006864`, and repairs
`Grindhead/riddle-quest` from `main` under the current source policy. Browser and Functions errors share that project.

## Processing and deployed-version checks

Signed Sentry webhooks verify exact bytes, retrieve a sanitized latest event,
check its current deployment and acknowledge eligible issues as `queued`.
Unresolved Sentry issues are the durable queue. Webhooks never start paid work.
Hourly Vercel cron polls at minute zero, inspects candidates within a 40-second
selection budget and starts at most one repair. A durable atomic GitHub ref,
`codex/sentry-budget-YYYYMMDD-HH`, enforces the same UTC-hour budget across retries
and concurrent calls. Each Sandbox has four vCPUs and a three-hour timeout.
Pending repairs can be reconciled without another paid start.

Event evidence contains only identity, runtime, environment, immutable release,
timestamp, exception type/message and up to 20 application frames. Player context,
requests, breadcrumbs, frame query strings and local variables are omitted.
Diagnostic text remains untrusted input, never agent instructions.

For active `jest-html5` production, the service fetches the public game page at
`https://jest.com/g/riddle-q` without a version query or credentials. It requires
exactly one server-rendered iframe on the game's exact `builds.jest.com` origin,
an immutable version path, and a successfully served HTML index. Bodies are
bounded and redirects, foreign hosts, unexpected query keys and ambiguous pages
fail closed. The iframe session query is discarded. The event's full
`riddle-quest@<version>` release must match that active immutable version.

Inactive previews additionally require the documented authenticated
`list_game_versions` MCP tool, an exact READY version, and explicit authorization
in `SENTRY_WORKER_JEST_PREVIEW_IDS`. The MCP active version must agree with the
public production page. Preview IDs alone never establish current deployment.

For `firebase-functions`, the service reads partial Cloud Functions v2 inventory
for `riddle-quest-ec2b2`. Event release must exactly match an ACTIVE runtime revision
serving all traffic in `us-central1` or `europe-west1`. A Git SHA fallback from
`SENTRY_RELEASE` cannot substitute for `K_REVISION`. The fingerprint includes the
function resource, revision and source provenance. Preserved legacy functions are
evaluated individually. Missing authority blocks mutation with a diagnostic reason.

The issue claim includes deployment fingerprint and event occurrence day. It
avoids duplicate work within a day while allowing new versions and later recurring
incidents. Abandoned claims without PRs can be reclaimed after four hours. A
four-hour HMAC completion capability binds issue, event, deployment, base SHA and
claim SHA. Signed reconciliation context remains valid for 12 hours to cover the
three-hour repair and required CI pipeline. Deployment and base are rechecked
before coding, completion and merge.

The Vercel function downloads the pinned private-repository archive and sends
only source bytes to an empty Sandbox. No GitHub, Sentry, Google or Jest credential
enters the Sandbox, its parent environment, Git metadata or source URL. The agent
has its OpenAI key; the wrapper has a scoped, expiring repair ticket. The runner
returns a bounded UTF-8 source patch and summary to the service. The service
rechecks authority and source, then creates GitHub blobs/tree/commit and a PR.

Automatic patches are limited to 12 files and 256 KiB under shared feature folders in `src/`, shared `firebase-functions/src`, and
`platforms/web/jest` or `platforms/web/facebook` in their `src`, `server` or
`scripts` directories. Native and every other provider root are rejected.
Deletions, symlinks, binary
files, dot paths, package manifests and nested agent instruction files are rejected. Repairs needing
other paths require manual work. The coding process cannot directly push or merge.
A later poll automatically squash-merges the exact successful Production readiness
PR head after fresh deployment/base checks. Production explicitly sets
`SENTRY_WORKER_AUTO_MERGE=1` under the owner's 2026-11-23 instruction. Expired or
stale tickets block merging. Without that flag the code defaults to
`ready_for_review` and `releaseWorkPending: true`.

The merge flag does not perform the required Jest upload or applicable backend
release. Repairs merge into `main`; release commands use that same source branch. These remain separate release
operations; no post-merge coordinator is currently configured.

## Jest and Facebook verification scope

The owner's 2026-11-23 scope is Jest and Facebook. Their Production readiness
workflow uses `check:types:jest-facebook`, `test:coverage:jest-facebook`,
`build:jest-facebook`, and `test:e2e:jest-facebook`. Shared unit coverage and
security checks remain required; backend emulator coverage runs on Node 22.
Android coverage thresholds and the default full-platform commands are unchanged,
but parked client targets do not gate these web repairs.

The scoped browser plan selects the hosted/Facebook portions of mixed harnesses
and rejects unknown command leaves until their scope is reviewed. The manual
readiness workflow runs the complete browser suite once, without a shard matrix.
The plan command can still list one shard without launching it:

```sh
pnpm exec node scripts/web/run-jest-facebook-browser.mjs --shard 1/4 --dry-run
```

Only the two production artifacts are built and passed to HTML validation.
Changing this workflow does not change the worker's exact successful PR-head,
current-deployment, base-SHA, ticket or merge-SHA checks.

Repository Actions and workflows remain disabled unless a hosted run is explicitly
authorized. Source workflows accept only manual dispatch with the runner-usage
confirmation gate. The worker does not enable Actions or bypass required checks;
automatic merging remains pending when matching successful PR-head evidence is
unavailable. See [Actions cost controls](../common/development/github-actions-cost-controls.md).

The [platform source migration](../common/architecture/platform-layout.md) changes source paths and the
repair allowlist, not the deployed worker revision recorded above. Deploying those
worker changes is a separate operation. All worker development and automated
repair PRs use `main`, with a signed main base. The repair
agent follows `AGENTS.md`, including the requirement that tests and browser harnesses
run only when explicitly requested.

The service never deploys Functions, uploads or activates Jest, publishes the game,
submits review, or marks Sentry issues resolved. Release operations remain separate.

## Configuration

Store secrets only in the dedicated service project. Never log their values.

| Name | Purpose |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | Dedicated read credential for this Sentry organization/project with issue and event access. Prefer a new read token over the existing administrative token. |
| `SENTRY_WEBHOOK_SECRET` | Sentry integration signature secret. |
| `SENTRY_WORKER_GITHUB_TOKEN` | Repository-limited fine-grained token: Contents and Pull requests read/write, Actions read. Stays in the Vercel function. |
| `OPENAI_API_KEY` | Paid isolated repair execution. |
| `CRON_SECRET` | Cron authentication and scoped repair-ticket signatures. |
| `SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT` | Dedicated reader account JSON. `sentry-deployment-reader@riddle-quest-ec2b2.iam.gserviceaccount.com` needs only `roles/cloudfunctions.viewer`. OAuth uses the API's documented `cloud-platform` scope; IAM enforces read access. |
| `JEST_MCP_ACCESS_TOKEN` | Optional separately authorized OAuth access token for a dedicated Jest account with read-only MCP access. Needed for previews, not active production. Never reuse the connected assistant's credentials. |
| `SENTRY_WORKER_JEST_PREVIEW_IDS` | Comma-separated explicitly authorized preview IDs, empty by default. |
| `WORKER_NOT_BEFORE` | Poll issue `lastSeen` cutoff. Default `2026-09-20T00:00:00Z`; set deliberately on restoration. |
| `SENTRY_WORKER_URL` | Canonical HTTPS webhook/check endpoint. Defaults to Vercel's production project URL plus `/api/sentry-webhook`. |
| `NODEJS_HELPERS` | Set `0` to preserve raw webhook bytes. |
| `SENTRY_WORKER_SOURCE_SHA` | Nonsecret committed source SHA for CLI deployments without Git integration. Health prefers Vercel's Git SHA when present. |
| `TARGET_BRANCH` | Optional, only `main` is accepted. |
| `SENTRY_WORKER_AUTO_MERGE` | Production is `1`, explicitly authorized on 2026-11-23. Merges only after the exact CI head and current deployment/base checks pass. Unset defaults to review-only. Release operations remain separate. |

Jest access tokens expire after one hour. This service does not store or rotate
OAuth refresh credentials. Preview repairs expire closed when their token expires;
continuous preview repair needs a separately authorized renewable OAuth setup.
Active Jest production and Functions authority operate independently of that token.

## Verification and restoration

Run `npm run check:configuration` from `tooling/sentry-worker`, providing credentials
through the process environment. It performs read-only Sentry issue/event, GitHub
workflow, Functions and Jest authority probes. It prints presence booleans,
availability and deployment identifiers, never credentials or raw events/HTML.
Exit 1 means incomplete required configuration. It does not spend model credits
or test write access by mutating anything.

Run `npm test` for focused behavior checks. Deploy with the dedicated project root
`tooling/sentry-worker`; committed configuration uses Node 24 and
`npm ci --ignore-scripts`. `.vercelignore` excludes `.vercel/**`, `.env*` and
`node_modules/**`, including the local reader key. Inspect the current deployment
before replacing it, then record the new deployment ID and source commit.

The SDK is pinned exactly to `@vercel/sandbox@4.0.0`. Code deployment `23a748ed5`
was READY but failed at runtime before handling requests: version 4.1.0 introduced
CommonJS `@vercel/drives@1.0.0`, whose synchronous require of ESM-only
`@workflow/serde` fails under Vercel's Node 24 instrumentation. Version 4.0.0 keeps
the worker's create/writeFiles/runCommand APIs without that dependency. The
regression test imports the actual installed SDK with
`--no-experimental-require-module`, reproducing the deployed restriction. Revisit
the pin when the upstream Drives module boundary is compatible, then verify the
real deployed artifact before enabling repairs.

After authorized deployment verify public health/source revision, invalid-signature
rejection, a signed webhook with noncanonical JSON whitespace, and an authenticated
poll. Health reports configuration presence rather than successful authentication;
check the readiness probes and per-issue poll `outcomes`. A public code deployment
without secrets must report `not_configured` and reject work with HTTP 503.
Blocked checks and webhooks must not create branches or paid runs. Inspect Vercel
logs and PR/workflow records for blocked repairs. Review stale PRs rather than
bypassing their deployment checks. Revoke superseded credentials after verification.

Official contracts: [Jest MCP](https://docs.jest.com/dev-console/mcp.md),
[Jest builds](https://docs.jest.com/dev-console/builds.md),
[Functions list](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/list),
[Function revision fields](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions),
[Sentry issue event](https://docs.sentry.io/api/events/retrieve-an-issue-event/),
[Vercel raw request configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).
