# Multiplayer resume-hint ownership

30 September 2026; base revision `c34be571`, with working-source changes.

Resume-hint cleanup now checks both authenticated account and expected run identity.
An older race cannot clear a hint that already points to another run for that same
account. Race Session passes the exact identity on completion, abandonment and
failed startup recovery. Account-wide cleanup remains available independently.

The storage regression failed before the fix because clearing the older run deleted
the newer hint. Public-session tests cover the exact cleanup arguments. An injected
browser regression inserts a newer same-account hint immediately before an older
terminal receipt and verifies preservation through both completion and quitting.
The existing quit regression still verifies deletion when the saved run matches.

Verification passed: 105 race tests, portal types, three selected browser tests,
all seven isolated target builds and artifact dependency verification. Browser tests
cover both terminal paths, normal quitting and lost paid-action recovery. The completed
race screenshot at `/tmp/race-newer-resume-hint.png` was inspected. Maintainable-file
size and scoped whitespace checks passed. No locale files were edited for this fix.

The completion recorder withheld its dashboard receipt because concurrent edits
changed the shared source during verification. Reproduce the checks and record
completion when the checkout is stable:

```sh
pnpm development:complete docs/common/development/development-tasks/race-resume-hint-ownership.json
```

The repository-wide TSDoc audit still reports one undocumented declaration in
concurrent backend test work; none of the changed resume-hint declarations are reported.
This scoped verification does not establish completion of every multiplayer requirement.
