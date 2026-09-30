# Canonical record and legacy archive integrity

Local development evidence, 30 September 2026. No production records, configuration, deployment or index were changed.

## Implemented checks

- Supported runs validate ordered unique physical/canonical deck identities, current-position bounds, safe clocks and revealed hints against locale-aware answer graphemes.
- Live/prepared and terminal states cannot carry contradictory scoring or finish facts. Completed/timed-out clocks use persisted start plus wall duration; preparation remains unscored.
- Stored settled outcomes are bound to their parent run, challenge, result, counts, timing, penalties, opponent duration and publication/rematch flags. Settlement requires both a final outcome and a finish clock no later than settlement.
- Recordings validate penalty sums, adjusted duration and archived deck identity/order relationships. The immutable deck validator rejects duplicates even when directly called outside canonical record parsing.
- Legacy archive acceptance, resolution and reconciliation use a shared complete creator-record link check. Matching owner/language alone is insufficient. The original physical run identity, completed creator state, category/deck/rules, recording timing and timeline must agree. Publication follows finish. Fully archived recordings retain their independent lifetime.

## Verification

The final Node 22 backend race gate passed 611 tests across 44 suites: 96.73% lines, 94.57% statements, 88.57% branches and 97.13% functions. Ten operator command safeguards and the production module-cycle audit passed through its build prehook.

Pure tests cover deck identity/order, lifecycle/clock contradictions, hint positions and each owned settled-outcome relationship. Emulator tests corrupt canonical settled outcomes, then verify rejected resume/outcome reads, quarantined performance delivery, denied repair/replay, unchanged existing rewards and absent new performance evidence. Eight creator-source corruptions exercise acceptance, resolution and reconciliation without creating attempts or projections.

Synthetic matchmaking/tournament fixtures were corrected to keep wall and finish/adjusted clocks consistent with their intended valid recordings. The future-finish regression now expects canonical validation to reject the source before the narrower performance occurrence-time check; its quarantine and no-fresh-evidence assertions remain intact.

All six guarded benchmark scenarios and successful replay phases passed against the final compiled backend with the default five observations. This is fixture/lookup regression evidence, not production latency or billing evidence. Backend lint, scoped documentation (403 declarations across thirteen selected files), security/CI-security, scalability and whitespace checks passed. This backend-only change did not alter client UI or target capabilities.

## Remaining audit

Cross-record completion remains unproven. Acceptance and readiness still need a complete comparison between the archive used for preparation and the transactionally revalidated challenge, including immutable ghost and creator/category/deck facts. Session ownership and the original MP1–MP9/VERIFY audit remain required. This evidence does not close those requirements.
