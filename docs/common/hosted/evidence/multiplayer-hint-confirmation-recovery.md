# Multiplayer hint confirmation recovery

30 September 2026; working-source changes based on revision `c34be571`.

Race Session now verifies a hint confirmation's question identity, position and
answer length before consuming the Race Projection rollback checkpoint. Every
revealed position must be unique and inside the answer, and the response's hint
letter must agree with the authoritative reveal at its index. Invalid confirmations
retain the original question, draft, selected position and receipt clock. They do
not emit a successful hint analytics event. Retry reads the existing run, allowing
an already-applied hint to recover without a second paid request.

Valid confirmations merge the entire server reveal set into the retained draft.
This includes hints applied by another tab since the client's last authority view.
Selection moves to an editable slot if any confirmed reveal now occupies it. Input
at unrevealed positions remains intact. Validation also applies to legacy authority
views without a local evaluation deck. No locale files or provider contracts change.

Public-session regressions exercise conflicting hint letters, absent reveals,
duplicate and out-of-range positions, wrong question/position/length, read recovery,
and multiple hints applied through the injected authority. The browser regression
corrupts successful hint confirmations for a wrong letter and a wrong question,
verifies the original draft and zero provisional penalty after rollback, and then
confirms one resume read, one paid request and the recovered 15-second penalty.
Companion browser checks cover draft preservation, wrong-run paid rollback and lost
hint/skip confirmation recovery. The focused browser helper keeps the existing test
file within the repository's source-size limit.

Reproduce the required checks and record completion through the existing dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-hint-confirmation-recovery.json
```

Completion requires a stable source snapshot throughout verification. Accepted-
revision CI separately synchronizes completed work to the live dashboard. The
repository-wide TSDoc audit currently reports six undocumented declarations in
concurrent Reddit test work; none belong to this hint-confirmation change.

Verification passed: 152 race tests, portal types, four selected injected browser
tests, all seven isolated target builds, artifact dependency verification and the
maintainable-file-size check. The browser test covers both corrupt confirmation
cases, and the recovered gameplay screenshot was inspected. The completion command
passed every declared check but withheld its dashboard receipt because the shared
source changed during verification. No completion row was recorded for this task.
