# Reddit race presence quota — 1 October 2026

The client polls presence every two seconds during a race. The shared backend
quota allowed only 20 requests per minute, so ordinary racing traffic exhausted
its budget before the minute ended. Presence leases last 15 seconds; the resulting
gap could make an active rival appear offline. Consent revocation through the
same polling operation could also be rejected after that exhaustion.

The exact `riddle-quest` app/user/`gameplay.presence.poll` key now receives a
server-owned 60-request minute budget. All other operations retain 20. The endpoint
still derives the key from the signature-verified, nonce-consumed assertion;
browser payloads cannot request a larger budget. Matching requires exactly three
key components and the exact operation. The existing HMAC namespace, transaction
serialization, minute reset and 24-hour expiry binding are preserved. Existing
20-count polling rows are valid under the larger budget.

Validation logs are retained in
`artifacts/reddit-presence-quota-review-2026-10-01/validation`:

- The initial real Admin SDK emulator test failed on a valid signed poll during
  normal race polling. The failure is retained in `reproduction.log`.
- Six gateway replay/quota tests and the existing presence integration test passed
  with Firestore and Realtime Database emulators under Node 22.23.1. They cover
  thirty signed two-second polls and immediate opt-out, exactly 60 successful
  requests under 64-way contention, the next window reopening, other operations
  and malformed operation suffixes staying at 20, nonce replay, expiry after
  persistence, corrupt TTL binding, known-rival privacy, blocking and deletion.
  The signed-poll test exercises the actual verifier and quota with the same key
  construction as the endpoint; it does not call a hosted HTTP endpoint.
- TypeScript, ESLint, backend build and source-documentation checks passed. The
  full Node 22 backend passed 117 suites and 1,401 tests.
- All six isolated builds and artifact audits passed. All 399 Jest, 399 Facebook,
  412 Reddit and eight each YouTube/Netflix/Yahoo artifact files match the retained
  reference byte for byte. All 41 selected Facebook client source files match its
  previous browser-tested reference. No UI or locale changed in this fix.
- The Devvit package passed its 35 tests and package contract: 413 regular files,
  7.18 MiB, isolated clients and one approved gateway host. Reddit documentation
  and progress checks passed; release progress remains 36 of 49 tasks complete.

Two initial test invocations had setup errors: the presence suite was started
without the database emulator, and the backend suite omitted its VM-module flag.
Their logs remain alongside the successful corrected runs. Neither required a
product-code change.

This is a local backend fix. It has not been deployed, and hosted contract probes,
provider acceptance, clean source identity and immutable deployment evidence remain
required. A rollback to the old validator must account for polling records with
counts above 20; that validator rejects those records until removed, even after
the minute expires. No production quota rows were read or changed. The bounded
budget is shared across a user's tabs and does not promise unlimited polling or
opt-out after abusive exhaustion.

Facebook purchases and rewarded grants remain gated on real provider verification
and approved configuration. The official Meta Social Technologies MCP is
registered with eight read tools; its account access still awaits the existing
user approval. This quota fix neither enables those features nor changes Jest.
