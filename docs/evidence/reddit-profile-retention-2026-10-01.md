# Reddit cached-profile retention — 1 October 2026

Expired Reddit profile fields were hidden from social reads but could remain stored
inside permanent provider identity mappings. The new cleanup removes only the
nested `redditProfile` field. It never deletes the identity document or account,
changes a UID/generation, grants coins, or modifies Facebook/Jest provider records.

The real Firebase Admin SDK transaction re-reads each selected mapping, verifies
Reddit scope and a genuine expiry timestamp, and preserves a concurrent refresh.
Missing mappings are never recreated. One indexed page selects at most 50 records
plus a lookahead and emits only aggregate counts. The locally prepared scheduler
runs at minute 29 of each UTC hour with one instance and two retries. Malformed
state and transaction failures remain untouched and require investigation. A capped
backlog is reported as incomplete; the page budget promises no exact removal time.

The operator CLI requires an explicit project, defaults to dry run and needs
`--apply --confirm-project` with the identical project before writes. Unknown,
duplicate and malformed flags fail before SDK initialization. There is no caller
clock override. See the [operations runbook](../reddit-games-operations.md).

Executed checks are retained under
`artifacts/reddit-profile-retention-review-2026-10-01/validation`:

- Six real Admin SDK Firestore emulator tests passed on Node 22: dry run and
  field-only mutation; repeated cleanup; supported timestamp boundary; bounded
  pages and Facebook/Jest isolation; refresh/delete races; overlapping refresh
  and cleanup; malformed records and limits. The suite refuses production project
  IDs and non-local emulator hosts.
- Three scheduler tests and four actual CLI tests passed. Deployment-script tests
  passed all 53 cases; the export audit and hosted promotion gate require five
  Reddit entry points, including the supporting cleanup scheduler.
- The full backend passed TypeScript, ESLint and 117 suites/1,401 tests under
  Node 22.23.1. Source documentation, size and backend build checks passed.
- All six required target builds and artifact audits passed: Jest, Facebook,
  Reddit, YouTube, Netflix and Yahoo. Reddit package verification passed 35 tests.
- The browser-tested Facebook reference still matches all 41 selected client
  source files and all 399 artifact entries. This backend change adds no UI text,
  client code or provider SDK to another target.

The first emulator run exposed a fixture error: a one-nanosecond future timestamp
was rounded to the cutoff by Firestore. I corrected it to one microsecond and
asserted the persisted precision before checking it remains active. Both initial
and final logs are retained. Firestore stores timestamps with microsecond precision
and rounds down finer values. [Firebase data types](https://firebase.google.com/docs/firestore/manage-data/data-types)

The read-only Firebase MCP listing returned 90 deployed functions and no
`redditProfileRetentionScheduler`. The authenticated paginated index metadata read
returned HTTP 400, so index presence/readiness is unverified; this is not evidence
of an absent index. Sanitized summaries are retained next to the manifest. No
production account rows or secret values were read, and no cleanup, deployment,
upload or provider activation was performed.

The complete reviewed release must deploy the composite index for ascending
`provider` and `redditProfile.expiresAt` on `providerIdentities`, verify it is READY,
deploy the scheduler and record actual field cleanup. Never apply TTL to the
permanent identity mapping. Existing logical 24-hour suppression remains in force
while physical rollout is pending. The source remains dirty and this evidence is
for local review only; it does not authorize upload or prove hosted acceptance.

Follow-up: the [access and index review](provider-iam-readiness-2026-10-01.md)
resolved the HTTP 400: this project accepts only the default page size (`0`). The
complete authenticated listing returned ten indexes, no next-page token and no
matching profile index. That index is confirmed absent; rollout is still pending.
The initial rejected capture and manifest above remain historical evidence.
