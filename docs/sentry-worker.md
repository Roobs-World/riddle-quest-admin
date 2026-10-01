# Sentry repair worker on Vercel

Status (2026-09-20): **active in production**.

Webhook URL: **https://riddle-quest-sentry-worker.vercel.app/api/sentry-webhook**

The dedicated Vercel project riddle-quest-sentry-worker
(prj_zl5LSir4sh7lWUVq4XlsBRubGuCG) runs on the Pro team
craig-beswethericks-projects-d44935d2. Production deployment
dpl_FWPR6LhTwKyZE79W67w7N2pSNBis is ready. Its public health endpoint returns
status active; unsigned webhook requests return HTTP 401.

The worker watches Sentry organization roobs-world-limited, project
riddle-quest (4511885926006864), and repairs Grindhead/riddle-quest. Vercel
invokes the reconciliation endpoint hourly at minute zero. Signed Sentry issue
webhooks can start a repair sooner.

## Behavior

1. Webhooks are verified with SENTRY_WEBHOOK_SECRET before JSON is trusted.
   Cron requests require Vercel's CRON_SECRET bearer token. Events from other
   Sentry projects are ignored.
2. The worker retrieves a small, sanitized issue summary from Sentry. It never
   sends user context, breadcrumbs, request data, or raw event payloads to the
   coding agent.
3. A deterministic codex/sentry-<issue-id> branch is created through the GitHub
   API before paid work starts. Atomic ref creation deduplicates retries and
   overlapping cron invocations.
4. Vercel starts a one-hour, four-vCPU isolated Sandbox from that branch. Codex
   reads AGENTS.md, diagnoses the issue, makes a focused fix, and runs relevant
   tests plus all six required target builds and UI harnesses.
5. If code changed, the runner commits and pushes the branch and opens a pull
   request against jest. It waits for all three Production readiness jobs. Any
   missing, timed-out, cancelled, or failed job stops the release.
6. After every required check succeeds, the worker squash-merges the exact
   checked commit and dispatches Upload and activate Jest build. That workflow runs its
   own immutable production gate again before uploading and activating the exact
   build. Facebook, Reddit, and YouTube remain on their required manual handoff
   paths. The worker never marks a Sentry issue resolved.

Only SENTRY_AUTH_TOKEN, SENTRY_WEBHOOK_SECRET, SENTRY_WORKER_GITHUB_TOKEN,
OPENAI_API_KEY, CRON_SECRET, and WORKER_NOT_BEFORE are stored in the dedicated
production project. The game artifacts do not receive them. Both service tokens
were validated against the exact project and repository before activation.

WORKER_NOT_BEFORE is 2026-09-20T00:00:00Z, so hourly polling does not create
duplicate repairs for historical issues triaged during setup. A newly received
signed webhook remains eligible immediately.

## Operations

Inspect deployments and runtime logs in the dedicated Vercel project. Repair
branches use the codex/sentry-<issue-id> prefix; the pull request and production
workflow are the durable records. A reserved branch without a pull request means
the isolated run failed and needs investigation before that branch is deleted
and retried.

Rotate the GitHub fine-grained token before its expiry and keep its access
limited to Grindhead/riddle-quest, with Contents and Pull requests read/write.
It also needs Actions read-only so the worker can enforce the production gate.
Rotate the Sentry integration secret if the public integration is recreated.
