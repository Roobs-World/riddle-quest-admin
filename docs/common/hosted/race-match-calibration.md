# Matchmaking calibration

`race:match:calibrate` provides observed offer-cohort summaries and offline policy comparisons. It is an operator command, not a client endpoint. It has no database mutation path and does not install a policy. Run it from `firebase-functions` with Node 22. Its package command builds the backend first.

## Observed outcome reports

For a bounded read-only creation-time window:

```sh
pnpm race:match:calibrate --project PROJECT --from-ms START_EPOCH_MS --to-ms END_EPOCH_MS --limit 500
```

The project and both interval endpoints are mandatory. The limit is 1–500, with one additional document used to detect truncation. The query reads the oldest page ordered by `createdAtMs`, using an inclusive start and exclusive end. It does not count or scan the rest of the collection. `source.capped` and `invalidRecords` are explicit. Corrupt or incomplete source rows are excluded from metric denominators; their count remains visible. A missing indexed creation clock, seven-day TTL retention and legacy metadata can bias this sample. A capped oldest page is not a population estimate.

For a strict offline report:

```sh
pnpm race:match:calibrate --input outcomes.json
```

The envelope is `{ "schemaVersion": 1, "asOfMs": 1000, "measurements": [...] }`, with at most 10,000 answer-free observations and a 32 MiB input-file limit. `RaceMatchMeasurementSchema` in `src/race/raceMatchCalibration.ts` defines fields and validation. Offline inputs reject unexpected identity/answer fields; live receipts are projected through an explicit field allowlist. Neither output mode prints requester, creator, challenge, run or question identifiers, archived answers, guesses or profile snapshots. Command errors are generic and never print validation payloads or stack traces.

These offer cohorts describe the challenger role. Creator recording/completion histories remain separate in the performance profile and are not inferred from repeated ghost appearances. Cohorts separate provider, language, category, policy hash/revision and low/high/unknown confidence. Missing historical policy attribution stays unknown. Reports distinguish:

- Unexpired unaccepted offers from matured acceptance opportunities. Accepted offers are included even when accepted after their preview-cache expiry.
- Accepted runs from starts whose clock has passed. A race abandoned during countdown is not counted as started; future scheduled starts remain pending. Preparation failures and countdown abandonment are reported separately.
- Terminal runs from accepted runs still awaiting a terminal result. Completion uses ten solved answers independently of beating the ghost. Receipts without the new completion measurement have an explicit missing count and are excluded from the completion-rate denominator.
- Full observed finishes from censored partial/idle losses and abandonment. Only full finishes contribute actual normalized duration, absolute prediction log error and absolute raw adjusted-time gap against the fixed recorded opponent. Partial/idle races never supply extrapolated finish gaps.
- Selected question overlap/repeated rivals from the nearest eligible baseline. The relaxation count supports evaluating the variety gained; it does not establish a causal retention or completion effect.

Numeric summaries expose count, mean and nearest-rank p50/p95. Missing observations return count zero and null estimates. Settlement delay uses the original persisted finish and settlement clocks, preserving attribution under repeated outcome reads. Application read/transaction attempts are cost proxies, not billed document/index scans. `lookupSelectionDurationMs` ends before the winning transaction commits; it is not end-to-end player latency. Full lookup logs remain necessary for latency and empty/capped/failure rates, since offers contain only successful selections.

## Observed experiment comparisons

Experiment attribution adds ID/revision/arm/allocation hash to detailed policy/category/confidence cohorts. `experimentComparisons` also pools observations across categories and confidence strata within the same experiment allocation, provider and language. Each observed arm reports its policy hashes and the same matured acceptance, reached-start and measured-terminal completion denominators as detailed cohorts. Different revisions or allocation hashes never merge. Future-created observations remain excluded.

The output declares `assignmentUnit: "authenticated-player"`, `observationUnit: "offer"` and `observedArmsOnly: true`. It has no player identifiers, unique-player counts, allocation salt, p-values or causal-lift calculation. Repeated offers from one player are correlated; pooled rates can also reflect category/confidence composition, so inspect detailed strata. Missing arms are not fabricated as zero counts. Retention, capped oldest-page sampling, invalid receipts, pending outcomes and searches that produced no offer require separate investigation. These observed comparisons supplement the offline simulation below; they do not replace full search-funnel measurement or player-level experiment analysis.

## Offline policy comparison

```sh
pnpm race:match:calibrate --input comparison.json --mode compare
```

The strict `RacePolicyComparisonInputSchema` requires complete validated `baselinePolicy` and `proposedPolicy` objects and a `samples` array. Each sample supplies `viewer`, `requestId`, `locale`, `nowMs`, a validated match profile, `canonicalEligibilityValidated: true`, and at most 200 answer-free candidates. Candidates contain only a recording ID, creator key, category, fixed normalized recording duration and canonical question identifiers. Viewer/creator keys must match the keys used to hash the supplied profile's opponent history; changing them independently would invalidate repetition scoring. Keep these operator-local inputs private. The schema rejects duplicate candidate IDs and answer-bearing extra fields. Use the server profile contract and [policy shape](race-match-policy.md); do not translate creator live ratings into recorded durations or invent partial finish estimates.

The supplied pool must already pass canonical provider/language/rules/content, account/deletion, attempt, block and authorization checks for that viewer at that sample clock. The attestation is an operator input requirement, not a substitute for live server validation. Both policies score the identical pool using production category/confidence/normalization assumptions and request-specific SHA-256 ties. The comparison uses the shared freshness selector and prints aggregate changed-selection counts, overlap, repetition, log-distance and expected durations, plus full policy hashes/revisions.

This is a **sampled-pool counterfactual**. It does not replay indexed retrieval windows, optional freshness-check budgets, live eligibility races, transaction contention or storage cost. It cannot estimate actual wins, completions or abandonment for unplayed alternative selections. Observed cohort comparisons are descriptive and may reflect different player/content populations; do not interpret them as randomized experiment results. Evaluate proposed priors/windows with representative language/category/confidence samples before an independently authorized policy rollout.

## Verification

Unit tests cover funnel denominators, pending/future clocks, missing legacy measurements, quantiles, selected/baseline freshness, answer/identity rejection and policy simulations. Settlement emulator tests cover concurrent repeated full/partial/idle attribution without changing canonical rewards or outcomes. Command emulator tests exercise bounded live reads, truncation, corrupt-record counts, unchanged source documents, strict offline reports, generic errors and actual offline comparison execution.

No production policy, data, deployment or alert configuration was changed by this implementation. Latency/cost targets, Query Explain guidance and the final whole-architecture audit remain separate requirements.
