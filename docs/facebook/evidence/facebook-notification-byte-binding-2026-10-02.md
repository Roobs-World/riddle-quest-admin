# Facebook notification byte binding — 2 October 2026

The private notification ledger retained a request digest, but the actual
transport authorization callback did not compare it with the body being sent.
Five real-composition regressions reproduced modified copy, deep-link payload,
recipient, label and scheduled delay reaching injected HTTP after the original
ledger commitment was minted. The transport's separate regression also showed
that authorization had no actual-byte digest to check. No real provider request
or credential was used.

The Facebook server transport now hashes its exact serialized UTF-8 JSON before
awaiting credentials or authorization. That digest is part of its frozen attempt
scope, shared with authorization and response decoding. The live challenge
dispatcher compares the actual operation and digest with its original work
commitment before claiming the private ledger. A mismatch creates no receipt,
reserves no capacity and sends no HTTP request; the unchanged original work can
still be admitted once. Translated content, payload, targeting, cancellation
groups and delays are all covered by the serialized body. Cancellation has the
same transport digest; no new cancellation sender or guessed response decoder
was introduced.

This corrects a server integration gap. It does not expose a new callable, add
storage, change provider request fields or activate delivery. Existing five-slot
accounting, consent, generation, deletion, expiry and one-use receipts remain.
An unrecognized provider response stays uncertain and retains its reservation.
No digest is a substitute for actual current Meta opt-in or provider acceptance.
The missing `raceLivePush.it.test.ts` registration was also added to the standard
emulator suite, with an explicit loopback demo guard.

Validation:

- **34 distinct real Firestore emulator cases / 3 suites pass**, including all
  five composition regressions, dispatch capacity/uncertainty/client-rule
  checks, weekly prompt leasing and existing live push behavior.
- **48 Functions unit tests / 5 suites pass**, including 26 transport cases for
  exact bytes, input mutation, cancellation, fixed destination, delay bounds,
  deadlines, unknown responses and no retries. Shared streaming and Reddit
  operation checks remain green.
- **169 portal platform tests / 7 suites pass**, covering Facebook notification
  capability/coordinator/bootstrap, Jest SDK and notifications, and Reddit
  bootstrap. **Both injected provider browser journeys pass** with Meta native
  prompt/tournament/ads harnesses and Reddit same-origin live/board checks.
- **All six isolated builds and exact-output audits pass**: Facebook, Reddit,
  Jest, YouTube, Netflix and Yahoo. SDK/network/ads isolation remains enforced.
- Functions types, scoped lint, TSDoc, the 189-module/1,065-reference runtime
  cycle audit, private compiled Node 22 loading and whitespace checks pass.

Terminal logs and commands are retained in
`artifacts/facebook-notification-byte-binding-2026-10-02/`. The initial discovery
attempt failed because the push suite was unregistered; the subsequent baseline
reproduced all five mismatches. One intermediate invocation accidentally repeated
the dispatch suite; its 46 executions are retained separately and are not counted
as distinct coverage. The final invocation runs each of the three suites once.

The outputs are retained under
`/home/craig-beswetherick/.cache/riddle-quest-review/facebook-notification-bytes-20261002/`.
The manifest records final source and output hashes separately. This concurrently
edited dirty workspace is not an immutable, upload-eligible release, and local
checks do not prove deployed source identity or hosted delivery.

Official Meta MCP documentation discovery again finds the
[Gaming Domain notification contract](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/notifications).
The public web fetch was unavailable; no new provider response contract or
acceptance was inferred. The request format remains the existing documented
server API. D1/D3/D7 issuance and replacement, current external consent,
uncertain-outcome reconciliation, cancellation before account sweep, reviewed
copy and hosted/device delivery remain outstanding.

The Devvit MCP and current
[Reddit realtime documentation](https://developers.reddit.com/docs/capabilities/realtime/overview)
describe subscriptions that clients can choose freely, with server-controlled
publication. That establishes an available notification primitive, not private
recipient authorization or a proven cross-installation match delivery contract.
Private match views remain behind the signed same-origin gateway. This follow-up
does not substitute installation Redis for canonical global authority or claim
Reddit realtime acceptance.

No deployment, upload, purchase, actual notification or production grant occurs.
