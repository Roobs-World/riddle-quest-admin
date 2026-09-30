# Recorded-race architecture rollout

The candidate lookup reads `raceMatchCandidates`, not the old challenge collection. Existing active challenges require an archive/projection backfill before enabling that lookup in a live deployment. Legacy active challenger runs also require indexed deadlines for unattended settlement. Run both migrations against the intended environment; local implementation does not establish production readiness.

Candidate retrieval now requires `performanceBucket` and `selectionKey`. Deploy both new provider/language/rules/status/bucket/key/expiry indexes (with and without category) and wait for availability before switching this lookup. Re-run the challenge migration for existing projections: it compares every derived field and adds the keys without changing a recording's fixed performance or rebuilding its deck. Older projections missing these fields cannot satisfy the new indexed query.

Deploy the candidate and `(status, deadlineAtMs)` indexes first and wait for their availability. Deploy the compatible backend before shipping clients that send `prepare: true` and `readyRaceRun`. The backend continues to accept older immediately-active starts during client rollout. New clients prepare content, submit readiness, and render the server-scheduled start with a monotonic local time anchor. Readiness permanently fixes the start for that attempt; preparation expires after 30 seconds without a score or reward.

## Backfill

Run one bounded page at a time. Dry-run is the default:

```sh
pnpm --dir firebase-functions race:architecture:migrate --project PROJECT --collection challenges --limit 100
pnpm --dir firebase-functions race:architecture:migrate --project PROJECT --collection runs --limit 100
```

To apply, add `--apply --confirm-project PROJECT`. Continue with `--after NEXT_AFTER_ID` from each successful report until `complete` is true. Keep the cursor from the previous successful page if a page fails; replaying committed records is safe. New publications create projections transactionally, so publication during the backfill cannot introduce an unprojected new challenge. Re-run from the beginning for verification and require no remaining eligible changes; investigate every `unavailable` record.

The migration archives only the creator's stored original deck. It never rebuilds from mutable localized catalog content. Versioned archives hash the exact ordered text, IDs, and accepted answers. Missing originals are reported for investigation. Private scope is derived conservatively from canonical scope, lobby existence, and legacy invitation IDs; these challenges never enter public discovery. Missing private authorization records fail acceptance. Expired/revoked/deleted-creator projections are removed on application. Creator recordings retain their existing no-timeout rules; deadline backfill applies to challenger runs.

Compare canonical eligible challenge counts with projection counts by provider and locale before switching traffic. Monitor search budget exhaustion separately from true empty pools, and monitor deadline/outbox backlog after activating the worker. The worker processes bounded pages; a successful invocation does not establish that the backlog has drained.

## Recovery checks

Verify a pre-existing challenge is discoverable after the backfill, can be accepted once, and uses its original deck after catalog edits or original-run removal. Verify private invitations are excluded. Verify a legacy overdue challenger settles through the worker and repeats do not duplicate creator inbox entries or currency grants. Verify slow preparation does not consume solving time, early guesses fail, and readiness replay preserves `startsAtMs`.

## Failed background records

Deadline processing quarantines unsupported or corrupt canonical run data in `raceDeadlineFailures/{runId}` and removes its scheduling index entry. It preserves the source and never invents an outcome or reward. Diagnostic receipts expire after 90 days; this does not extend the original run's retention. Account deletion removes receipts alongside owned runs. Alert on the `Race deadline requires repair and replay` log and inspect the diagnostic receipt using administrator tooling.

After repairing a still-present canonical source from authoritative evidence, call the backend-only `replayRaceDeadline(db, runId, nowMs)` seam. It validates the source and restores a deadline derived from the original scored start and rules. Missing sources, invalid repairs, and runs without an unattended deadline cannot be replayed. Routine architecture migration preserves both quarantine and transient retry metadata.

Transient storage failures receive exponential retry delays from 30 seconds up to 15 minutes. `deadlineAtMs` is the indexed worker wake-up time during retry; `deadlineRecovery.originalDeadlineAtMs` retains the original diagnostic value. Scoring continues to derive elapsed time from `startedAtMs`, rules and penalties, so this retry delay grants no extra solving time. Monitor oldest retry age, consecutive attempts and the aggregate failure log; a database outage can also prevent retry bookkeeping and must be handled operationally.

Creator/performance outbox consumers acknowledge permanent data corruption with `quarantined: true` and `deliveryState: "quarantined"`. Explicit `pending`, `delivered`, `suppressed` and `quarantined` states distinguish processing outcomes while retaining the legacy `delivered` acknowledgement flag. Complete receipt metadata and state consistency are validated before downstream reads. Infrastructure failures stay pending with persisted attempts and deterministic exponential jitter, from approximately 30 seconds up to 15 minutes. A concurrent successful or suppressed delivery takes precedence over failure bookkeeping.

