# Recorded matchmaking operations

These are development targets and investigation thresholds, not claims of production compliance. Backend lookup telemetry covers authorized calls that reach the matching service; identity/request rejection before that boundary belongs to provider ingress monitoring. Production validation still needs representative traffic, function cold starts, deployment-region/client transport and billed index scans. No alert configuration or production index was changed.

## Repeatable local benchmark

From `firebase-functions` on Node 22:

```sh
pnpm race:match:benchmark
```

The command builds the backend and starts Firestore with the dedicated `demo-riddle-quest-match` project. The worker refuses absent/remote emulator endpoints, any other project and unknown options before loading the backend. It seeds and clears only its demo fixtures, never a production database. Its six scenarios exercise canonical archived recordings through the real matcher:

| Scenario | Pool | Required outcome | Local warm-process p95 target |
| --- | --- | --- | --- |
| Dense | 220 comparable recordings | Matched | 1,500 ms |
| Sparse | One comparable recording | Matched | 1,500 ms |
| Exclusions | 100 blocked recordings plus one eligible recording | Matched | 5,000 ms |
| Empty | No recordings | Empty | 1,500 ms |
| Capped | 220 blocked recordings | Typed search-budget failure | 10,000 ms |
| Freshness | 220 repeated nearest recordings plus one fresh wider recording | Matched | 3,000 ms |

Every successful new intent is replayed without acceptance. Reports include scenario sizes, outcome/failure counts, policy hash/revision, Node version, new/replay p50/p95/max elapsed time, candidate/query counts, canonical read attempts and transaction callbacks. Each lookup must emit exactly one terminal telemetry event. All scenarios require at most 200 candidate documents, 1,000 canonical read attempts and 200 callbacks; successful replays require at most ten canonical reads. Missing/unexpected outcomes or failed bounds/latency targets cause a nonzero exit. Targets are checked independently, without averaging capped searches into successful latency.

Default iterations are five per scenario. For a larger local sample after building:

```sh
node scripts/run-isolated-emulators.js emulators:exec --only firestore --project demo-riddle-quest-match 'node scripts/race-match-benchmark.js --iterations 20'
```

Use `--scenario dense|sparse|exclusions|empty|capped|freshness` for diagnosis. A warm synthetic emulator sample is a repeatable regression baseline, not a production percentile estimate. Setup/cleanup is outside lookup timing. The 15-second production guard stops issuing work; in-flight reads may finish later, so it is not a guaranteed end-to-end response deadline.

The [recorded local run](evidence/race-match-benchmark-2026-09-30.json) contains five observations per scenario and successful replay phase. All asserted outcomes, latency targets, read/callback bounds, terminal-event counts and selected-policy attribution passed. Exclusion-heavy matching required substantially more canonical reads than healthy dense/sparse matching; this is observable investigation evidence, not a claim that the proposed production cost threshold is satisfied.

The [grouped-eligibility run](evidence/race-match-benchmark-batching-2026-09-30.json) repeats all six scenarios and replay phases with five observations per phase, using the same policy hash and Node version as the saved baseline. Every benchmark check passed. The comparison below uses median application work for new searches; it excludes indexed query scans/billing and is not a representative production sample.

| Scenario | Canonical/direct read attempts, before → after | Transaction callbacks, before → after |
| --- | --- | --- |
| dense | 18 → 18 | 2 → 2 |
| sparse | 18 → 18 | 2 → 2 |
| exclusions | 417 → 117 | 59 → 10 |
| empty | 3 → 3 | 0 → 0 |
| capped | 1000 → 351 | 143 → 37 |
| freshness | 165 → 165 | 23 → 23 |

Exclusion-heavy matching reduced median read attempts by about 72%. The capped scenario remains capped by its candidate window while validating more blocked recordings within fewer reads. Dense/sparse fast paths and the freshness-only scenario retain their read counts. Timing is included in both JSON reports, but five warm emulator observations do not prove a production latency improvement or uniform improvement across workloads. Measurement version 2 adds transaction read-group/cache-hit distributions and rejection-category distributions; older reports lack those fields.

## Terminal lookup events and queries

`telemetryVersion: 1` gives each completed invocation one mutually exclusive disposition: `matched`, `replayed`, `empty`, `capped`, or `failed`. Failed events retain stable `failureReason`, broad `failureCode`, candidate progress, read attempts, callbacks and duration. Successful events include actual winning-policy attribution and freshness relaxation. Corruption, changed eligibility or capped work does not count as an empty pool. Logs contain no raw request IDs, player identities, questions, answers or profile snapshots.

Logs Explorer base filter:

```text
jsonPayload.telemetryVersion=1
jsonPayload.message=("Race matchmaking lookup" OR "Race matchmaking failure")
```

