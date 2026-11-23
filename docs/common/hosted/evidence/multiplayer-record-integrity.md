# Canonical record and legacy archive integrity

Local development evidence, 30 September 2026. No production records, configuration, deployment or index were changed.

## Implemented checks

- Supported runs validate ordered unique physical/canonical deck identities, current-position bounds, safe clocks and revealed hints against locale-aware answer graphemes.
- Live/prepared and terminal states cannot carry contradictory scoring or finish facts. Completed/timed-out clocks use persisted start plus wall duration; preparation remains unscored.
- Stored settled outcomes are bound to their parent run, challenge, result, counts, timing, penalties, opponent duration and publication/rematch flags. Settlement requires both a final outcome and a finish clock no later than settlement.
- Recordings validate penalty sums, adjusted duration and archived deck identity/order relationships. The immutable deck validator rejects duplicates even when directly called outside canonical record parsing.
- Legacy archive acceptance, resolution and reconciliation use a shared complete creator-record link check. Matching owner/language alone is insufficient. The original physical run identity, completed creator state, category/deck/rules, recording timing and timeline must agree. Publication follows finish. Fully archived recordings retain their independent lifetime.

## Foundation verification

The final Node 22 backend race gate passed 611 tests across 44 suites: 96.73% lines, 94.57% statements, 88.57% branches and 97.13% functions. Ten operator command safeguards and the production module-cycle audit passed through its build prehook.

Pure tests cover deck identity/order, lifecycle/clock contradictions, hint positions and each owned settled-outcome relationship. Emulator tests corrupt canonical settled outcomes, then verify rejected resume/outcome reads, quarantined performance delivery, denied repair/replay, unchanged existing rewards and absent new performance evidence. Eight creator-source corruptions exercise acceptance, resolution and reconciliation without creating attempts or projections.

Synthetic matchmaking/tournament fixtures were corrected to keep wall and finish/adjusted clocks consistent with their intended valid recordings. The future-finish regression now expects canonical validation to reject the source before the narrower performance occurrence-time check; its quarantine and no-fresh-evidence assertions remain intact.

All six guarded benchmark scenarios and successful replay phases passed against the final compiled backend with the default five observations. This is fixture/lookup regression evidence, not production latency or billing evidence. Backend lint, scoped documentation (403 declarations across thirteen selected files), security/CI-security, scalability and whitespace checks passed. This backend-only change did not alter client UI or target capabilities.

## Recording provenance through discovery and readiness

New recorded offers and challenger runs retain a private SHA-256 digest of the immutable recording: physical challenge/source-run/source-deck identities, creator, category/language, ordered canonical IDs and actual content hash, target, owned rules/evaluation policy, fixed wall/penalty/adjusted durations and ordered ghost scoring facts. Presentation, availability clocks, legacy catalog tokens and archive storage representation are excluded. The ordered projection ignores property insertion order and unknown event metadata.

Eligibility inspection now returns the authorized archive resolved in that same transaction. Offer issuance compares the committed recording with the one inspected/ranked; replay detects immutable drift. Acceptance checks both offer provenance and the prepared run against current transactional authority before exposure, run/deck/attempt/start receipt or conversion writes. Readiness checks the same source and the run's actual owned scoring snapshot before assigning a start or updating offer readiness clocks. A matching digest cannot excuse a corrupt run snapshot. No additional legacy source read is required.

Equivalent legacy-to-archived backfills and changed display metadata remain supported. New private digests do not enter client run/offer projections. Historical receipts without a digest remain supported without inventing historical source evidence; historical prepared runs compare their retained deck/category/language/rules/evaluation/opponent facts. They cannot retroactively prove source identities or separate timing components they never stored. Once scheduled, source challenge/creator-record removal does not invalidate resume or reset a ready retry.

## Recording-provenance verification

The final compiled Node 22 backend build and production module-cycle audit passed (153 modules). The isolated loopback Firestore gate passed 657 tests across 46 suites: 96.85% lines, 94.59% statements, 88.69% branches and 97.56% functions. Ten operator command safeguards passed during the build-backed prehook. Scoped lint and documentation verification passed for thirteen selected files (595 declarations); security/CI-security, scalability and whitespace checks passed.

The new regressions cover creator/source-run/source-deck/category/rules/evaluation/content/fixed-duration/timeline drift between outside preparation and transactional acceptance, and between preparation and readiness. They verify absent attempt/exposure/deck/run/start writes after rejected acceptance; preserved prepared state after rejected readiness; unchanged conversion clocks on genuine issued offers; discovery-to-acceptance and replay drift; equivalent legacy snapshot backfill/presentation/property order; historical runs without provenance; and no digest leakage through client run views. Legacy source answer changes are rejected even when their catalog token remains unchanged.

A final inspection-to-offer-commit regression exposed and fixed a changing-pool classification bug: a failed canonical commit must produce `eligibility-changed`, even when retrieval exhausted the pool, rather than returning `empty` and possibly selecting a bot. After projection refresh, a new lookup can issue the updated recording. This regression is included in the final 657-test gate.

Initial full runs revealed that current lookup telemetry counts the concurrent availability probe as well as bucket retrieval. The regression now explicitly expects the probe plus one comparable recording and allows its extra query; it still proves that more than 200 earlier-expiring mismatches do not consume the candidate window. Two earlier emulator startup attempts collided with another live local test process; the final gate used an isolated local port without interrupting it. No failed intermediate run is counted as verification.

All six guarded benchmark scenarios and successful replay phases passed on the final compiled backend with five observations per phase. The [saved report](race-match-benchmark-recording-integrity-2026-09-30.json) verifies terminal event/policy attribution and read/callback/fixture latency guards. It is local warm-process regression evidence, not production latency, billing or SLO proof.

## Final audit

The recording-provenance changes close the identified preparation/acceptance/readiness gap for newly issued records, with explicit historical limits above. The subsequent [final architecture audit](multiplayer-architecture-final-audit.md) traces supported ownership/storage checks across resume, readiness, settlement, deadlines and derived delivery, and verifies the client session integration. It closes the finite original MP1–MP9/VERIFY requirements; production rollout and historical evidence limits remain separate.
