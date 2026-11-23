# Firebase usage investigation, 16 October 2026

## Finding

At investigation time, the deployed backend incurred substantial cost without players. Production had 42 Cloud Run function services configured with a minimum of one instance each. All 42 had 1 vCPU, 256 MiB memory and request-based CPU allocation. Twenty were in `europe-west1` and 22 were in `us-central1`.

At Google's retrieved GBP catalogue rates, this configuration costs approximately **£8.55 per day**, or **£264.92 for 31 days**, in idle capacity before credits, tax, active processing and other services. This is a configuration-based estimate, not a reconciliation of the user's £100 charge.

The HTTP requests investigated come from deployed Google Cloud Scheduler jobs. All **7,244 Cloud Run request-log entries** in the complete 48-hour extract identify `Google-Cloud-Scheduler` as the user agent, and their destinations and cadence match the enabled jobs. No game-client HTTP requests appear in this extract.

The investigation phase was read-only against production. The subsequent user-authorized changes are complete: zero reserved minimum instances, seven recurring jobs removed, six retired function resources deleted and regional 09:00 Daily scheduling deployed. See the [remediation and verification record](firebase-demand-only-2026-10-16.md).

## Scope and evidence

- Project: `riddle-quest-ec2b2`.
- Request window: 14 October 2026, 04:00 UTC, inclusive, to 16 October 2026, 04:00 UTC, exclusive. In London, this is 05:00 BST on both dates.
- Cloud Logging query: `resource.type="cloud_run_revision" AND log_id("run.googleapis.com/requests") AND timestamp>="2026-10-14T04:00:00Z" AND timestamp<"2026-10-16T04:00:00Z"`.
- Retrieval limit: 100,000 entries; actual result: 7,244. The last 24-hour request count, 3,621, also matches Cloud Monitoring's independently retrieved `run.googleapis.com/request_count` sum.
- Deployment inventory: 123 Cloud Run services across the project's regions. Both the v1 annotations and v2 scaling configuration identify the same 42 services with `minInstanceCount=1`.
- Local raw extracts and the read-only API script are under `/tmp/riddle-firebase-incident-20261016/`. Credentials were kept inside the requesting process and were not printed. Raw request IPs and email headers are not copied into this report.

## Where the HTTP calls come from

| Function or service | Configured schedule | Calls in 48 hours | Purpose |
| --- | --- | ---: | --- |
| `replenishClassicSupply` | Every minute | 2,879 | Discover and process queued riddle-supply jobs. An invocation does not necessarily generate riddles. |
| `settleRaceDeadlines` | Every minute | 2,878 | Settle overdue races and recover pending result delivery. |
| `monitorRaceRecoveryHealth` | Every five minutes | 576 | Query race recovery health and record aggregate warnings. |
| `reconcileRaceMatchProjections` | Every five minutes | 575 | Check maintenance configuration and reconcile enabled race projections. |
| `dailyChallengeScheduler` | At minute 0 and 30 each hour | 96 | Prepare or validate daily challenges for eligible locale dates. |
| `redditProfileRetentionScheduler` | Hourly at minute 29 | 144 | Clean retained Reddit profile data. All calls returned HTTP 500; two retries turn 48 scheduled executions into 144 requests. |
| `facebookContextRetentionScheduler` | Hourly at minute 17 | 48 | Clean expired Facebook context data. |
| `riddle-quest-monitoring` | Hourly | 48 | Read deployment inventory and request logs and update the monitoring snapshot. |

The seven Firebase jobs use the project's default compute service account as their configured OIDC identity. The monitoring job uses the dedicated `deployment-monitor` service account. The IPs in the logs are scheduler infrastructure; they do not identify human players.

Source definitions include [Classic supply](../../../../firebase-functions/src/riddles/classicSupplyWorker.ts), [race settlement](../../../../firebase-functions/src/race/raceSettlementJobs.ts), [recovery monitoring](../../../../firebase-functions/src/race/raceRecoveryHealth.ts), [reconciliation](../../../../firebase-functions/src/race/raceProjectionReconciliation.ts), [daily challenges](../../../../firebase-functions/src/daily/dailyScheduler.ts), [Reddit retention](../../firebase-functions/src/reddit/redditProfileRetentionScheduler.ts), and [monitor deployment](../../tooling/deployment-monitor/deploy.sh).

The Reddit retention error sample reports `Reddit profile retention failed; inspect aggregate page evidence.` The underlying record or dependency failure was not established by that generic error. Its retry traffic is a secondary defect, not enough to explain £100 by request counts alone.

## Why costs continue without HTTP game traffic

The 42 warm functions are 20 duplicated gameplay/race functions in both regions, plus US-only `exchangeJestIdentity` and `redditGameplay`.

