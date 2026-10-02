# Multiplayer production health observation

Read-only Cloud Logging queries completed around 17:40 UTC on October 1, 2026 for project `riddle-quest-ec2b2`. The queries sampled the preceding hour of Cloud Run request logs for service names containing `race`, plus error-level logs for the same service filter. The request limit of 5,000 and error-log limit of 500 were not reached.

The request sample contains 3,304 entries and no HTTP 5xx responses. The separate error query returned no error-level entries. `getraceaccess` includes one HTTP 401; this observation does not establish its cause. The sample covers the named race services, not every provider route or every multiplayer endpoint.

The deadline worker returned HTTP 200 for all 60 observed requests. Its sampled nearest-rank p95 request latency is 1,682 ms, with a maximum of 2,081 ms. The function remains ACTIVE on Node.js 22 revision `settleracedeadlines-00017-zec`.

The projection reconciliation worker returned HTTP 200 for all twelve observed requests. Durations range from 6.9 to 21.6 seconds. Twelve structured completion reports show `processed`, scanning 192 records in total with zero unavailable records and zero changed records. The source configures a five-minute schedule, a maximum of 100 records per invocation, and a 120-second invocation timeout. The observed durations are below that limit; this does not establish the maximum duration under heavier load.

A separate read-only query of the structured recovery monitor returned twelve observations with no warning codes. The latest observation, at 17:41 UTC, reports uncapped zero counts for due deadlines, active deadline retries, deadline quarantine, pending settlement/performance receipts and quarantine in both outboxes. Both outboxes report no invalid sampled enqueue clocks and no stale recovery checkpoint. Projection reconciliation is enabled; its latest page and complete cycle were about 118 seconds old, with no failed page or unavailable-source observations. These are the monitor’s bounded query results at that observation time, not a claim that future queues will stay empty.

Evidence is saved in `artifacts/race-production-health/summary.json`, with request metadata, filtered error metadata, function status and projection report counts beside it. These queries retain only operational metadata and bounded counters, without request bodies or canonical account/game content. The sampled latency calculation is not the Cloud Monitoring alert-policy metric and does not determine the policy's current state.

No production mutation, replay, deployment, Jest upload or publication occurred. The shared-source dashboard receipt remains pending while the other chat continues its hosted E2E work. The multiplayer reliability audit remains active.