Each queue's recovery pass scans at most 100 pending receipts with concurrency ten. A circular cursor ordered by original enqueue time and document ID advances over failed and deferred events, so a full page of failures cannot permanently hide later healthy events. Legacy receipts without retry metadata remain due. The server-only `raceMaintenance/{collection}Recovery` checkpoint holds a five-minute lease, cursor and last page report; failed retrieval retains the prior cursor, and superseded workers cannot overwrite a newer checkpoint. Each queue runs independently. These checkpoints contain no owner identity or answer-bearing payload.

Repair a quarantined source, receipt or owner performance profile from authoritative evidence, then validate one event with:

```sh
pnpm --dir firebase-functions race:delivery:replay --project PROJECT --collection raceSettlementOutbox --event RUN_ID
```

Use `racePerformanceOutbox` for owner-performance delivery. The command builds the backend, uses the pinned Functions Node runtime, and defaults to a read-only dry run. After reviewing successful validation, add `--apply --confirm-project PROJECT` to release and deliver that event. The backend-only `replayRaceDelivery` interface requires a supported receipt linked to the existing canonical settlement, matching identity, original enqueue time, creator/category/result/delta where applicable, and unexpired source/receipt retention. It never recreates missing data or extends retention. Normal delivery rechecks deletion and both blocking directions; concurrent/repeated replay preserves idempotent effects. No client callable exposes replay.

`Race delivery queue health` structured logs record `scanned`, `delivered`, `deferred`, `failed`, `sampleCapped` and `oldestPendingAgeMs`. A capped page is a lower bound on pending work, not an exact backlog count. Age is measured from the globally oldest pending enqueue time before processing, independently of the rotating sample and backoff. Warning severity is emitted for a failed adapter, a full page or age at least five minutes. Alert immediately on `Race delivery requires repair and replay`; investigate repeated queue warnings and a checkpoint with no successful page for more than ten minutes. A future retry time does not reset the event's age.

The independent `monitorRaceRecoveryHealth` scheduler runs read-only every five minutes, so a missing delivery invocation does not suppress health reporting. `readRaceRecoveryHealth` samples due deadlines, active retry histories, deadline quarantine and both outboxes. Each count reads at most 21 records: `lowerBound` caps at 20 and `capped` explicitly indicates more work. Together with two oldest-enqueue reads, two outbox recovery checkpoints and the projection configuration/checkpoint, the maximum observation returns 153 documents. Projection health distinguishes committed page progress from complete two-pass cycles, and retains unavailable observations across healthy pages; see the projection diagnostics in race-match-operations.md. No aggregate count or full collection scan is issued. Current due wake-up delay and original scoring-deadline age are separate measurements; the latter is explicitly limited to the retry sample. Completed runs with retained retry diagnostics are excluded.

The unordered outbox samples also detect invalid/missing enqueue clocks that an ordered recovery query would omit. Pending work older than ten minutes warns when its checkpoint is missing, stale or malformed. Quarantined receipts remain visible after the legacy processing acknowledgement. Health query failures reject the scheduled invocation rather than report healthy empty queues. Diagnostics include aggregate measurements and stable warning codes, with no answers, account identities or event payloads.

Use this Cloud Logging filter for recovery warnings:

```text
jsonPayload.message="Race recovery health"
severity>=WARNING
```

Alert on deadline wake-up delay at least two minutes, original retry delay or outbox enqueue age at least five minutes, recovery staleness at least ten minutes, any observed quarantine, and any invalid enqueue clock. The monitor observes these thresholds on its five-minute cadence; per-event quarantine error logs remain the immediate signal. Alert separately when the scheduler fails or no health observation arrives for ten minutes. A capped sample is a volume signal rather than proof of excessive delay. Deploy the added `raceRuns` status/original-deadline index with the scheduler. Production alert policies and deployment are operator rollout actions; neither was changed by this development work.

New runs and recordings carry `recordVersion: 1`. Storage readers validate scoring, identity, category, clock, event, lifecycle and content fields before casting. Supported legacy records remain readable; challenge readers normalize missing language to English and the historical hint limit to one. Unsupported revisions and corrupt values require repair rather than coercion. Validation diagnostics never include answer-bearing payloads.

Storage validation also checks ordered/unique physical and canonical deck IDs, current-position bounds, safe integer clocks, lifecycle/result/finish relationships and locale-aware revealed hint positions. A settled outcome must match its parent run's identity, challenge, result, counts, terminal duration, penalties, opponent finish and publication/rematch flags. Settlement clocks cannot precede finish or appear without the outcome. Recording penalty/adjusted-time totals and archived IDs/positions must agree. These rules apply to supported legacy records too; they do not reconstruct missing authority or silently rewrite contradictory results.

