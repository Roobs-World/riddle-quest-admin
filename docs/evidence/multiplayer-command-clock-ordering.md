# Multiplayer command clock ordering

30 September 2026 local development evidence. Platform-specific HTML5 targets only;
standalone web/PWA builds remain excluded. No production records or deployment were
changed. No UI text or translations were changed.

## Reproduced failure

The public backend commands sampled their clock before the Firestore transaction.
An older sampled command could be applied after a newer accepted command, including
when a transaction retries against updated authority. A focused emulator regression
first failed on both scoring and a wrong-guess clock with no scoring event.

On the tenth question, a hint accepted at one second followed by a skip sampled at
half a second produced a 60.5-second finish against a 60.75-second ghost. That recorded
a win even though the already accepted progress required at least a 61-second finish
and a loss. This was a local synthetic reproduction; no production history was read.

## Implemented authority

The server retains optional `lastActionAtMs` on every accepted mutation, including
wrong guesses. The Race engine resolves an operation's sampled clock against that
marker and existing scoring-event clocks. Historical runs derive their initial
floor from their scoring history without rewriting past receipts.

The mutation interface supplies the resolved clock to scoring and response projection.
Rate limits, settlement, achievement/outbox receipts and reward presentation use the
same floor. Resume and projected server time cannot move behind accepted progress.
The scheduled start and absolute deadline remain fixed; early scoring still fails.
Exact request replays retain the original response and do not advance the marker,
charge penalties or repeat rewards.

Stored full-score finishes must also follow their own known action/event clocks.
Historical backdated completed wins are rejected before rewards. Incomplete ghost
and maximum-time losses retain the engine's legitimate penalty/deadline clamp, which
can place the terminal wall clock before the triggering event. No historical result
is silently rewritten, and incomplete historical command clocks are not invented.

## Verification

Public-interface emulator tests cover the wrong-winner reproduction, wrong guesses,
older resume/outcome reads, historical scoring-event fallback, distinct simultaneous
hints, parallel duplicate delivery and later exact replay, scheduled pre-start
rejection, and a stored historical backdated win without reward writes.

Canonical record tests reject invalid marker timestamps and full-score finishes
before either a marker or scoring event, with and without matching settlements.
The existing complete race gate retains exact ties, terminal penalty overshoots,
short legacy decks, privacy, durable delivery and idempotent reward evidence.

Stable-source completion uses `docs/development-tasks/race-command-clock-ordering.json`
and records the pinned Node 22 backend coverage/build/operator gates, client recovery
tests, all seven isolated builds and dependency evidence, backend lint/types, security,
scalability, declaration documentation and source-size checks in the local dashboard.
The broader multiplayer reliability goal remains active.
