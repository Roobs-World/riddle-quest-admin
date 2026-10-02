# Reddit live actions and quota contention — 2 October 2026

Reddit Live PvP used one 120-request minute budget for background observations
and every player command. A human match can poll every 500 milliseconds, so
polling could consume all slots and refuse guesses, hints, skips and leaving.
Four signed HTTP gateway regressions reproduced HTTP 429 against an exhausted
real Firestore quota row. They use local fixture secrets, one-use production
signatures and provider-generation resolution in a private demo emulator.

The gateway now derives a separate internal command quota only after verifying
the signed assertion and parsing a valid live action. Polling retains the
existing hashed row and 120-request minute cap; valid guesses, hints, skips and
leaving share a second 120-request cap. Malformed inputs retain the original
budget. The internal `.command` name is not an allowed public gateway operation,
and payload changes cannot reassign a signed request. Existing other operation
limits, the 60-request presence budget, UTC windows and quota retention remain.
No account, balance or gameplay mutation is authorized by quota classification.

The broader run reproduced the previously recorded 64-request presence failure:
Firestore exhausted transaction retries with `ABORTED: Transaction lock timeout`.
In-flight requests to the same hashed quota row are now serialized within one
runtime. The queue stores only a hash and pending turn, never a cached balance
or raw provider identity. Every request still reads and updates the authoritative
Firestore transaction. Success and failure both release their turn, and the
last turn removes the process entry. Distinct quota rows proceed independently.
The original 64-request assertion passes without reducing concurrency, increasing
caps, extending test timeouts or accepting transient failures as denials.

Executed verification:

- **48 cases / 4 suites pass** with real demo Firestore and Realtime Database:
  gateway replay/quotas, Reddit presence, Reddit live referrals and Facebook live
  score delivery. The new signed command cases reach the expected missing-seat
  rejection after exhausted polling; they also reject malformed budget fields,
  signature payload tampering and nonce replay, while actual polling stays
  limited. This is gateway permission evidence, not a successful full hosted race.
- The two 120-request buckets independently refuse request 121 and reset at the
  next minute. Lookalike operation names retain 20-request limits. Corrupted TTL
  bindings fail closed, concurrent failures release the queue, and repaired
  records can be consumed normally.
- A separate Node 22 diagnostic starts two independent processes per operation
  against the same Firestore row. They collectively accept exactly 60 presence
  requests, 120 live polls or 120 commands, and refuse four excess requests in
  each case. Stored counts equal those caps, so the process queue does not
  substitute for distributed transaction authority.
- **56 Functions unit tests / 4 suites pass**, including rejection of the
  internal command suffix as an externally requested operation.
- Injected Facebook and Reddit production-artifact browser journeys pass. All
  six isolated builds and explicit-output provider-boundary audits pass.
- Functions types, changed-file lint, module-cycle audit, Node 22 compiled module
  loading and repository TSDoc checks pass.

The earlier boundary runs retained two fixture mistakes: an invalid rollout
property and quota records shared between unrelated test cases. A broad run
also launched the RTDB-dependent presence suite without that emulator. The
fixtures now use the exact rollout schema, isolate quota/nonce rows before each
case, and run both emulators. These earlier logs remain diagnostic failures.

Existing aggregate quota rows become the polling rows; commands use fresh
bounded rows. No migration, new collection, secret, public endpoint or browser
SDK was introduced. Deploy the complete reviewed backend unit before claiming
this behavior on Reddit. Earlier code again shares the polling budget on rollback.

Commands, logs, initial failures and final source/output hashes are retained in
`artifacts/reddit-live-action-quota-2026-10-02/`. The six outputs are under
`/home/craig-beswetherick/.cache/riddle-quest-review/reddit-live-quota-20261002/`.
The workspace is concurrently edited and dirty; these diagnostic artifacts are
not an immutable upload candidate. No deployment, provider configuration write,
upload, purchase or notification send was performed. Reddit external-fetch
approval, signed hosted forwarding, real contract fixtures, reviewed products
and role/device acceptance remain outstanding.
