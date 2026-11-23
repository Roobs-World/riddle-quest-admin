# Multiplayer lifecycle response acceptance

30 September 2026 local development evidence. Named HTML5 platforms remain the
release scope; standalone web/PWA releases remain excluded. This change contains
no UI text, translation, production record or deployment changes.

## Reproduced effects after rejected responses

Seven public-interface Firestore emulator cases failed before the fix. Malformed
retained opponent presentation caused readiness to schedule or abandon an owned
run before strict public decoding rejected the response. Terminal resume granted
75 achievement coins and created delivery outboxes before the same rejection.
Legacy archived answers exceeding the public keyboard contract created new runs,
decks, exposure history, start receipts and exclusive challenger attempts before
resume rejected the view. An already accepted fallback with such an answer also
committed a new request alias before rejection. Fixtures used isolated demo data.

## Acceptance and commit share one transaction

The lifecycle module and start module now validate their exact accepted public
projection before committing effects. The shared response projection seam retains
strict contracts and reports a bounded data-loss error without answer-bearing
decoding diagnostics. Readiness samples after its reads and returns that validated
response, so countdown, deadline, offer readiness and response share one clock.
Rejected expiry responses also leave the prepared run unchanged.

Resume decodes inside the transaction after staged settlement; a failure aborts
rewards, statistics, run transitions and both delivery outboxes. New start validates
before writing exposure, deck, run, receipt, consumed offer or exclusive attempt,
and returns the same accepted projection. Concurrent duplicate starts still resume
their existing owner-bound run with freshly requested evaluation.

Both early accepted and concurrently accepted fallback aliases validate the actual
owned source and pending settlement before writing their receipt, then return the
accepted projection directly. Their retention is capped by the original run.
Changed-intent binding and canonical fallback ownership checks remain in place.

Opponent deletion is resolved before public decoding. Already-ready replays now
physically persist anonymization as well as presenting it, without resetting the
first accepted start. Optional preloaded evaluation is validated when requested;
server-only evaluation remains suppressed under its existing policy.

## Behavioural verification

Thirteen emulator tests cover the seven rollback regressions, repaired immutable
archive retries consuming one attempt under concurrency, fixed first readiness
with fresh replay clocks/evaluation, repaired concurrent resumes granting rewards
once, fallback alias lifetime and original run identity, deletion-safe recovery and
physical scrubbing, optional evaluation and server-only policy, and a deterministic
interleaving that accepts another fallback winner during content preparation.
The interleaving still uses real Firestore transactions and canonical storage.

The first full run passed these regressions but encountered six provision-option
failures during concurrent callable changes in the shared checkout. After those
changes completed, the combined response/callable subset passed all 86 tests.
No callable provisioning behaviour was changed by this response-acceptance fix.

The shared Jest browser test exceeded the enforced source-size limit. Its harness
state type was moved unchanged to the existing harness support module; portal
types passed. Missing documentation on concurrent test declarations was restored
without changing their behaviour. Source-size and TSDoc checks passed.

Final stable-source verification is recorded by
`docs/common/development/development-tasks/race-response-acceptance.json`: compiled Node 22 backend
and operator safeguards, full race coverage, backend types/lint, client recovery,
seven isolated platform artifacts and dependency audits, security, scalability,
source-size and TSDoc checks. The resulting local dashboard receipt establishes
this finite change only; the comprehensive reliability goal and production
publication remain separate.
