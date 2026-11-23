# Multiplayer terminal hint confirmation

30 September 2026; working-source changes based on revision `c34be571`.

A server-authoritative hint can finish a challenger race when its penalty crosses
the opponent's finish or the maximum adjusted time. These terminal views have no
current riddle. Race Session previously treated that valid confirmation as an
invalid hint response and restored the attempt, showing an error instead of the
confirmed result.

Race Session now accepts an owned terminal hint view only when the final event
is a hint for the original question position, with the configured hint penalty,
matching correct count and an in-range revealed slot. The terminal status, role
and event clock must agree with competitive completion or timeout. It consumes
the paid checkpoint only after validation, reconciles the result once and issues
one outcome read. Inconsistent terminal receipts retain their rollback.

The injected authority adapter now mirrors the production terminal hint view,
freezes the terminal clock, returns the original receipt on repeated request IDs
and distinguishes an unfinished challenger loss from a tie. No server scoring,
locale files or platform contracts change.

Public-session regressions cover opponent-finish and timeout confirmations,
duplicate receipt delivery and eight inconsistent terminal payloads. Adapter
regressions cover both endings, frozen clocks and idempotent hint receipts. The
injected browser case accepts a real challenge and crosses the opponent finish
with a hint, checking the confirmed result, one penalty, one outcome read and no
error or recovery request. Companion cases cover active hint validation, draft
preservation and immediate opponent results.

Reproduce required checks and record completion through the existing dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-terminal-hint-confirmation.json
```

The recorder requires a stable source snapshot throughout verification. Accepted-
revision CI separately synchronizes completed work to the live dashboard. The
repository-wide TSDoc audit currently reports six undocumented declarations in
concurrent Reddit test work; none belong to this terminal-hint change.