Append `jsonPayload.provider="reddit"`, a locale, or `jsonPayload.policyHash="HASH"` for cohort diagnosis. Enrolled events also support `jsonPayload.matchExperiment.id`, `.revision`, `.arm` and `.allocationHash` filters. Assignment is player-stable while observations are invocations; do not count repeated offers or replays as independent players. Validated receipt or selected-policy attribution survives capped/failed searches, including failed profile reads or validation after policy resolution. Independently issued history/policy reads drain before failure reporting. Failures before assignment validation remain unattributed and must stay in global error denominators. For new backend work use:

```text
jsonPayload.disposition=("matched" OR "empty" OR "capped" OR "failed")
```

For infrastructure/search failure diagnosis use `jsonPayload.disposition=("capped" OR "failed")`; for pool coverage use `jsonPayload.disposition="empty"`; for cache recovery use `jsonPayload.disposition="replayed"`. Count invocations, not unique players or search intents. Exclude replays from new-search outcome rates. Preserve separate counts for empty, capped and other failures. Build duration/read distributions from numeric `durationMs`, `documentReadAttempts`, `candidateDocumentsRead`, `candidateQueries` and `transactionAttempts` fields. Application attempts include rejected candidates and transaction retries but exclude billed index scans and empty-query minimum charges.

Grouped eligibility additionally exposes `documentReadBatches` and `documentReadCacheHits`. These count attempted transaction document RPC groups and transaction-local reused document promises; they exclude direct receipt/profile/configuration reads and indexed candidate queries. Automatic transaction retries get new caches and count their reads again. Group admission reserves every unique path before dispatch; the elapsed deadline is checked again at actual dispatch, and already-issued reads drain before a failure returns. These counters are application work proxies, not billed-read or index-scan measurements.

Discovery preserves the one-record fast path for a healthy pool. After a canonical rejection, it validates at most eight unseen same-band recordings per read-only transaction, with speculative work constrained by the policy's optional freshness allowance. Common viewer/creator deletion and block dependencies are fetched once per transaction. Privacy checks precede attempt/invitation reads, and legacy archive hydration follows authorization. All grouped checks use the same eligibility policy as acceptance. Offer creation and acceptance open new transactions and revalidate; cached discovery results never authorize a start. For example, a block arriving after discovery produces `eligibility-changed`, while a fully scanned blocked pool produces `empty` if it fits the work budget.

Use [the bounded calibration command](race-match-calibration.md) for accepted/start/terminal funnel denominators, preparation/countdown failures, abandonment and original settlement delay. Receipts describe successful selections only; they cannot supply an empty/capped rate. Its selection duration ends before final commit. Backend log duration includes commit/response validation but excludes browser/provider transport and platform response delivery.

## Initial service targets and investigation thresholds

These proposed thresholds need production observation before being treated as contractual SLOs. Aggregate a 15-minute window by provider/language first, and policy/confidence/category where supported. Require the denominator shown below to avoid conclusions from tiny cohorts.

| Measurement | Initial target / investigate when | Minimum sample |
| --- | --- | --- |
| New matched backend duration | p95 ≤ 2,500 ms; investigate persistent exceedance | 100 new matches |
| Replay backend duration | p95 ≤ 1,000 ms | 100 replays |
| Capped-search fraction | ≤ 1% of new invocations | 100 new invocations |
| Other failed fraction | ≤ 1% of new invocations, broken down by reason | 100 new invocations |
| Empty fraction | Track separately; investigate a rise of 10 percentage points against the same cohort baseline | 100 new invocations in each window |
| Successful canonical read attempts | Investigate p95 > 400; diagnose exclusion/repetition/query overhead rather than relaxing hard eligibility | 100 new matches |
| Successful replay reads | ≤ 10 without contention; investigate recurrent excess | 100 replays |
| Preparation abandonment | Investigate > 5% of accepted terminal opportunities | 100 terminal accepted runs |
| Countdown abandonment | Investigate > 2% of accepted terminal opportunities | 100 terminal accepted runs |
| Original settlement delay | Investigate p95 > 5 seconds separately from delivery latency | 30 measured terminal runs |

A capped rate is `capped / (matched + empty + capped + failed)`; an empty rate substitutes `empty` in the numerator. Neither uses replays. Threshold breaches trigger diagnosis, not automatic removal of provider/language/block/authorization restrictions. High abandonment may reflect player intent or transport rather than fairness, so inspect lifecycle clocks and matched cohorts before changing policy.

Existing independent recovery health warns at two-minute deadline lateness, five-minute original outbox age and ten-minute stale recovery checkpoints. Those bounded samples expose lower counts/cap flags; do not present them as exact total backlogs. Investigate quarantine/source corruption and stale workers using the validated recovery tooling rather than resetting clocks or outcomes.

The same health observation now includes projection reconciliation. Two additional single-document reads inspect maintenance opt-in and its private checkpoint; the complete observation reads at most 153 documents. It reports last committed-page age, last complete two-pass cycle age, current/previous-cycle unavailable observations and retained page failure. No candidate/source scan, cursor, lease identity or answer payload enters the health report. These ages measure reconciliation progress, not publication-to-discovery latency or exact stale-record counts. Unavailable counts are record observations across both passes, not deduplicated sources or a quarantine population.

