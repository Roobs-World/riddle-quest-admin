# Facebook context retention — 1 October 2026

Status: implemented and locally verified; deployment and hosted acceptance remain
incomplete. No live player records were purged and no provider upload, backend
deployment, purchase or notification activation/send was performed.

Expired Facebook context boards previously retained their membership until a later
rollover or account deletion. The new hourly scheduler removes a bounded page of
expired boards. Each transaction reads the current board again, validates the exact
server-owned scope/window/membership, reads all bounded scores, and deletes the
parent and every score together. A query made before another player renews the board
cannot authorize deletion of that replacement. No parent TTL policy is added.

Each invocation processes at most 20 boards and at most 50 score entries per board.
Corrupt records and excessive fan-out remain untouched and yield aggregate incomplete
work evidence. The scheduler reports a sanitized error for operator investigation.
Healthy remaining pages are processed by later invocations. No cleanup changes an
account, known-rival relationship, balance, settlement or another provider's state.

Only identity-free history is written: hashed scope, type/locale, original start/end,
participant count, archive clock and no-reward marker. Its TTL remains exactly 30
days after the original board end; cleanup does not extend retention or recreate
already-expired history. Missing boards are never recreated by a retry.

The operator command defaults to dry run, requires an explicit project, uses only
the server clock, and accepts a bounded limit. Writes additionally require explicit
`--apply --confirm-project PROJECT`. It rejects unknown, duplicate, missing and
out-of-range arguments before SDK initialization. Output includes counts only.

[Firestore TTL](https://firebase.google.com/docs/firestore/ttl) does not cascade
subcollection deletion. The transactional purge therefore removes scores along
with their parent instead of leaving orphan scores under a deleted board.
[Scheduled delivery](https://firebase.google.com/docs/functions/schedule-functions)
may overlap/repeat; correctness comes from transactions and idempotent missing/active
outcomes, alongside bounded runtime/instance/concurrency settings.

## Verification

[Source and validation manifest](../../../artifacts/facebook-context-review-2026-10-01/manifest.json).

| Check | Result |
| --- | --- |
| Real Firestore emulator | Seven tests passed: dry run, parent/score deletion, identity-free history, exact expiry, late cleanup, malformed scope/clock, fan-out containment, bounded pages, renewed-board selection, concurrent rollover, duplicate purge and account deletion |
| Scheduler unit tests | Three passed: actual registration/options, one-page current-clock authority and sanitized failure reporting |
| Operator CLI | Four passed: offline argument guard, dry run, exact project confirmation and private error suppression |
| Full Functions | 115 suites / 1,382 tests passed; the same suite passed on Node 22.23.1 |
| Backend release surface | 22 required Facebook/supporting exports pass, including the new scheduler; deployment script tests pass |
| All isolated builds | Six required targets plus GameSnacks passed with artifact/locale boundaries |
| Reddit package | Types, server tests and isolated inline/game/CJS package contract passed |
| Source checks | Backend lint/build/types, workspace types, cycle audit, TSDoc, file-size and scalability passed |

The initial scheduler test run used cleared mock registration history and omitted
an initialized Firebase test app. Its fixtures were corrected; the final scheduler
and full suites passed. Initial and final logs remain in evidence. No UI changed;
prior injected Facebook/Jest/Reddit/YouTube/candidate browser evidence is retained
in the [native sharing review](facebook-native-sharing-2026-10-01.md).

## Rollout gates

Firebase MCP read the expected `riddle-quest-ec2b2` environment and deployed function
names. Existing Facebook and all four Reddit gateway exports are Node 22 in
`us-central1`; **facebookContextRetentionScheduler is absent**. Presence of the
other exports is not proof of their deployed source revision. Only this bounded
metadata result is retained; no live player rows or private credentials were read.

Deploy the reviewed backend unit, retain its source/revision evidence, preview
aggregate expired-context pages, and exercise an expired disposable context plus
fresh rejoin and account deletion on hosted role accounts. Confirm the schedule's
permissions, actual deletions and existing entry/history TTL policies. Investigate
malformed/oversized contexts through approved operator access rather than widening
limits. The [runbook](../facebook-instant-games-operations.md) records commands.

This follow-up preserves earlier client ZIP provenance. The shared worktree includes
concurrent multiplayer changes and is dirty; it is not an upload-eligible clean
source handoff. Meta/Reddit approvals, real provider contract fixtures, commerce/ad
and reminder authority, physical devices and final exact-byte ingestion remain
separate unresolved gates.
