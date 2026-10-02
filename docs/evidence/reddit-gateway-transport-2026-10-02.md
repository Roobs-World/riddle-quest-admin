# Reddit gateway transport — 2 October 2026

Fixed the Devvit server's signed Firebase gateway transport. The existing code
followed redirects, checked its 64 KiB response budget only after reading the
entire body, and silently replaced invalid UTF-8 inside provider JSON. Three
regression cases reproduced those behaviors before the fix.

`packages/reddit-app/src/server/redditGatewayTransport.ts` now accepts only the
four existing function names on
`https://www.roobsworld.com/api/reddit-gateway/`. It snapshots the serialized body
and signature before asynchronous work, uses manual redirects, and rejects both
redirect responses and responses already reported as redirected. A loopback
test using native fetch proves a 307 no longer forwards the synthetic signed
request to a second destination. This is local transport evidence, not a claim
about hosted Devvit enforcement or domain approval.

Response consumption checks actual bytes before retaining each chunk. At most
64 KiB are buffered, independent of `content-length`; strict UTF-8 decoding avoids
changing provider strings. The exact multi-byte boundary passes and one byte more
fails. The local 72 KiB request envelope budget accommodates the existing 64 KiB
payload plus signed context; it is not a claimed provider limit. Malformed input,
escaped/unknown routes, invalid responses and network failures yield only fixed
diagnostics. Signature headers, IDs, raw provider bodies and exception messages
are not added to diagnostics or logs.

One ten-second deadline covers response headers and streamed consumption even
when a transport ignores abort. Late headers are discarded, reader cancellation
does not prolong the deadline, and no request is automatically retried. Timeout
does not prove a mutation failed remotely. Valid JSON and provider error statuses
remain unchanged so existing identity kill-switch fallback and server-authoritative
commerce/replay behavior continue to work. All existing Devvit routes now delegate
to this helper; browser routes remain same-origin under `/api/*`.

Verification includes nine transport cases and all 51 Reddit package tests on
Node 24.17.0 and pinned Node 22.23.1. The tests use loopback listeners, synthetic
assertions, controlled streams and virtual deadlines; none transmits a live signed
request, purchase, reward or notification. Server types, the complete staged
client/server Devvit package validation, source-size and monetization checks pass.
All six isolated client builds and artifact audits pass. No client SDK, game-visible
text, platform economy or feature switch was changed. UI was not edited in this
scope. The global TSDoc audit still reports concurrent work; both new transport
files have zero remaining declarations in its failure list.

Read-only provider checks confirm CLI authentication as u/RareAdvertising2367 and
Riddle Quest `0.0.1.23` installed in `r/riddle_quest_dev`. This version observation
does not establish the installed bytes, current source or host approval. The
public gateway again returns the expected rejection for unsigned requests; it
does not prove signed Devvit forwarding. Chrome's developer-settings page requires
owner sign-in and is currently waiting for an authenticator code. No settings were
changed and no new private package was uploaded.

Devvit MCP's current [HTTP fetch reference](https://developers.reddit.com/docs/capabilities/server/http-fetch)
requires exact approved server domains and same-origin `/api/` browser requests.
Its [notification overview](https://developers.reddit.com/docs/capabilities/notifications/notifications-overview)
still describes a gated beta aimed at established games. The
[notification guidance](https://developers.reddit.com/docs/capabilities/notifications/pn-best-practices)
requires approved copy, explicit provider opt-in/out, titles up to 60 characters,
bodies up to 100, and a published-app limit of two notifications per user per day
and 25,000 per app per day. Devvit exposes native consent, audience pagination and
enqueue APIs; these are separate from Facebook and Jest notification interfaces.
No beta access, approved copy, enqueue cancellation contract or delivery evidence
is established here, and Reddit notifications remain disabled.

The six real contract fixtures (`auth`, `payment`, `refund`, `post-entry`,
`realtime`, `notification`) and hosted evidence manifest are still absent. Their
validators reject the current tree as expected. A clean reviewed package,
exact-byte ingestion evidence, host/product/policy approval, complete backend
rollout and physical web/iOS/Android role acceptance remain necessary. No tracker
row is newly marked complete and the full Facebook/Reddit goal remains active.

Selected source hashes, baseline failures, passing checks and provider observations
are retained in `artifacts/reddit-gateway-transport-2026-10-02`. Concurrent edits
make this a preparation snapshot, not an upload-eligible release receipt.
