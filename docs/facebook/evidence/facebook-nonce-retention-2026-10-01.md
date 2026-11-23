# Facebook identity nonce retention — 1 October 2026

Status: implemented and locally verified; production rollout remains outstanding.

New Facebook identity challenges write an exact Firestore `expiresAt` timestamp
at the same five-minute deadline as `expiresAtMs`. A shared server-only module owns
issue/record/retention validation. The consumer keeps its transactional one-use
receipt and immediate logical expiry, accepts valid legacy rows during rollout,
and rejects clock rollback or contradictory timestamps. Fresh server time is checked
after the storage read, on transaction retry and after commit. If a commit spends a
nonce but completion crosses its deadline, authentication still fails and the caller
must obtain a new nonce. Timestamp comparison uses
the SDK's exact equality, since floating-point millisecond conversion can conceal
a nanosecond difference. No raw nonce or player identity is added to the stored
record; the existing consumed player-ID hash remains only until physical cleanup.

The committed unindexed TTL policy applies exclusively to
`facebookIdentityNonces.expiresAt`. The bounded operator CLI defaults to dry run,
requires an explicit project, rejects unknown/duplicate flags and nominated clocks,
and requires matching project confirmation to apply. Each transaction reads the
live nonce and adds only a missing timestamp at its original deadline. It preserves
consumption, skips missing rows without recreating them, and rejects malformed
state. Aggregate output contains no raw nonce, player or provider diagnostics.

The emulator verifies contention between consumption and backfill, exactly one
consumer, expired consumed migration, dry-run immutability, exact expiry, idempotent
retry, deletion and corrupt state. Both nonce integration suites refuse destructive
setup outside an explicit demo project and loopback emulator. These tests do not
simulate the production TTL worker. [Firestore TTL](https://firebase.google.com/docs/firestore/ttl)
deletion is asynchronous; physical expiry is separate from the five-minute
authentication boundary.

Executed checks and logs are retained in the
[review manifest](../../../artifacts/facebook-nonce-review-2026-10-01/manifest.json):

- Focused nonce/identity/security: 45 tests passed. New nonce policy unit coverage:
  10 tests. Operator CLI: five tests passed, including under pinned Node 22.
- Local Firestore emulator under Node 22: 12 tests across the existing replay/quota
  suite and new retention suite, including expiry after read/commit and later
  throwing/unsafe/backward clocks. Destructive setup is confined to
  `demo-riddle-facebook-nonce`.
- Full backend: 116 suites / 1,392 tests passed. The exact Node 22.23.1 runtime
  verifier also passed TypeScript, ESLint and the full 1,392-test suite.
- Deployment-script suites: 49 tests passed. Backend build, module-cycle, types,
  lint, TSDoc and source-size checks passed.
- All six required target builds and artifact audits passed. Reddit package: 35
  tests passed. This backend change adds no client SDK or visible string.

The first timestamp unit assertion exposed the nanosecond-rounding gap; exact SDK
equality fixes it. An initial manual Node 22 command omitted the repository's
`--experimental-vm-modules` flag, causing Yahoo dynamic-import tests to fail.
The corrected invocation and canonical runtime verifier both passed. Initial
diagnostic logs are preserved with final results.

Firebase MCP environment inspection succeeded. An authenticated read-only exact
Firestore Admin field request at `2026-10-01T07:09:39.614Z` reported
`ttlConfigured: false` for `facebookIdentityNonces.expiresAt` in
`riddle-quest-ec2b2`. The direct field read avoids treating the CLI's unpaginated
field-list output as exhaustive. No production nonce rows were read or changed,
and no TTL policy, backfill, deployment or upload was executed. The selected source
capture is dirty and does not establish upload eligibility.

Rollout requires reviewing the backend release, applying/retaining bounded legacy
page outcomes, deploying/verifying the TTL policy and observing physical deletion.
The [runbook](../facebook-instant-games-operations.md) records operator commands.
Actual Meta signed fixtures and hosted/device identity acceptance remain separate.

Reddit's unsigned gateway probe was also rerun successfully: the public route
rejects unsigned requests. Its six real contract fixture types and hosted acceptance
manifest still fail their validators because they are absent. This probe proves the
authentication boundary only; it does not prove allowlist approval, signed proxy
forwarding or a successful current private installation. The Reddit tracker retains
those external blockers.
