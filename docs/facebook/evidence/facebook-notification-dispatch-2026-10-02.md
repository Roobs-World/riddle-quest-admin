# Facebook notification dispatch ledger — 2 October 2026

The authenticated Facebook MCP lists Riddle Quest (`1748953042991569`) with an
admin account role and a **read-only MCP grant**. A fresh basic-settings read
still reports development mode and an unset data-deletion URL. Authentication
does not establish notification, commerce, rewarded-ad or App Review acceptance.
See the earlier [provider observations](meta-facebook-readiness-2026-10-02.md).

A fresh authenticated documentation search again finds the
[Gaming Domain notification request contract](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/notifications),
including the five-pending-item limit. It does not establish that endpoint's
response schema. Success examples returned for older A2U, subscriptions, scores
or achievements endpoints are not applied to `graph.fb.gg` sends or cancellation.
Only the search query, titles and URLs are retained as evidence.

Added a private server notification ledger in
`firebase-functions/src/facebook/facebookNotificationDispatch.ts`. Actual
Firestore transactions bind admission to the configured app, canonical Facebook
identity and account generation, server-recorded bot consent, current emergency
switch and account-deletion guard. Capacity and a one-use attempt receipt commit
before transmission is authorized. At most five pending or uncertain slots can
exist across independent server instances.

An attempt retains its original server issuance and content digest. Changed
content or issuance conflicts with the stored receipt; the same attempt never
gets a second authorization. Admission checks the original five-minute window
after transaction reads and again after commit. An expired commit leaves its
reservation occupied rather than authorizing a late request. Trusted runtime
callers must preserve original work identity and bind the digest to exact
serialized provider bytes.

Uncertain send and cancellation outcomes keep their reservations. Cancellation
cannot race an unfinished or uncertain send, because that send could arrive
after the provider's cancellation acknowledgement. A scheduled slot is released
only after confirmed cancellation, or proof that its send never transmitted.
A confirmed immediate send releases its slot. Terminal results are immutable;
an unconfirmed result cannot later be overwritten with guessed success. A
definitively unsent cancellation allows a different cleanup attempt, while an
uncertain cancellation stays locked. Suspension prevents new sends but retains
known slots for label-scoped cleanup during consent revocation or deletion.

The bounded state and hashed attempt receipts live under the user's private
Firestore tree. Neither contains raw Meta player IDs, notification copy, payloads
or credentials. Actual client rules deny owner and unauthenticated access. The
existing recursive account sweep removes these rows; late settlement cannot
recreate them. Receipts have an original 31-day expiry, with a staged Firestore
TTL field override. Slots never expire automatically. No deployed TTL or physical
deletion acceptance is claimed.

The ledger itself exposes no Firebase callable, sends no provider request and
adds no client SDK. Concurrent multiplayer work has begun consuming it for
Facebook challenge pushes behind a separate off-by-default switch. That work is
outside this ledger's acceptance evidence. In particular, its conservative
transport option records responses as uncertain when no verified decoder exists;
it does not prove notification delivery or release uncertain capacity.

The D1/D3/D7 requirement remains incomplete. Before activation, establish real
app-token/access and response contracts, durable server event issuance, current
Meta consent/revocation, reconciliation of unknown outcomes, confirmed replacement
and cancellation before an account's recursive sweep, and a supported opt-in
path after suspension. Complete reviewed locale copy, deep links and hosted
web/iOS/Android delivery acceptance. A server-recorded SDK prompt is not proof
of current external consent. No tracker task is marked complete by this change.

Verification retained in
`artifacts/facebook-notification-dispatch-2026-10-02/validation` includes 12 cases
against the real Firestore Admin SDK and client rules on the pinned Functions
Node 22 runtime. They cover concurrent capacity and duplicate claims, uncertainty,
cancel/send ordering, authority, suspension, original expiry, corruption,
recursive deletion and private browser access. These use a demo emulator and
synthetic identities and transport outcomes, not real Meta receipts. Twelve
Facebook/Jest regression suites pass 112 tests. All six isolated client builds
and artifact audits pass. Backend types and focused lint pass; an initial backend
build failed in concurrent multiplayer code, and the subsequent build passed
after that source changed.

Two focused injected-browser checks also pass: Facebook's recovery/restore/pause/
reload flow, including native bot consent and rewarded-continue harness coverage,
and Jest's signed guest startup. The latter uses a private copy of its build so
concurrent rebuilds cannot replace files during the check. The full optional
authentication/browser run was interrupted after more than ten minutes without
a result; it is incomplete, not passed. The focused run explicitly skips 72
other cases. No actual Meta or Jest provider delivery is inferred from the
injected harnesses.

The repository-wide TSDoc and E2E-registration audits report unrelated concurrent
work. Neither new ledger file appears in the TSDoc failure list, and this emulator
suite is registered in `jest.rules.config.js`. Their retained failures are not
reported as a globally green release. Source-size verification passes. No visible
game text, SDK composition, purchase authority, Jest notification implementation
or deployment switch is changed by this ledger work. It performs no deployment,
upload, real notification, purchase or reward.


The [actual-byte follow-up](facebook-notification-byte-binding-2026-10-02.md)
now binds the existing live challenge caller’s original commitment to the actual
transport JSON before ledger admission. Five real-composition mismatch tests
reject without a reservation or HTTP; unchanged work remains one-use and unknown
responses retain capacity. D1/D3/D7 and external acceptance requirements above
remain incomplete.
