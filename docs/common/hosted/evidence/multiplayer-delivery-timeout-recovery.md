# Multiplayer delivery timeout recovery

30 September 2026; working-source changes based on revision `c34be571`.

Race Projection now owns a cancellable 30-second response deadline for each bridge
receipt issued by Race Session. Expiry enters the existing correlated failure path,
allowing controls and projected input to recover even if the bridge delivers no
response envelope at all. Expiry does not automatically repeat a mutation. The
server remains authoritative: delivery expiry says nothing about whether the
original action succeeded.

Recovery retains the original preparation, quit and publication receipts. Hints
and guesses use the existing owned-run refresh path, and readiness retries the same
owned run under the server's existing idempotent readiness contract. A matched
response cancels its timer before a chained command is issued, so readiness gets
its own complete deadline. Unrelated or malformed envelopes cannot extend the
deadline. Replacement commands, navigation and account/session disposal cancel
old timers; expired late responses cannot consume a newer recovery receipt.

Public-session regressions cover dropped preparation, hint, guess, readiness,
quit and publication responses; original receipt reuse; draft/clock/loader rollback;
late success during a resume; malformed traffic; and account/disposal cancellation.
The injected browser regression drops a genuine successful hint event completely,
waits for the unmodified production deadline, verifies rollback, replays the late
success, then recovers with exactly one hint mutation and one resume read. It checks
the preserved draft, recovered reveal and single 15-second penalty. Companion
browser tests cover malformed hints and existing start/quit/publication recovery.
No locale files or target provider contracts change.

Reproduce required checks and record completion through the existing dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-delivery-timeout-recovery.json
```

The recorder requires a stable source snapshot throughout verification. Accepted-
revision CI separately synchronizes completed work to the live dashboard. The
repository-wide TSDoc audit currently reports six undocumented declarations in
concurrent Reddit test work; none belong to this delivery-timeout change.

Verification passed: 160 race tests, portal types, five selected injected browser
tests, all seven isolated target builds, artifact dependency verification and the
maintainable-file-size check. The new browser regression uses the complete 30-second
production deadline. The recovered gameplay screenshot was inspected; scoped diff
checks also passed.

The completion command passed every declared check but withheld its dashboard
receipt because the shared source changed during verification. No completion row
was recorded for this task; rerun the saved command against a stable revision.
