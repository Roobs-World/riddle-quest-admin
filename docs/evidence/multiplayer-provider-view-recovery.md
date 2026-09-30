# Multiplayer provider view recovery

30 September 2026; working-source changes based on `c34be571`.

Optional tournament and context standings now have a single observable request
owner in `RaceProviderViews`. Race Session screen notifications invalidate reads
synchronously when the player navigates, starts a run or changes account/language
entry. Each delivery owns a 30-second timer. Expiry releases its loading state
and exposes the existing translated error/Retry flow; retry repeats only the
provider read. Successful refreshes update their cache atomically with loading
completion. Duplicate clicks cannot overlap reads. Late success/failure cannot
finish a newer delivery, and responses for another language are rejected.
Disposal and entry replacement clear both caches and cancel the timer.
Inbox Retry refreshes both the optional context view and authoritative inbox so
simultaneous read failures cannot leave one of them unrecovered.

The module uses the existing target-specific tournament/context interfaces;
competitive scoring and provider recording remain independent. No SDK or new
visible text is added, and no locale files are edited.

Public-interface tests cover both provider interfaces, the exact deadline,
retry, stale success/rejection after reentry, adapter replacement, disposal,
synchronous throws, repeated clicks, wrong-language replies and absent capability.
The injected Reddit browser deliberately loses a standings response after leaving
and returning to the same tab, releases an older successful response while a new
read is loading, waits for the actual delivery deadline, retries and releases a
late rejection after recovery. The recovered Arabic standings screenshot is
`/tmp/race-provider-view-recovery.png`.

The broader Jest publication flow exposed a scheduled-countdown regression:
the authority clock activated the run and removed countdown before GO could
render. Scheduled starts now retain the existing 180-ms GO display while keeping
the original server start and clock anchor. Background catch-up beyond that
interval still enters gameplay directly. A public session regression verifies
1/GO/gameplay boundaries, pre-game input gating and the 180-ms authoritative
elapsed time when gameplay opens.

The complete publication check also found the injected authority incorrectly
marking creator recordings as rematchable. Its outcome capability flags now match
production: only completed challenger runs are rematchable, and only completed
creator runs clearing the target are publishable. Existing terminal-outcome
regressions assert both flags. Countdown observation/assertions were moved into
the focused browser helper; the repository-wide file-size check now passes.

Verification and stable-source completion recording use:

```sh
pnpm development:complete docs/development-tasks/race-provider-view-recovery.json
```

This task is partial evidence for the active full multiplayer reliability audit.
Repository-wide file-size and TSDoc findings in concurrent edits remain separate
gates. A completion receipt is required before claiming a dashboard update.

Latest manual evidence: 263 focused race tests, portal types, all seven isolated
target builds and their dependency evidence passed. The injected Reddit recovery
flow passed, as did both Jest publication and paid-rollback checks. The global
file-size check passed for 819 source files. Repository-wide TSDoc findings in
other concurrent work remain; none name the provider module or its tests.