When a legacy challenge needs its original creator deck, acceptance, resolution and reconciliation share the same source-link check. The stored source must match its physical run ID and owner, completed creator role/result/target, language/category/deck, rules version and any explicit rules snapshot, recorded timing and ordered ghost timeline. Publication cannot precede the source finish; future-created challenges are not yet eligible. Fully archived issued recordings remain self-contained and do not require a retained creator run. Run the existing dry-run reconciliation before rollout and investigate unavailable legacy sources instead of rebuilding from mutable catalog content.

## Retrieval, attribution and measurements

Retrieval uses logarithmic performance buckets with a 1.5 duration ratio between adjacent intervals. It gives comparable intervals a share of a fixed 200-document budget, traverses each interval circularly from a requester/request-specific hash pivot, and widens only after canonical eligibility rejects the narrower sample. Eligibility observations are cached within one lookup, while the offer transaction revalidates its final choice. Exact category/confidence/repetition/exposure scoring remains continuous rather than bucket-based. A new search intent rotates the window; the same intent preserves it. Sparse successful searches stop after finding an eligible nearer tier instead of probing all wider intervals.

Without a category preference, retrieval uses each category's own confidence-adjusted expectation, matching exact ranking. Categories with identical expectations share an indexed query group; disjoint category groups share the same 200-document budget without duplicate retrieval. New players retain the single overall-prior group. In addition to the candidate budget, a lookup permits at most 1,000 direct/transactional document read attempts and 200 transaction callbacks, including retries. It stops issuing new work after 15 seconds of actual elapsed lookup time. Already-issued reads are drained before returning a budget failure; this is not a guarantee that a stalled network call ends within 15 seconds. Budget exhaustion and elapsed deadlines are failures rather than empty results, and their logs retain retrieval progress.

Candidate projections pass a complete runtime schema before ranking, including supported policy/rules revisions, provider/category, immutable derived query keys, timestamps and unique question IDs. Structurally valid ranking metadata must also match its canonical recording during eligibility inspection. A pool containing only corrupt/stale projections produces a recoverable failure rather than a misleading empty-pool response.

Every new matched response supplies an opaque `offerId`. New clients carry it only into its exact offered challenge; direct links and old adapters remain supported. Acceptance checks owner, challenge and language before atomically linking `acceptedRunId`. Request replay returns the same committed run. Readiness adds the fixed scheduled start; settlement, abandonment and preparation expiry add deterministic terminal facts. A consumed discovery intent cannot be reused for another recording.

`expiresAtMs` is the 60-second discovery-cache lifetime. Its expiry requires a new lookup intent but does not revoke a still-eligible challenge already shown to the player. Acceptance after that cache expiry is tracked as `offerExpiredAtAcceptance`. The receipt's storage TTL follows the bounded seven-day race retention so accepted outcomes remain attributable. Account deletion removes requester-owned receipts; missing/deleted receipts are never recreated by settlement.

Lookup logs and first-issued offer receipts record candidate documents/queries, direct and transactional document read attempts, and transaction callback attempts including retries. `documentReadAttempts` does not include candidate query documents; add `candidateDocumentsRead` for total returned/requested document work, and inspect `candidateQueries` for empty-query overhead. These are application measurements, not invoice or index-scan counts: use Firestore Query Explain in the intended environment for the latter. Infrastructure failures produce a separate failure event; true empty pools, capped searches, and eligibility changes during final proposal are distinct outcomes.

Calibration can join the owner-bound receipt's fixed policy version, expected/recording duration, category, confidence and offer band to acceptance/start/terminal timestamps, result, correct count and penalties. Count complete ten-clearing runs separately from partial ghost losses and abandonment. Keep fixed recording attribution: only the attempt owner supplies new rating evidence. The current coefficients remain a documented heuristic until calibrated against observed outcomes; implementation tests alone cannot establish production match quality.

## Bounded projection reconciliation

The additive `reconcileRaceMatchProjections` scheduler is idle unless server-only `raceConfig/maintenance.projectionReconciliationEnabled` is exactly `true`. Deploy and verify the required candidate indexes and complete the initial archive/projection backfill before enabling it. This development change does not enable maintenance or deploy a revision.

Each five-minute invocation processes at most 100 records. A canonical challenge pass repairs missing/stale projections from the original immutable archive; a candidate pass removes orphaned, private, expired, deleted-account and corrupt-source projections. Neither pass reconstructs questions from the mutable catalog. Both use the same transaction implementation as the migration. A dry-run candidate page is available through `reconcileRaceCandidatePage`.

The server-only `raceMaintenance/projectionReconciliation` checkpoint records phase, document-ID cursor, lease and the last bounded page report. A five-minute lease exceeds the worker's 120-second timeout and permits later recovery after a crash. Only the current lease owner may advance the checkpoint. Failed pages retain their previous cursor for idempotent replay; a superseded worker cannot overwrite a newer cursor. Full passes repeat so publications inserted before a previous cursor are visited in a later pass. Monitor unavailable-record counts and last successful page time; diagnostics never include archived answers.
