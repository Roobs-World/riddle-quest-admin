# Deployment engagement and performance

The dashboard at `docs/reports/platform-release-readiness` tracks six game targets,
with separate deployment-level reports, game-wide Jest activity and automatically
collected backend request performance. Missing gameplay measurements remain
unavailable; backend requests must never stand in for players or sessions.

## Automatic cloud collection

`tooling/deployment-monitor` runs as the private Cloud Run service
`riddle-quest-monitoring` in `riddle-quest-ec2b2/us-central1`. Cloud Scheduler job
`deployment-monitor-hourly` calls it hourly at minute zero UTC using an OIDC service
account. It runs independently of the dashboard and this workstation.

Each run discovers current Cloud Run backend revisions and reads the complete prior
24 hours of request logs. Reports include revisions with traffic and current ready
revisions with no observed requests. Metrics are request counts, HTTP 2xx/4xx/5xx,
latency sample counts and nearest-rank server-latency p95. Retired revisions retain their last observed 24-hour report, labelled Historical
with the original window end. This is one latest report per observed revision,
not a full hourly time series. Traffic includes probes,
rejected calls and preflights; it is not game engagement or launch performance.
The collector's own service is excluded. Target classification follows backend
service names, with unclassified services shown as Shared backend.

The service stores aggregate snapshots in the private bucket
`riddle-quest-monitoring-ec2b2`. It never stores request URLs, player identifiers or
raw request logs. Generation preconditions and an expiring collection lease prevent
concurrent writes. Partial/failed reads preserve the last successful snapshot.
Collection health and last success appear in the dashboard; backend data older
than two hours is flagged. An open cloud dashboard polls its snapshot every minute.

Jest has a renewable OAuth collector for its native `dau_summary` report. The
connection is **pending user sign-in**, so its current chart is still the reviewed
22 August–19 September 2026 snapshot. The provider supplies no deployment dimension
or reporting timezone; even automatic reads must stay separate from build metrics.
Other game engagement and browser performance exporters are not connected. YouTube
and Netflix also require partner access before live provider reporting is available.
This is partial automatic coverage, not full engagement monitoring for every target.

No game analytics SDKs or provider contracts were changed. YouTube, Netflix and Yahoo
candidate bundles remain self-contained; Reddit browser traffic remains same-origin.
Existing Sentry error reporting (`tracesSampleRate: 0`) does not establish gameplay
session counts or launch timings.

## Operate and verify

```bash
# Deploy the collector and built dashboard, configure Scheduler, trigger a run.
bash tooling/deployment-monitor/deploy.sh

# View the private dashboard with your existing gcloud identity.
node tooling/deployment-monitor/preview.mjs
# Open http://127.0.0.1:4179

# One-time renewable Jest authorization; complete the browser consent.
node tooling/deployment-monitor/connect-jest.mjs
# Open the URL in /tmp/riddle-monitor-jest-authorization-url.txt

# Trigger collection and inspect Scheduler's execution status.
gcloud scheduler jobs run deployment-monitor-hourly --project riddle-quest-ec2b2 --location us-central1
gcloud scheduler jobs describe deployment-monitor-hourly --project riddle-quest-ec2b2 --location us-central1
```

On this workstation, the installed gcloud exits 120 when its output is redirected
directly to a `/tmp` file (also reproduced with `gcloud version`). Run the deploy
command normally; if capturing output, use a pipe to `tee` with `set -o pipefail`.

The local viewer only forwards authenticated reads; it does not schedule collection.
Cloud Run rejects unauthenticated reads and writes. OAuth tokens stay in the private
bucket, never in dashboard JSON, the repository or logs. The dedicated bucket does
not grant project viewers object-read access. No email/Slack alerts are configured;
failures are visible in Scheduler and the dashboard.

## Import reviewed measurements

Prepare a JSON array of aggregate records. Each record requires `platform` (Jest,
Facebook, Reddit, YouTube, Netflix or Yahoo), the exact `deployment` identifier,
`environment`, a completed UTC `date` (`YYYY-MM-DD`), UTC `collectedAt` timestamp,
and a `source` naming the reviewed provider export or query. Optional `nextStep`
records a follow-up. Never include credentials or player identifiers.

Optional numeric fields (omit or use null when unavailable):

| Field | Definition |
| --- | --- |
| activePlayers | Distinct players with a gameplay action in that deployment/day |
| sessions | Provider-counted sessions in the same population |
| gamesStarted / gamesCompleted | Games started that day and those games completed |
| engagedSeconds | Total active gameplay seconds for those sessions |
| loadSamples / loadP95Ms | Launch samples and provider-computed launch-to-playable p95 in milliseconds |
| errorSessions / observedSessions | Sessions with at least one runtime error and all error-monitored sessions |

Attribute records to the actual deployed version, not merely a host or target. Export
only measurements matching these definitions; otherwise leave them unavailable.
Keep partial telemetry denominators separate from total sessions. Distinct players
and percentiles are never summed or averaged across deployments or days.

From the repository root:

```bash
node scripts/monitoring/import-deployment-metrics.mjs /path/to/reviewed-provider-report.json
pnpm --dir docs/reports/platform-release-readiness build
```

To publish the reviewed report directly to the running private dashboard:

```bash
node scripts/monitoring/publish-deployment-metrics.mjs /path/to/reviewed-provider-report.json
```

This uses your existing gcloud identity and validates against the latest cloud snapshot.
It preserves backend and Jest reports. A generation conflict fails safely; rerun the
command to read the new snapshot. The open dashboard refreshes within one minute.
An authorized provider exporter can invoke the same command after preparing its report;
provider exporters still need to be connected.

The import validates the entire batch before writing, replaces matching daily rows,
retains previous deployments/days, rejects duplicate keys and older evidence, and
removes a missing-coverage row only for its matching deployment/environment.
Every new deployment can be added by importing its first report. New deployments
without reports must also receive a null coverage row when release evidence is updated;
there is currently no automatic provider release discovery.

Filters apply to engagement, performance and coverage together, including copied
data and source inspection. All days remain visible unless filtered. Coverage is
stale once a reporting day ended more than 48 hours ago. These imported game reports remain a separate workflow. The import command updates
the local snapshot; the publish command updates the cloud snapshot. Later hourly
backend and connected Jest collections retain these deployment reports.

The dashboard is an English evidence document; the game's 17 locale bundles are
unchanged. Validation: importer/calculation tests, dashboard tests and protected
runtime integrity, rendered desktop/mobile filtering, and six isolated target builds.