The duplicated functions are `abandonRaceRun`, `completeGame`, `findRaceMatch`, `getClassicRiddleBuffer`, `getCurrentDailyChallenge`, `getHint`, `getRaceOutcome`, `joinLiveRace`, `listRaceCategories`, `listRaceInbox`, `readyRaceRun`, `recordRaceAnalytics`, `requestRaceHint`, `resumeRaceRun`, `retireLiveRaceJoin`, `skipRaceRiddle`, `startRaceRun`, `submitRaceGuess`, `submitSinglePlayerGuess` and `updateLiveRace`.

Warm-instance policies are present in [gameplay callable options](../../../../firebase-functions/src/shared/gameplayCallableOptions.ts), [race callables](../../../../firebase-functions/src/race/raceCallables.ts), [live-race callables](../../../../firebase-functions/src/race/raceLiveCallables.ts), [Jest endpoints](../../firebase-functions/src/jest/jestEndpoints.ts), and [Reddit gameplay](../../firebase-functions/src/reddit/redditGameplayEndpoint.ts). Commit `f06f4c5fd` is titled `Cut cold starts and startup latency for solo and live play`. The live deployment inventory, rather than current source alone, establishes what is billed now.

Production metering corroborates continuous capacity. In the final 24-hour window, `run.googleapis.com/container/billable_instance_time` totals 3,633,619.94 instance-seconds. Forty-two instances for one day is 3,628,800 seconds. Memory allocation totals 908,523.44 GiB-seconds, consistent with approximately 42 continuously allocated 256 MiB instances plus scheduled processing. These are usage metrics, not billed currency amounts.

The daily billable-instance equivalent increased from about 29 on 3–7 October to about 42 by 8–9 October, and remained near 42 after HTTP request volume fell to approximately 3,600 per day. Those periods use aligned 24-hour windows ending at 04:00 UTC.

Google's GBP Cloud Run price catalogue, retrieved during this investigation with effective time `2026-10-15T07:00:00Z`, lists both applicable minimum-instance rates as £0.000001884 per unit-second. Both deployed regions are covered by these rates.

```text
42 instances × 86,400 seconds/day ×
  (1 vCPU × £0.000001884 + 0.25 GiB × £0.000001884)
= £8.545824/day before credits and tax
```

Catalogue SKUs: `7EBB-8579-2C98`, Services Min Instance CPU, and `740D-08F2-7A11`, Services Min Instance Memory. [Google's pricing documentation](https://cloud.google.com/run/pricing) explains idle minimum-instance charges.

## Billing alert and public deployment

The [£100 budget alert](https://mail.google.com/mail/u/0/#all/1a13f84fd97d41b2), received on 15 October, names this project and the October monthly budget. A later alert uses £10; the current budget configuration also shows £10. A budget threshold does not establish an individual service's cost breakdown.

No BigQuery billing-export dataset was returned in this project, and no authenticated billing-console browser was available. Consequently, the exact service/SKU composition of the £100 was not independently reconciled. The observed warm capacity is sufficient to explain a charge of that order and establishes an ongoing expense.

Firebase Hosting still has an active deployment from 22 September. A plain HTML fetch, without executing JavaScript, returned HTTP 200 and title `Riddle Quest` from `https://riddle-quest-ec2b2.web.app`. This proves a public page remains reachable; it does not prove that every game feature works outside its intended provider.

## Compromise assessment

No evidence of external game-client callers appeared in the investigated 48-hour Cloud Run logs. In the final 24-hour consumed-API metrics, Firestore commit calls are attributed to the project's default compute service account. An October administration-audit sample contains the owner's account and Google-managed service identities. That sample hit its 15,000-entry limit and is not a complete audit of October.

The deployed Firestore rules deny direct client access to the riddle catalog and race state, and deny client writes to player economy/progression records. Some reads remain available under their specific rules, including public product pricing. App Check is currently `UNENFORCED` for Firestore and Authentication. API-key restrictions could not be inspected because the API Keys management API is disabled. It was not enabled as part of this read-only investigation.

Cloud Run logs do not cover every possible direct Firebase API call. These findings identify the observed requests and a substantial cost cause; they do not certify that every credential is uncompromised. Firebase browser API keys are project identifiers, and access protection depends on rules, authentication and App Check. See [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys).

## Recommended next actions

1. Set the 42 deployed minimum-instance counts to zero for the prelaunch environment, and update source configuration so a subsequent Firebase deployment preserves that policy. First requests after idle will incur a cold start.
2. Pause race and content-generation schedules that are unnecessary before launch. Retain required privacy cleanup, and repair the Reddit retention failure rather than leaving it in an hourly retry loop.
3. Remove or replace the public Hosting deployment if the game must not be reachable there.
4. Review the billing report grouped by SKU to reconcile the £100. Check idle minimum-instance CPU and memory first. Monitor billable instance time after applying the capacity change.
5. Review API-key restrictions and App Check compatibility separately. Do not rotate the public browser key as a substitute for fixing the observed running-capacity cost.