Investigate `projections-recovery-stale` after ten minutes without trustworthy enabled page progress, `projections-cycle-delay` after one hour without a complete cycle, and `projections-cycle-unobserved` when enabled maintenance has no valid complete-cycle timestamp. These are diagnostic thresholds requiring workload calibration, not production SLO claims. `projections-page-failed` persists until safe replay succeeds. `projections-unavailable-sources` persists across healthy later pages and through the next cycle until a complete clean cycle replaces it. Disabled maintenance is not called stalled; retained failures and unavailable observations remain visible.

Correlate `jsonPayload.message="Race recovery health"` projection warnings with `Race projection reconciliation` page reports and matchmaking dispositions in the same UTC window. Check both outboxes' quarantine/original-age fields when offer-to-start conversion falls: stale profile delivery, canonical source corruption, slow reconciliation and genuinely empty pools require different operator actions. Compare by provider/language and policy in lookup/offer cohorts where available; the global health checkpoint alone cannot establish a pool-specific cause. Read-only health failures must remain failed scheduled invocations, never healthy empty reports.

Exhausted discovery with rejected/corrupt projections emits `failureReason="projection-unavailable"`, `recovery="same-intent"` and a 15-second retry delay. The client retains the exact request/preferences, disables premature Retry, and uses the existing translated temporary-unavailability message. True exhausted eligible pools retain `empty` and a new-search action; candidate/read caps retain `search-budget-exceeded`. The backend does not repair records or remove hard eligibility during a player search. Existing clients that do not recognize the additive reason fall back to generic temporary recovery; publish the updated clients to preserve the specified delay.

`Race start command` logs every returned or failed authoritative start invocation outside transaction callbacks, including failed offered entry before a run exists. Filter `jsonPayload.message="Race start command"`, `jsonPayload.telemetryVersion=1` and `jsonPayload.entryKind="offer"`; break failures down by `failureCode`, provider and language in the same UTC interval as projection warnings. `entryKind` describes supplied command references, not proof that an offer was authorized. These events omit requester, offer, challenge, run and request IDs, answers and error payloads. Duration ends at the server response and excludes client delivery. Returned duplicate requests count again, so command failure rates are operational invocation metrics, not unique-offer conversion. Use persisted offer acceptance/start clocks for durable funnel denominators. Access/validation rejection before entering the start service remains ingress telemetry, not an attributed start observation.

## Query Explain verification

The installed Firestore server SDK (`@google-cloud/firestore` 8.7.1) declares `query.explain({analyze: boolean})`. Use IAM-authorized server tooling against an approved staging/read-only target. Default planning shows selected indexes; analyze executes the query and exposes execution/billing statistics. Default planning has a read charge, and analyze incurs normal query charges. These behaviors are documented in [Firebase Query Explain](https://firebase.google.com/docs/firestore/query-explain).

Reproduce the actual `raceCandidateSearch.ts` query, rather than explaining a simplified expiration-only query. Preserve provider, locale, rules version, active status, performance bucket, exact category or category group, circular pivot half, expiration bound, both orderings and page limit:

```js
const query = db.collection('raceMatchCandidates')
  .where('provider', '==', provider).where('locale', '==', locale)
  .where('rulesVersion', '==', rulesVersion).where('status', '==', 'active')
  .where('performanceBucket', '==', bucket)
  .where('selectionKey', half === 0 ? '>=' : '<', pivot)
  .where('expiresAtMs', '>', nowMs)
  .orderBy('selectionKey').orderBy('expiresAtMs')
  .orderBy(FieldPath.documentId()).limit(pageLimit);
// Apply the same category == / in filter and startAfter cursor as the sampled page.
const planning = await query.explain({analyze: false});
const execution = await query.explain({analyze: true});
// Inspect metrics only; do not export execution.snapshot or answer-bearing sources.
```

Check both pivot halves, sparse/empty buckets, category grouping, later cursors and an expiry-skewed pool. Record SDK version, environment, policy/bucket/page parameters, selected index, returned count, execution duration, billable reads, documents scanned and index entries scanned. Missing optional debug fields mean unknown, never zero. Review debug/index descriptions manually: their format can change, as explained in [the report reference](https://firebase.google.com/docs/firestore/reference/query-explain-report-reference).

Investigate a scan/returned ratio above 100 for nonempty pages or over 1,000 scanned entries for empty pages, comparing against the same workload before changing indexes. These are investigation thresholds, not Firestore guarantees. Index-cardinality and expired-record skew can dominate a query whose document result limit is small. Validate an index change against the identical pool/pivot/cursor and billed operations, then rerun matching/eligibility/isolation checks. Query Explain describes individual query executions; production aggregate latency still comes from terminal lookup logs. No cloud Explain execution was performed as part of the local emulator benchmark.
