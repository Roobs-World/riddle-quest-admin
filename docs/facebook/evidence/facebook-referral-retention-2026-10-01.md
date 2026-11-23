# Facebook referral retention — 1 October 2026

Status: implemented and locally verified; production rollout remains incomplete.
No deployment, backfill against live player records, provider upload, payment or
notification activation/send was performed.

The [native sharing review](facebook-native-sharing-2026-10-01.md) remains the
client testing package. This follow-up changes the Facebook server's temporary
invitation retention, with its own source/validation manifest. It does not rewrite
the earlier ZIP's provenance.

## Implemented behavior

New hashed Facebook invite-token rows carry a Firestore Timestamp at their exact
seven-day expiry. The committed field policy enables TTL only for
`facebookReferralTokens.expiresAt`. Permanent bindings and reward receipts retain
their existing lifetime/idempotency meaning.

A binding retains the token's issuance and expiry clocks. If TTL removes the
original temporary row, a matching already-bound invitation returns its original
expiry without rebinding or granting coins. An unbound player, different token,
corrupt window or deleted account fails closed. Actual first-win settlement still
uses authoritative solo/multiplayer results and the existing daily referrer cap.

The maintenance helper backfills one historical token and all matching lifetime
bindings in one transaction, before adding that token's TTL timestamp. It validates
all dependent windows before any write and refuses more than 200 bindings per token.
Missing rows are never recreated; already-prepared rows remain unchanged.

The CLI uses bounded pages of at most 100 tokens and defaults to dry run. It requires
an explicit project; writes additionally require `--apply --confirm-project PROJECT`.
Output contains aggregate counts and an opaque hashed continuation cursor, with
provider diagnostics, identities and raw invitation tokens excluded. Invalid rows
or excessive fan-out produce a nonzero exit and incomplete result. The checks are
included in the regular backend deployment-script test command.

## Verification

Logs and selected source hashes are in the
[review manifest](../../../artifacts/facebook-retention-review-2026-10-01/manifest.json).

| Check | Result |
| --- | --- |
| Full Functions unit tests | 114 suites / 1,379 tests passed |
| Supported runtime | The same 1,379 tests passed under Node 22.23.1 |
| Real Firestore emulator | 58 tests across retention and canonical race-settlement suites passed |
| Retention CLI guards | Four tests passed, including dry run, explicit apply confirmation, pagination and sanitized failures |
| Server/source checks | Backend lint/build/types, workspace types, TSDoc, file size and scalability passed |
| Platform builds | All six required isolated targets passed; GameSnacks also built |
| Reddit package | Package types/tests and isolation contract passed |
| Facebook boundaries | Commerce activation remains unreachable without verified authority; server secret audit passed |

The emulator has no automatic TTL worker. Its tests delete synthetic token rows to
verify behavior after cleanup; they do not prove production physical deletion.
The initial retention integration run used an incorrect account-deletion error
assertion; the corrected final 58-test run passed. Initial and final logs are retained.
No UI changed in this follow-up; the prior injected Facebook, Jest, Reddit, YouTube
and candidate browser evidence remains in the native-sharing review.

## Read-only provider checks and rollout gates

Firebase MCP environment and deployed-functions reads confirmed the expected
`riddle-quest-ec2b2` project and existing Facebook/Reddit Node 22 exports. The
read-only Firebase CLI index metadata on 2026-10-01 had **no**
`facebookReferralTokens.expiresAt` field policy. Only bounded metadata facts are
retained in the review manifest; no live player records were read by this check.

Deploy the new server behavior first, review dry-run page outcomes, apply the
explicitly authorized legacy backfill, retain every page's result, then deploy and
verify the committed TTL policy. Investigate invalid/high-fan-out rows. Confirm
actual deletion of an expired disposable test token and retry an existing binding
on the hosted platform before calling retention accepted. See the
[operator commands](../facebook-instant-games-operations.md).

[Firestore TTL](https://firebase.google.com/docs/firestore/ttl) deletes asynchronously;
the server continues to reject new binds after seven days regardless of physical
cleanup timing. Lifetime bindings/reward receipts are intentionally retained and
remain covered by account deletion.

Meta was also inspected read-only: the app is unpublished, Zero Permission Access
is ready for testing, all seven priced products already exist, test payment mode
is on, a valid payout account is still required, and no user notification templates
are configured. These facts do not establish purchase/refund verification or
hosted ad/notification acceptance. Meta MCP registration remains installed but
OAuth dynamic client registration is rejected; no working authenticated Meta
Instant Games management connector is claimed.
