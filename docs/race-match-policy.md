# Recorded matchmaking policy

The backend reads the admin-only `raceConfig/matchPolicy` document once for a new lookup. A missing document selects the explicit baseline; storage failures and invalid documents fail the search instead of silently choosing defaults or returning an empty pool. Clients cannot read or write this configuration, and cannot supply a policy through the matching request.

The policy schema validates an algorithm version, revision, default and language-specific overall/category priors, confidence thresholds, bounded censored influence, ordered performance windows, versioned freshness limits, and continuous distance/repetition/exposure weights. Provider scope, language, blocks, deletion, prior attempts, immutable content/rules compatibility and invitation authorization remain mandatory outside this policy. Recording normalization and observation aggregation/decay are separately versioned; selection configuration does not reinterpret their stored units.

`raceMatchPolicySnapshot` clones and validates configuration, computes a SHA-256 hash with canonical object-key ordering, and freezes the nested snapshot. `raceMatchContext` resolves the requested language's priors from that snapshot. Indexed retrieval, exact candidate scoring, canonical offer quality and expected-performance attribution all use this same context. No configuration reread happens during candidate validation or transaction retries.

New offers store the full policy snapshot, algorithm version, revision and hash, along with expected duration, confidence, recent-rival count and question-overlap fraction and whether selection relaxed into a wider band. This makes policy attribution reproducible even after configuration changes. The fingerprint still contains player preferences only: changing configuration must not turn a transport retry into another search.

Valid offer replays preserve the receipt. If an existing intent needs another eligible candidate, it retains its stored policy snapshot. Concurrent lookup losers replay the winner without rewriting its policy or original lookup attribution. Legacy offers remain valid without inventing a historical snapshot; a new explicit search receives the currently configured policy.

## Configuration shape

The baseline is defined by `DEFAULT_RACE_MATCH_POLICY` in `firebase-functions/src/race/raceMatchPolicy.ts`:

```json
{
  "schemaVersion": 1,
  "algorithmVersion": 3,
  "revision": 2,
  "freshness": {"nearCandidateBudget": 100, "maxAdditionalChecks": 20, "repeatThreshold": 1, "overlapThreshold": 0.5},
  "defaultPriors": {"overallMs": 120000, "categories": {}},
  "localePriors": {},
  "performance": {
    "priorEvidence": 4,
    "confidenceEvidence": 8,
    "censoredMaxWeight": 0.25,
    "nearRatioConfident": 1.25,
    "nearRatioUncertain": 1.5,
    "wideRatio": 2,
    "distanceWeightUncertain": 0.5,
    "distanceWeightConfident": 1,
    "rivalRepeatWeight": 0.6,
    "questionExposureWeight": 0.8
  }
}
```

Language entries use supported locale codes and contain the same `overallMs`/`categories` shape. Category entries use supported race category IDs. An unknown language entry, unsupported algorithm, unexpected field, non-finite value, unsafe censored weight or inverted window fails validation. Duration priors stay between one and three hundred seconds. Censored influence cannot exceed one quarter; configured distance weights remain positive.

Install a complete validated document with a new revision for parameter changes. Hash attribution also distinguishes accidental changes under a reused revision, but operators should retain revisions for comparison. This implementation made no production configuration or deployment changes.

## Stable policy experiments

The same admin-only document also accepts `RaceMatchExperimentSchema`: `kind: "experiment"`, `schemaVersion: 1`, a slug `id`, integer `revision`, allocation `salt` of 16–160 characters, explicit supported `providers` and `locales`, a complete `fallbackPolicy`, and two to four `arms`. Each arm contains a unique slug `id`, positive integer `weightBasisPoints` and a complete validated `policy`. Weights total exactly 10,000. Identical policies are permitted for an A/A check. A bare policy or missing document enrolls nobody; out-of-scope authenticated players receive the fallback without experiment attribution.

Assignment hashes the experiment ID, revision, salt and authenticated provider player ID into a stable allocation bucket. New request IDs, categories and retry timing cannot change the arm under unchanged configuration. No client-supplied identity or arm is accepted. Treat allocation parameters as immutable within a revision; use a new revision for changes. Changing salt or revision intentionally repartitions players. The allocation hash covers the entire configuration, including scopes, arm order, weights and policies, so accidental edits under a reused revision remain separate report cohorts.

New offers retain only experiment ID, revision, arm and allocation hash alongside their full selected policy snapshot/hash. Allocation salt and player identity are not exported in experiment attribution. Existing intent replay or candidate reselection preserves the stored assignment even after configuration removal or replacement; concurrent losers use the winning receipt. Malformed configuration fails closed rather than assigning a default arm. No additional assignment collection or per-player profile is created.

Observed comparisons use [the calibration report](race-match-calibration.md). Offer observations are correlated within players; these summaries do not claim independent-player significance or causal lift. Empty, capped and failed searches require the lookup-log denominator. Validated assignment remains in failure logs after policy resolution; earlier failures remain explicitly unattributed. Configuration deployment remains an independent operator action.

## Controlled freshness relaxation

Algorithm 3 can replace a familiar nearest recording with a fresh recording in exact performance band 0 or 1. A recording needs freshness when its recent accepted-rival count reaches `repeatThreshold` or its exposed-question fraction reaches `overlapThreshold`. Baseline thresholds are one prior opponent encounter and half of the archived deck. Selection consults canonical eligibility before allowing an alternative to stop discovery; a blocked, foreign-language, stale or otherwise unauthorized projection cannot supply freshness.

Exact band 2 is never a freshness substitute. If no fresh comparable recording is found, the nearest eligible recording remains available. Ordinary widening into band 2 still applies when no comparable eligible recording exists. Retrieval keeps the same overall 200-document budget, reserving the remainder after `nearCandidateBudget` nearest documents for wider tiers. When no eligible fallback exists, discovery revisits the remaining nearest window before trying far matches, so reserved capacity does not turn a fully bounded search into a misleading eligibility failure. Additional canonical checks for freshness are capped per exact comparable band by `maxAdditionalChecks`; the lookup also reserves thirty canonical read attempts for committing its fallback offer. Existing elapsed and transaction caps continue to apply.

Version-2 snapshots retain their exact field shape and original band-first selection. Parsing does not insert freshness defaults into them, preserving canonical hashes and offer attribution. New baseline selections use algorithm 3; profile version 2 and recording normalization version 1 stay unchanged. Existing healthy receipts replay unchanged across policy updates. New receipts include `freshnessRelaxed`, the nearest eligible baseline band/repeat count/overlap, and the actual selected recording's overlap and repeat count. Lookup logs report the winning receipt's relaxation flag, including concurrent replay. These fields support measuring the variety gained against the baseline; completion effects still require outcome analysis.

## Verification and remaining work

Unit tests verify canonical hashing, detached/frozen snapshots, schema limits, configured scoring, per-language fallback and storage-failure behavior. Emulator tests select a comparable recording beyond 220 mismatches under a configured category prior, change configuration during lookup, verify exactly one policy read, and preserve the selected snapshot through replay. Firestore rules tests deny authenticated and unauthenticated policy access.

Observed outcome summaries and offline policy comparison tooling are implemented in [the calibration command](race-match-calibration.md), with explicit sampling and counterfactual limitations. Measured latency/cost targets and the final full architecture audit remain separate requirements. Freshness unit and emulator tests cover cross-band repetition/overlap, blocked or foreign alternatives, broad-band exclusion, thin-pool fallback, dense repeated pools, legacy policy behavior and stable replay.
