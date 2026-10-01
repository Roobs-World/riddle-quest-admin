# Multiplayer readiness and delivery ownership

30 September 2026 local development evidence. Scope is named HTML5 platform
artifacts only; no standalone web/PWA release or translation changes.

## Reproduced failures

Four public Race Session cases reproduced a readiness response that remained in
preparation. The client accepted that echo and immediately sent readiness again,
including saved-run recovery and explicit retry. Closing during readiness also
consumed the invalid reply and initiated abandonment instead of preserving the
pending close for explicit recovery.

Six more cases reproduced a throwing bridge adapter. A readiness delivery exception
inside start-confirmation processing could discard an already accepted prepared
run and mislabel its valid reply as invalid. Direct start, hint, skip and guess
delivery could escape through UI event handlers. An adapter that dispatched a
valid start reply and then threw could also escape despite accepted authority.

Two cases reproduced errors from obsolete deliveries poisoning a newer retry
that deliberately reused the same start mutation receipt. A cancelled timer
callback could additionally clear the newer timer handle: a follow-up readiness
command then retained two timers rather than one, and disposal could not cancel
the leaked timer. That assertion failed independently during correction.

## Correction

Readiness acceptance requires scheduling, active progress or terminal recovery;
a validly shaped preparation echo is rejected before it changes authority or
issues follow-up commands. Owned state, input and close intent remain recoverable.
An explicit retry schedules the same run or confirms its abandonment.

The gameplay delivery module reports a throwing host adapter through the same
correlated failure interface used for delivery expiry. Accepted start authority
and action rollback checkpoints are preserved. A throw after a synchronous reply
is ignored when that delivery has already been consumed or superseded.

Each delivery retains its own private identity even if explicit mutation retry
reuses the server-authoritative receipt. Timer and transport-error callbacks check
that identity before rejecting state or clearing the timer handle. Canonical host
replies still correlate by request ID and operation, preserving idempotent replay.

## Verification

All 378 public client race cases pass, including the twelve reproduced cases and
five positive readiness phases (scheduled, active, completed, timed out and
abandoned). Tests check original start receipt reuse, unchanged input/clock after
paid-action or guess failure, explicit recovery, duplicate echoes, accepted start
analytics, pending-close recovery, stale queued timer callbacks and full timer
cancellation on disposal.

The injected real UI passes six browser cases: at 1280px and 390px, preparation
echo, throwing readiness delivery and a throw after synchronous start confirmation.
Rejected readiness issues exactly one request, exposes an enabled retry button
and recovers the same run without another start. Post-confirmation exceptions do
not produce a browser exception or invalidate accepted scheduling. Screenshots
are under `artifacts/race-readiness/`; the mobile rejection was visually inspected.

Stable completion recording uses
`docs/development-tasks/race-readiness-delivery-ownership.json` for fourteen checks:
full backend race emulator coverage/operator safeguards, core and client tests,
types/lint, the injected browser cases, seven isolated platform artifacts and
repository/dependency safeguards. Completion is recorded in the local dashboard
only after every check passes against unchanged source. Upload, activation,
publication and Functions deployment are outside these verification commands.
Jest build activation and Firebase Functions deployment are authorized; game
publication, review submission and listing visibility remain on hold.

Two fourteen-check runs passed every required command but withheld their
completion records because concurrent work updated
`docs/evidence/multiplayer-live-fixes-2026-09-30.md` during verification. Those updates are
preserved. Completion recording must repeat against the current stable source;
the source-change safeguard is not weakened.
