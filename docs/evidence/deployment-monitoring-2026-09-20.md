# Deployment monitoring verification — 20 September 2026

## Outcome

The dashboard's 24 previously failing tests are fixed. The complete suite passes
558/558 tests. Starter-specific assertions use versioned fixtures instead of the
custom Riddle Quest content; runtime assertions still exercise the actual copied
runtime. The missing SourcesReceipt icon is now bundled locally. Scoped protected
changes were authorized through the repository script; all 140 protected files pass
integrity verification.

Automatic backend performance collection is deployed and verified. Full automatic
engagement coverage for every game deployment remains incomplete. No unavailable
player counts, session denominators or launch timings have been fabricated.

## Cloud evidence

- Project/region: `riddle-quest-ec2b2/us-central1`.
- Private Cloud Run revision: `riddle-quest-monitoring-00003-8vv`, 100% traffic.
- Scheduler: `deployment-monitor-hourly`, enabled, `0 * * * *`, UTC.
- Scheduler execution invoked through the actual job: `2026-09-20T17:21:08.428058Z`;
  Scheduler status `{}` (OK).
- Durable snapshot collection after the final revision: `2026-09-20T17:27:16.301Z`; status `Succeeded`.
- Snapshot: 68 backend revisions, 118 observed requests in the prior 24 hours.
- Jest collector status: `Connection required`. Renewable OAuth requires user
  sign-in; current provider activity remains the explicitly labelled manual report.
- Unauthenticated `GET /api/snapshot`: HTTP 403.
- Bucket has uniform access and public-access prevention. Monitor service account
  has log/inventory read and bucket object access. Default project-viewer object
  access was removed from this dedicated bucket before provider credentials are stored.
- Successful scheduled calls were manually triggered to verify the real Scheduler
  OIDC path. The next ordinary hourly execution had not occurred at capture time.

The initial Scheduler permission error resolved after IAM propagation. The first
container build omitted generated HTML because of ignore rules; an explicit
`.gcloudignore` fixed the upload. The final idempotent deployment script completed
successfully, including job update and collection.

## Browser verification

Authenticated local viewer at `http://127.0.0.1:4179` forwards to private Cloud Run.
Injected browser session `riddle-monitor` checked 1440×900 and 390×844. Neither had
page-level horizontal overflow; the backend table scrolls inside its container.
Selecting Jest in the backend target filter rendered five Jest service revisions.
The source drawer displayed request-count/latency definitions and the actual Cloud
Logging and Cloud Run inventory sources.

Without a page reload, the rendered last-success timestamp advanced from
`17:13:07.100Z` to `17:18:16.717Z` after a Scheduler run, proving minute polling.
The final cloud revision was opened again after deployment, including the new
report-status and window-end columns. Screenshot captured at
`/tmp/riddle-monitor-mobile.png` (temporary local verification artifact).

## Automated checks

- Dashboard tests: 558 passed, zero failed or skipped.
- Cloud collector tests: 9 passed, including pagination completeness, duplicate
  suppression, latency grouping, generation guards, last-good retention, OAuth
  refresh ordering, explicit missing-connection behavior and retention of retired
  revision reports with their original reporting window.
- Importer/calculation and cloud publication tests: 6 passed.
- Dashboard production build and protected-runtime integrity passed.
- Jest, Facebook, Reddit, YouTube, Netflix and Yahoo isolated builds and artifact
  audits passed; Reddit Devvit package contract passed.
- `git diff --check` passed.

Temporary check logs: `/tmp/riddle-monitor-dashboard-final-tests.log`,
`/tmp/riddle-monitor-six-builds.log` (Jest/Facebook/Reddit),
`/tmp/riddle-monitor-youtube.log`, `/tmp/riddle-monitor-netflix.log`,
`/tmp/riddle-monitor-yahoo.log`, `/tmp/riddle-monitor-reddit-package.log`.

## Remaining access and data gaps

Jest's OAuth consent must be completed to enable unattended native daily activity
reads. The initial session reached Google sign-in and expired without consent;
it must be restarted when the user is ready. Its current analytics response has no build dimension, so this alone cannot
supply deployment-level engagement. Other providers need compatible reporting feeds
with actual deployment identifiers. YouTube/Netflix partner reporting access is
unavailable. Client telemetry has not been added to restricted artifacts.

The local import command updates reviewed local data; the cloud publication command
now validates and merges the same reports into the running dashboard. Tests cover
preserving other collector data and rejecting concurrent generation changes. No real
deployment-level report was available to publish. Backend automatic inventory covers current
ready revisions and older revisions with traffic, and now retains each retired
revision’s last observed report. It is not a complete hourly time-series archive. No outbound alert destinations are configured.

See `docs/deployment-monitoring.md` for operation and metric definitions.
