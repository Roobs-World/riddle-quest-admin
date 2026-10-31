Final authorized anonymous approved-Origin identity OPTIONS check: 2026-10-22T21:50:12.813018Z, HTTP 500, total 0.199456 seconds. The startup blocker remains reproduced; no further health requests or mutations were made. Exact sanitized response is saved in final-health-check.json.

Hosted startup is blocked by reproducible HTTP 500 responses from the Google Frontend before normal Jest endpoint responses. The same fault affects the original hosted game, the new journal artifact and the official Simulator. An anonymous request with no session, identity or purchase body reproduces it outside the game.

Project: `riddle-quest-ec2b2`. Region: `us-central1`. Date: 2026-10-22 UTC. No backend deployment or configuration change was made during this investigation.

Observed requests:

- `exchangeJestIdentity`, revision `exchangejestidentity-00053-wor`: original OPTIONS failures at 21:28:45.981654, 21:28:57.663813 and 21:29:02.877305 UTC. All HTTP 500 with a present raw latency field of `0s`.
- `grantJestPurchase`, revision `grantjestpurchase-00051-num`: POST failures at 21:29:41.595267 and 21:30:18.788526 UTC. Both HTTP 500 with a present raw latency field of `0s`.
- Anonymous approved-Origin OPTIONS to the configured cloudfunctions.net identity endpoint at 21:34:58 UTC: HTTP 500 in 0.224931 seconds.
- Anonymous identical OPTIONS directly to that function's current a.run.app service URI at 21:35:25 UTC: HTTP 500 in 0.492373 seconds. The cloudfunctions.net routing alias alone is therefore not the cause.
- One permitted identity preflight recheck around 21:39 UTC: HTTP 500 in 0.228290 seconds.
- Current control: anonymous OPTIONS to `syncJestSubscriptions` at 21:40:23 UTC also returns HTTP 500 in 0.218285 seconds. Earlier successful subscription POSTs ran 21:00:06–21:05:16 UTC and do not overlap the failure window. There is no verified healthy concurrent service control.

Every anonymous failure returned `server: Google Frontend`, HTML content, no allow-origin header, and the generic server-error page asking the caller to try again in 30 seconds. A later originless OPTIONS comparison, with no Origin, Access-Control-Request headers, body or credentials, also returned the identical Google Frontend HTTP 500 in 0.352682 seconds. Source normally rejects that request as JSON 403; approved-Origin preflights normally receive 204. The deployed public game ID matches the tested build origin, which is added to the allowlist alongside the configured https://jest.com origin. Source jestHttpOptions sets no SDK CORS option; onRequestWithSentry forwards those options unchanged. Thus an Origin-specific mismatch or preflight-header combination is not necessary to reproduce the outage. See the exact response bodies and server Date headers in `anonymous-preflight-reproductions.json`. No request tokens, player data, query strings, IP addresses, cookies or service-account identities are retained.

The evidence points to a serving/provisioning failure before normal application handling. This is an inference from the immediate generic response, raw zero-second request logs, failed OPTIONS requests and absent container/application logs; the provider has not supplied an internal cause. An approved-Origin OPTIONS normally returns 204 before JWT parsing, Firestore or purchase grants. Invalid identities normally return 401 and invalid purchases 400. Expired sandbox signatures cannot explain the anonymous OPTIONS failure.

Read-only checks completed:

