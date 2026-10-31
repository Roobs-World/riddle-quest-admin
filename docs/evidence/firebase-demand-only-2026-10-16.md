# Firebase demand-only capacity and 09:00 Daily rollout

Completed on 16 October 2026 for `riddle-quest-ec2b2`, following the [usage investigation](firebase-usage-investigation-2026-10-16.md).

## Production verification

The final provider readback at 04:39 UTC returned:

```json
{"functionCount":118,"nonzeroMinimumInstances":[]}
{"cloudRunServiceCount":119,"reservedCapacity":[]}
```

Both service-level and revision-template minimum-instance settings were checked for Cloud Run. All 42 previously reserved function instances were changed to zero. Cached idle instances may exist temporarily under Cloud Run's normal lifecycle; zero minimums do not reserve paid idle capacity.

Seven recurring jobs were deleted: Classic supply discovery, race deadline settlement, race recovery health, race projection reconciliation, Reddit profile retention, Facebook context retention and hourly deployment monitoring. Provider readback shows only `firebase-schedule-dailyChallengeScheduler-us-central1` remaining, enabled with UTC cron `0,30 0,2,3,6-9 * * *`.

The six retired scheduled Firebase function resources were also deleted: `replenishClassicSupply`, `settleRaceDeadlines`, `monitorRaceRecoveryHealth`, `reconcileRaceMatchProjections`, `redditProfileRetentionScheduler` and `facebookContextRetentionScheduler`. Provider readback confirms none remain. Their exports and scheduler registrations were removed from source. All 23 affected replacement and gameplay function instances report `ACTIVE`.

The monitoring service remains private and available on demand. Its deployment script no longer installs or runs an hourly job. No analytics SDK was added to any game target.

## Daily ownership and clocks

The user confirmed keeping the existing language-based regional clocks. Each challenge day now begins at local 09:00. Before 09:00, the preceding dated challenge remains current. The shared calendar drives loading, progress, streaks, active-session eligibility, completion grace and client preload invalidation, including daylight-saving changes. The legacy internal UTC clock retains midnight compatibility.

The single daily scheduler covers the existing Europe/Asia language clocks, including India's half-hour offset. Its 14 daily dispatches generate only when a configured clock reaches exactly 09:00; unused slots do no content work. Two failure retries retain the original scheduled instant. No periodic repair window remains. Generation starts at the scheduled boundary; playable availability follows successful generation.

Daily loads accept only a supported language, optional response-format flags and paired opaque session/riddle recovery identifiers. Unknown fields such as caller-supplied dates, clues and answers are rejected. Loading selects the server's dated document, checks its identity/language and issues an account-owned immutable session. Guess and completion authority remains server-owned. Completion entitlements remain keyed by player and daily date across languages, preventing duplicate rewards for that date.

See the amended [Daily clock decision](../adr/0005-locale-daily-midnight.md).

## Activity-triggered background work

Classic replenishment now starts from a server-created supply request instead of a minute-by-minute queue scan. The existing durable lease prevents overlapping workers from granting duplicate work. Pending or leased jobs remain unacknowledged until completed. Player activity can reactivate an unfinished due job after 24 hours, so a prolonged provider outage cannot permanently strand the deterministic request ID. A separate update trigger observes only that reactivation field and ignores ordinary worker writes. Read-only production inspection found no pending/due jobs requiring migration at rollout.

Clients display race timeouts. Server requests still enforce canonical deadlines and settle outcomes on access. Result/achievement outboxes retain event-driven idempotent delivery. Their event handlers reject pending receipts, including early retries during backoff, so removal of the periodic recovery worker cannot acknowledge unfinished delivery.

Request-time provider expiry, account deletion and manual retention commands remain. Removing retention schedules means untouched expired provider records are not guaranteed automatic physical deletion. Google Analytics does not perform that deletion.

## Deployment and checks

Two explicitly scoped deployments completed successfully:

- Four daily/supply/result worker functions.
- Nineteen affected gameplay/recovery function instances across the existing US and European regions.

These deployment scopes excluded all retired function resources. The Firebase CLI required its failure-policy flag for the new event retry handlers. The six retired resources were deleted separately after the user's request to finish all function changes; that operation passed approval review and all six deletions succeeded. Web artifacts were built locally; no game build was published to a platform or Hosting as part of this work.

Validation passed:

- 141 backend unit suites, 1,798 tests.
- 40 core suites, 436 tests, including regional 09:00 and DST transitions.
- Nine client ownership tests, including language-owned Daily cache invalidation at 09:00.
- Injected production React browser harness, 180 assertions, with external provider traffic blocked.
- All six isolated target builds and artifact audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo.
- Backend build, type checking, lint, deployment-script tests, module-cycle audit, scalability audit and diff whitespace checks.
- Read-only review found and verified the fix for recovery after a prolonged Classic provider outage; no remaining concrete findings.

The new `scripts/audit-function-capacity.mjs` checks source declarations and compiled exported function metadata. Build and deployment validation reject nonzero reserved minimums. Live verification and private deployment logs are retained under `/tmp/riddle-firebase-incident-20261016/`.
