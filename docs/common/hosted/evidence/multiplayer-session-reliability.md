# Multiplayer session reliability

30 September 2026; working-source changes based on revision `c34be571`.

Recorded discovery now owns a 30-second delivery budget independently of provider
transport behaviour. Expiry settles the caller, releases the loading state and
offers a same-intent retry after a one-second monotonic delay. It never silently
issues another search. Navigation, rematch, disposal and account/language entry
settle and cancel the wait. Provider success or rejection after settlement cannot
change the newer journey. Normal completion removes the deadline timer.

Complete reveal validation now covers preparation, readiness, resume and skip
snapshots as well as hints and guesses. Out-of-range or repeated reveal slots are
rejected before a paid checkpoint or successor recovery candidate is consumed.
Read recovery remains available with the original input and clock.

The injected authority adapter now rejects new guesses, hints and skips before
the scheduled start, after abandonment/completion, and for a stale question.
Existing receipts remain replayable. Automatic skips count each exhausted question
as cleared, record the updated count in their event and finish on the tenth clear.
Intermediate manual/automatic skips use the production competitive penalty rule,
including timeout precedence and frozen terminal clocks.

Completed challengers whose final clearing penalty makes them slower now project
an opponent win instead of a tie. Confirmed terminal clocks are preserved even
when total penalties exceed the active challenger limit; only active display
clocks are clamped. A server-confirmed timeout likewise retains its canonical
adjusted finish instead of substituting the active-play limit.

Public-session and adapter regressions cover lost discovery, late success/failure,
lifetime cancellation, normal timer cleanup, malformed snapshots, repeated read
failure, fifty idempotent wrong guesses across ten questions, all inactive states,
stale-question mutations and hint/manual/automatic penalty endings. The Jest
browser checks exercise duplicate reveals during recovery and a real fifth-guess
automatic skip, and the final clearing skip before a delayed outcome read. The
Reddit browser deliberately stalls the first provider request
past the session budget, retries the same intent, rotates only after an explicit
new-intent failure and ignores the released stale response. Its injected provider
timeout is extended to isolate the session budget; production transport policy is
unchanged. Browser observation waits for the recovery error, avoiding a flaky
assertion on the short disabled-button interval already proved by unit tests.
Its initial locale is seeded consistently with the authoritative preferences and
API fixtures echo the requested locale, preventing a startup language transition
from cancelling the deliberately stalled search.

No locale files, provider contracts or server scoring change. The existing hint
draft browser flow was moved into its focused helper to preserve the test-file
size limit. Screenshot paths are `/tmp/race-discovery-deadline-recovery.png`,
`/tmp/race-guess-draft-confirmation-recovered.png` and
`/tmp/race-automatic-skip-confirmation.png` and `/tmp/race-final-skip-result.png`.

Later snapshots now retain the original role, category, direct challenge and
counter-challenge context, including recovery reads for a different question.
Readiness, guesses and paid actions reject mismatches before consuming rollback
state. Final outcomes must retain challenge ownership, coherent penalty/clock
totals and results/capabilities consistent with the run role and cleared count.
The browser recovery flow now rejects duplicate reveals, then changed category,
before a genuine read restores successor typing without another guess.

The latest verification passed all seven declared checks: 233 race tests, portal
types, seven isolated builds, six injected Jest cases, the Reddit deadline flow,
artifact dependency evidence and file-size checks. Concurrent source edits caused
the recorder to withhold its receipt at the final source-digest check. No dashboard
completion is claimed until verification produces a stable receipt. The Reddit
fixture waits for the observed Arabic `host:init`, since document translation can
commit before the game frame's locale authority receives initialization.

Reproduce and record these checks through the existing dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-session-reliability.json
```

The recorder requires a stable source snapshot. Accepted-revision CI separately
synchronizes completed work to the live dashboard. Six unrelated Reddit test
declarations remain undocumented in the repository-wide TSDoc audit.

This is partial evidence for the broader reliability goal, not a whole-multiplayer
completion claim. Remaining audit areas are tracked in the reliability audit.
