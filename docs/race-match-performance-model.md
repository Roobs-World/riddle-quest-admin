# Recorded-race performance evidence

Selection policy version 2 separates observed finish times, censored lower bounds and completion opportunities. Candidate recording normalization remains version 1 because its fixed difficulty weights and indexed performance values have not changed. Existing candidates remain readable; new offer receipts attribute selection to version 2.

## Duration evidence

A ten-question finish contributes one difficulty-normalized observation. An unfinished scored race with at least one correct answer contributes a quarter-observation to a separate lower-bound estimate. It never extrapolates elapsed time by `10 / correctCount`.

The censored bound starts from authoritative elapsed adjusted time and uses the maximum difficulty weight anywhere in the archived deck. This is conservative for any completed question subset, including skipped questions. The eventual normalized finish cannot precede that bound under the fixed normalization model. Idle races supply no duration evidence.

Matching first derives its expected log duration from observed overall/category history and priors. Recent censored evidence can only increase that expectation; its weight is capped at one quarter. Censored evidence neither increments observed-finish confidence nor refreshes its recency clock. Both observation histories are bounded and lose half their evidence every thirty days.

## Completion evidence

Every scored settlement delivered through the performance outbox contributes one completion or non-completion observation, including idle ghost losses. Creator recordings and challenger races have separate overall/category statistics: a challenger is limited by the fixed ghost deadline, so these roles do not represent equivalent opportunities. Preparation abandonment and unscored quits are outside this statistic; offer funnel abandonment remains a separate measure.

Recent finished/unfinished counts are capped together at twenty and decay every thirty days. Completion expectation shrinks sparse history toward a supplied probability prior, then category history toward role-level history. This estimate describes completion under the issued opportunities; it does not prove causation or guarantee the player would fail a longer race.

## Delivery and compatibility

Performance and completion use the canonical finish timestamp, falling back to settlement time only for legacy records without a finish timestamp. Neither delayed deadline settlement nor delayed delivery makes an old race current. An older queued observation is decayed against the latest existing observation clock and cannot rewind it. The transactional outbox acknowledgement keeps concurrent delivery and replay from counting an opportunity twice. Only the attempt owner is updated; popular ghosts do not multiply creator skill evidence. Deletion suppression still applies.

Private profile version 2 adds separate censored and role-specific completion histories. Version 1 profiles upgrade on use, retaining opponent hashes and exposed question IDs. Their mixed legacy duration evidence is capped at one observation of confidence because prior data cannot distinguish completed finishes from extrapolated losses. No completion counts are invented from legacy aggregates. Invalid histories still fail validation and follow normal quarantine/repair handling.

## Priors and remaining calibration

The estimator accepts a validated overall/category prior for the profile's language. Unknown-category history uses its overall prior; personal overall history gradually replaces a supplied category prior. Neutral defaults remain 120 seconds. [Policy configuration](race-match-policy.md) now selects language-specific priors once per lookup and passes the same immutable parameters to indexed retrieval and exact ranking. [Outcome summaries and offline policy comparison](race-match-calibration.md) now support evaluating proposed priors against actual completed finishes and the same eligible sampled pools. These tools do not make production calibration claims.

Fixed difficulty weights remain heuristic. Calibrating or changing recording normalization requires a separate version and compatible candidate reindexing; changing selection priors does not. Completion and finish-gap measurements should be evaluated by role, language, category, confidence and selection-policy version before claiming better player outcomes.
