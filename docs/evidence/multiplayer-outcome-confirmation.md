# Immutable race outcome confirmation

30 September 2026. Scope: multiplayer reliability on platform-specific HTML5
targets. No standalone web/PWA builds or translation changes.

The public session previously checked outcome ownership and arithmetic but could
accept an internally coherent replacement for a confirmed finish clock, a regressed
partial score, a changed penalty split, or an incorrect competitive result. The
separate outcome read could overwrite the displayed run and emit completion effects.

Outcome confirmation now checks the privately retained confirmed run. Terminal
facts are exact; active facts are minimum confirmed progress. The immutable ghost
finish determines full-score wins, ties and losses. Incomplete ghost losses retain
the server's finish rule, including penalties exceeding the ghost finish, and respect
maximum-time precedence. A completed full-score clearing action can still retain a
finish above the active limit; it is not clamped or manufactured into a timeout.

Repeated outcome reads compare against the previously accepted race facts, allowing
reward presentation metadata to change without duplicating completion effects.
Unseen progress from another tab may replace a local deadline projection. It does
not require events that this tab never received. Resume responses retain the ghost's
fixed timing/timeline while allowing display identity anonymization after deletion.
Run clocks must account for wall time plus penalties before they establish authority.

Public-interface regressions cover contradictory clocks, score, winner, tie, phase,
ghost timing, penalty allocation and deadline precedence; successful ties, slower
full-score finishes above the active limit, other-tab reconciliation, repeat reads
and privacy anonymization remain accepted. Focused verification passed 354 race
tests across 21 suites.

The injected Jest browser story completes ten genuine answers, corrupts only the
outgoing result clock by five seconds, observes rejection with unchanged visible
timing, retries the canonical result without replaying answers, then verifies
publication and reusable recipient acceptance. The recovery screenshot is
`/tmp/race-outcome-confirmation-recovery.png`.

The `race-outcome-confirmation.json` completion task revalidates final source with
the focused unit suite, portal types, all seven isolated artifact builds/dependency
audits, the complete injected Jest story, Facebook and Reddit browser harnesses,
file-size and declaration documentation gates. Its stable-source receipt is the
authority for dashboard completion. Provider publication and production deployment
remain separate; the broader multiplayer reliability goal remains active.

The initial final-source recording ran every declared check successfully but
withheld completion because other work changed the shared source digest. A retry
must revalidate the current source; the earlier passing run alone is not a stable
dashboard completion claim.
