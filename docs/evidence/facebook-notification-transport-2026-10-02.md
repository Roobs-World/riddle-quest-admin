# Facebook server notification transport — 2 October 2026

Prepared a server-only transport for the documented Zero Permissions notification
send and cancel endpoints on `graph.fb.gg`. This implements the request boundary
identified by the authenticated [Meta readiness check](meta-facebook-readiness-2026-10-02.md).
It does not expose a new Firebase callable, deploy a scheduler or send a message.

`firebase-functions/src/facebook/facebookNotificationTransport.ts` snapshots the
configured app, recipient, content and exact operation before asynchronous work.
It emits only documented JSON fields: a server-resolved player ID, approved title
and body, an app-owned label, optional serialized entry payload, and an optional
relative scheduling interval. Immediate notifications omit the delay; scheduled
requests enforce the documented 300–2,592,000-second range. The 4 KiB request and
16 KiB response budgets are local transport safeguards, not claimed Meta copy
limits. Multibyte copy is counted in bytes without changing localized text.

The app token is supplied only through a trusted server callback and encoded in
the provider's documented query parameter. The destination is fixed, redirects
are not followed, and results contain no raw token, URL, recipient, provider body
or exception message. A single ten-second abort covers HTTP and streamed response
reading. Network errors, redirects, non-2xx responses, invalid/oversized JSON,
decoder failures and late responses return an unconfirmed attempt, with no
automatic retry. A provider may already have committed an uncertain attempt.

The transport has no default response decoder or activation path. Before any
request it requires explicit protocol readiness, a fixture-backed response decoder
and exact server authorization. Sending also rechecks the existing Facebook
notifications emergency-off switch after asynchronous authorization. Cleanup can
cancel an authorized app-owned label while sending is disabled; it never issues
unscoped cancel-all. The immutable operation scope includes the scheduled delay,
so future authorization can distinguish a pending-slot reservation from an
immediate send. HTTP 200 or a generic success property is not sufficient proof.

The inspected [Meta notification reference](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/notifications)
documents the request shapes and five-pending-recipient limit. Its response schema
was not established by the inspected search results. The separate Notification
Service guide and native Audience Network server-validation APIs are not used as
substitutes. No MCP user credential was read or reused as a game app token.

The full D1/D3/D7 and race delivery requirement remains unfinished. Future wiring
must obtain the actual app-token/access and success/error contracts, verify active
Facebook identity and current consent/deletion state, atomically reserve at most
five pending slots across instances, persist attempt identity before transmitting,
and reconcile ambiguous outcomes. It must cancel and confirm old labels before
replacement, reuse the reviewed copy in every supported locale, and establish
delivery and deep links on hosted web/iOS/Android. A transport alone neither owns
the pending count nor proves consent or delivery. No row is marked complete for
this change. The native SDK bot prompt remains a separate implemented capability.

Verification uses **synthetic HTTP fixtures**, with explicit test-only readiness
and a deliberately synthetic acknowledgement decoder. These are not real Meta
fixtures or hosted delivery claims. The 24 transport cases cover send/cancel
endpoint/body/credential isolation, cancellation after sending is disabled,
immediate and boundary delays, invalid input, missing contracts, denied/revoked
authorization, input mutation, malformed/unknown/oversized responses, redirects,
provider failures and the deadline. Three focused suites pass 30 tests on the
workspace runtime and the pinned Functions Node 22 runtime. Backend types and
focused lint pass; there are no new public function exports. Backend build and
all six isolated client builds/artifact audits are retained in
`artifacts/facebook-notification-transport-2026-10-02/validation`.

The repository-wide TSDoc audit reports declarations from concurrent work. No
declaration in the two new transport files remains in its final failure list.
Source-size verification passes. No game-visible text, client SDK composition,
Jest notification behavior, Reddit proxy policy or self-contained target API was
changed by this work. No provider request was made by the transport tests, and
no deployment, upload, notification, purchase or reward was performed. The goal
remains active pending the full integration and provider acceptance work.
