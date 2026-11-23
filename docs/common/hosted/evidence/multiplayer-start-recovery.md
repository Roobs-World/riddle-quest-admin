# Multiplayer start recovery

30 September 2026; working-source changes based on revision `c34be571`.

Race Session retains a rejected preparation's complete category/challenge selection
and original start receipt. Retry replays that exact request, allowing authority to
resume the original run if preparation already succeeded. Recovery restarts its
preparation indicator and preserves the normal authority-owned countdown. Fresh
category selection, navigation, rematch and account changes invalidate old recovery.

Start confirmations must match the requested creator/challenger role and category
before they can save a resume hint or schedule readiness. Existing locale and challenge
identity checks remain in force. A malformed confirmation retains the original receipt
for recovery and cannot schedule the wrong run. Successful confirmation clears recovery
before readiness is issued. No translation strings or target provider contracts change.

The injected authority now deduplicates concurrent starts and reads the same run's
latest state on replay, matching the existing authenticated server start contract.
Public-session tests cover creator/challenger retry, mismatched metadata, duplicate
retry suppression, deliberate new selection and lifetime invalidation. Authority
adapter tests exercise concurrent receipt reuse and a scheduled run returned on replay.
The injected browser regression rejects or corrupts a successful History preparation,
then confirms two identical start receipts, one readiness command for the original run,
and its exact resume hint once gameplay begins. Companion browser checks cover quit,
delayed-start close and publication recovery.

Reproduce all required checks and record completion in the existing local dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-start-recovery.json
```

A completion receipt requires the source snapshot to remain stable throughout these
checks. Accepted-revision CI separately synchronizes completed work to the live dashboard.

Verification passed: 143 race tests, portal types, four selected browser tests, all
seven isolated target builds and artifact dependency verification. The browser tests
include both start-recovery failures and existing quit/publication/delayed-close paths.
The recovered History gameplay screenshot was inspected. File-size and scoped diff
checks passed. Earlier completion recording withheld its receipt because concurrent
source changes occurred during verification. The repository-wide TSDoc audit reported
undocumented declarations in concurrent matchmaking test work; it reported none of
the new start-recovery declarations.
