# Multiplayer retained timeline authority

30 September 2026 local development evidence. Only named HTML5 platforms remain in
release scope; standalone web/PWA releases stay excluded. No production records,
backend deployment, platform publication, visible UI text or translations changed.

## Reproduced false winner

Three public-interface emulator regressions failed before this fix. A challenger
retained a hint event charging 15,000 milliseconds, while its aggregate hint penalty
had been corrupted to zero. Its final correct answer was accepted as a one-second
clean win against a ten-second opponent. Outcome settlement awarded 75 coins,
including first-win and clean-run achievements. Copying that false outcome into
matching settlement metadata did not prevent subsequent reads from accepting it.
This reproduction used a dedicated demo emulator and synthetic records.

## Known history constrains authority

The canonical storage reader now validates retained event history against run and
recording authority. A shared private timeline implementation covers owned scoring,
archived recordings and source-independent opponent playback before scoring,
settlement, publication, acceptance or durable delivery can trust those records.

Known events must have contiguous sequence identities, safe durations, nonregressing
wall clocks and cumulative charges. Question transitions and score deltas must
follow hint/clearing semantics; an active run must advance after clearing a question.
Events cannot refer outside the owned deck or run ahead of its retained progress.
Accepted action markers cannot precede known scoring clocks. Retained hint and skip
charges separately constrain their corresponding aggregate totals, preventing a
hint charge from being erased or moved into another penalty type.

Known hints are bounded by the immutable rules and authored grapheme count on each
question. Answer-free legacy archives use their retained rules limit. Timeline size
matches the public bounded event contract. Recording/opponent events cannot extend
beyond their fixed adjusted finish; incomplete player deadline losses still retain
the engine's legitimate backwards wall-clock clamp after a penalty triggers expiry.

Empty historical event arrays and missing prefixes remain supported. Retained
history supplies lower bounds; this change does not invent a full legacy score or
penalty split from missing events. Supported older non-clearing skip events and the
existing synthetic playback remain valid. No historical result is silently repaired.
One settlement regression fixture was corrected to place its tenth clearing action
on the tenth owned question rather than scoring ten clears on its first question.

## Verification

Public-interface emulator tests reject the erased-charge final answer and false
winner reads, including matching settlement metadata. Balances, stats, achievements,
run state, action receipts and durable outboxes remain unchanged after rejection.
Deadline processing quarantines inconsistent known history, rejects replay before
repair, and settles an explicitly repaired charge as a genuine ghost loss without
repeating rewards on later outcome reads.

Canonical reader tests cover sequence/position/score corruption, unsafe clocks,
backwards wall/cumulative-penalty histories, missing charges, penalty-type swaps,
accepted-clock contradictions, live advancement, authored/legacy hint limits,
archive totals and fixed opponent playback. Actual engine histories cover wrong
guesses, hints, automatic and paid skips, completion, abandonment and deadline
clamps. Empty/prefix history and fifty deterministic synthetic opponent histories
retain compatibility. The full backend gate passed 749 tests across 52 suites.

Final stable-source verification uses
`docs/development-tasks/race-timeline-authority.json`: Node 22 backend build/operator
safeguards, full race coverage, types and lint; client recovery; seven isolated Web
Targets and dependency audits; security, scalability, TSDoc and source-size checks.
Its completion receipt updates the existing local dashboard. The broader
multiplayer reliability audit and separate deployment/provider gates remain open.