- Both failing functions are ACTIVE; Cloud Run Ready/RoutesReady/ConfigurationsReady are True; 100% traffic remains on unchanged Oct 18 revisions.
- Project lifecycle ACTIVE; project billingEnabled true. Root additionally inspected the linked paid account and fully loaded Budgets & caps page: existing budgets show Spend cap status Not applicable; Billing and Run show no suspended or spend-cap banner. Budget-alert overruns are not enforced caps. No account IDs or amounts were saved and no billing settings changed.
- Public `allUsers` Run Invoker binding exists; ingress ALLOW_ALL; maximum instances 20, concurrency 80, CPU 1, memory 256Mi, timeout 60 seconds.
- Runtime account is enabled. Its required unconditional Secret Accessor binding exists; bound JEST_SHARED_SECRET version 2 is enabled. No secret contents were read.
- Google Run, Functions and Artifact Registry service-agent role bindings are present. Their active/disabled state could not be read: iam.serviceAccounts.get on those Google-owned accounts is denied. No IAM changes were made.
- No policy-denial audit events were returned in the checked window. No container/system/application messages were emitted by the two failing services after 21:25 UTC. Successful startup probes previously occurred around 20:28 UTC for identity/subscriptions and 20:32 UTC for purchases.
- Failing and previously healthy services have the same runtime account, bound secret version, resources and startup probes.
- Old Artifact Registry image references no longer resolve for all three services. This does not establish a defect: Google documents that Cloud Run imports and retains the image for serving revisions and does not pull from the repository when starting instances. No image rebuild or retention change is justified by that finding.
- Personalized Service Health is not enabled. No API was enabled to read it. The global status page check performed by root showed no broad severe incident; a project-specific or regional fault remains possible.

Regional quota checks used existing enabled Monitoring and Service Usage APIs, with no API enablement, installation or quota changes. Both Run and Functions report us-central1 CPU quota 200,000 milli-vCPU (200 vCPU) and memory quota 429,496,729,600 bytes (400 GiB). The configured per-service max 20 is distinct from regional quota and utilization. All returned failed-period instance-count samples are zero active/idle; reported CPU allocation-time (CPU-seconds) and memory allocation-time (GiB-seconds) deltas are also zero. Direct quota-rate metrics show release of 1 vCPU and 256 MiB at 21:20–21:21 UTC, with no later positive CPU/memory allocation event returned. This is a net-change metric, not an absolute usage gauge. No quota-exceeded series was returned; direct quota allocation/usage returned no series. The separate run.googleapis.com/instances metadata does not provide a usable autoscaled-functions regional limit, so no zero-instance-quota claim is made.

These measurements do not support running-resource quota exhaustion or a capacity increase. They are minute-sampled and subject to ingestion delay: the 21:45–21:46 snapshot has latest points around 21:44–21:45. Gaps were not treated as zero. Short spikes, unexported allocation reservations and Google-side regional capacity failure remain outside this evidence; available project quota does not guarantee regional resource availability. See quota-assessment.json and its underlying quota/Monitoring extracts. [Cloud Run quota definitions](https://docs.cloud.google.com/run/quotas), [Functions quota units](https://docs.cloud.google.com/functions/quotas).

Startup behavior is consistent with the failed server requests. A pending purchase is reconciled before identity completion; if the server grant fails, the client does not call completePurchase. The recovery receipt remains pending for a later successful startup. No purchase acknowledgment or grant was attempted by this diagnostic work. No new journal or SDK retry/capacity change is supported by these findings.

The visible account-level spend-cap/banner check is complete and found no enforcement. Remaining investigation requires Google-side serving/provisioning diagnostics for these exact requests and revisions, or access to Google-owned service-agent account status. No source-level root cause or safe resource mutation has been substantiated. A speculative redeployment would risk deploying unrelated local backend changes and is not a verified repair.

Primary references:

- [Cloud Run deployment/import semantics](https://docs.cloud.google.com/run/docs/deploying): serving image copies survive repository-image deletion.
- [Cloud Run troubleshooting](https://docs.cloud.google.com/run/docs/troubleshooting): instance provisioning, secrets and spend-cap failure categories.
- [Cloud Run known issues](https://docs.cloud.google.com/run/docs/known-issues): recovery after restoring a spend cap or billing can be delayed. This was a conditional diagnostic reference; the visible account check found no enforced cap here.

Evidence files: `cloud-run-http-sanitized.json`, `request-counts.json`, `anonymous-preflight-reproductions.json`, `read-only-configuration-checks.json`. The HTTP projection preserves only timestamp, severity, service, revision, region, method, status and latency. The existing target-build evidence is separately under `../cross-target-final/`.
