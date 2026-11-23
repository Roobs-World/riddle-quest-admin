# Multiplayer owned position authority

30 September 2026 local development evidence. Named HTML5 platform artifacts
remain the release scope; standalone web/PWA releases are excluded. This change
does not modify translations, visible UI text or production data.

## Reproduction and correction

Eight public-interface demo-emulator regressions failed before the correction.
A terminal run with ten clears, position zero and no retained events earned a
clean-win reward through resume and outcome. Publication also accepted this
impossible recording. An unfinished run could claim nine clears while still
waiting on its first question. Both unversioned and modern records were affected.

The canonical run reader now constrains score by the immutable owned question
position and deck length, independently of retained event history. The tenth
clearing action stays on its final question, so completed ten-clear runs account
for that final action. Modern versioned runs require an exact match between
clears and question progress. Historical unversioned skips could advance without
adding a clear; their lower scores remain supported, including a tenth clear late
in the original fifteen-question deck. Missing history cannot justify a score
ahead of the owned position.

Public resume, outcome and publication reject contradictory records before owner
grants, outboxes, archives or request receipts change. After explicit position
repair, concurrent retries of the original operation grant or publish once.

## Verification

Eight emulator cases verify rejection, rollback and explicit repair. Eight
canonical-reader cases use the real engine for correct, automatic-skip, paid-skip
and hinted clears, both with full events and with retained events removed. They
also cover preparation, countdown, abandonment, deadline loss and supported
legacy non-clearing skips.

The first broad run passed 817 tests and exposed thirteen older settlement
fixtures that injected ten clears into a one-question, position-zero run. Those
fixtures now use a full deck and explicit positions consistent with their tested
progress; their settlement, false-winner and future-clock assertions remain.
All 66 focused cases passed. Their subset invocation intentionally lacked enough
coverage to satisfy the full-suite threshold; the completion recorder runs the
entire coverage suite.

Stable-source verification is recorded through
`docs/common/development/development-tasks/race-position-authority.json`: Node 22 backend/operator
checks, full race coverage, types/lint, client recovery, seven isolated artifacts
and dependency evidence, security, scalability, file-size and TSDoc gates. The
receipt updates the local development dashboard. The comprehensive multiplayer
reliability goal remains active; production rollout requires separate evidence.
