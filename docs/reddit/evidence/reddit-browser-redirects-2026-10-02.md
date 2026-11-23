# Reddit browser gateway redirect isolation — 2 October 2026

Reddit browser requests now reject redirects at all three production Fetch
sites: session/storage/capability requests, gameplay requests and account
deletion. Each retains its selected same-origin `/api/*` endpoint. The Devvit
server remains responsible for authenticated forwarding to the separately
approved gateway host. There is no new SDK, route, response schema, retry,
account grant, configuration switch or visible game text.

[Reddit's current HTTP Fetch documentation](https://developers.reddit.com/docs/versioned_docs/version-0.14/capabilities/server/http-fetch),
retrieved through Devvit MCP, requires browser traffic to remain on the webview
origin under `/api/`. Checking the initial relative path alone did not enforce
this invariant: native Fetch follows 301, 302, 303, 307 and 308 responses by
default. An intermediary could therefore redirect a request to another origin or
to an unrelated route on the same host. A redirected HTTP success could also
look like confirmation of account deletion.

The retained baseline invokes the actual public Reddit adapters with native
Fetch and two owned loopback HTTP servers. All 18 redirect cases failed because
the destination received a request; three ordinary-response controls passed.
The minimized 307 gateway case reproduces in under a second. Chromium also
reproduces the problem against the previous production artifact: a CORS-enabled
second loopback origin actually receives the redirected request. Only request
counts and known paths are observed; no headers, provider identities, tokens or
bodies are retained.

An initial browser setup used the package entry filename against the un-staged
portal artifact and timed out before any API request. A subsequent intercepted
remote-origin probe passed, but could not distinguish CORS/DNS rejection from
adapter isolation. Both attempts are retained as diagnostic limitations. The
real second HTTP server replaces that weak probe, proves the baseline red, and
is part of the permanent browser regression.

The fix sets `redirect: "error"` at the three existing Fetch calls. Native Fetch
rejects before following the redirect, including redirects within the original
origin. The 21 native transport cases now pass: 15 cross-origin statuses, three
same-origin route escapes and three ordinary responses. Actual requested paths
and single-attempt behavior are asserted. The five-status Chromium check also
passes against the changed private artifact, with zero requests, including
preflights, reaching the destination. The existing Reddit browser suite then
passes its gameplay, commerce, locale and live-PvP recovery journey. A rejected
redirect or network failure does not prove the initial server mutation failed;
no automatic transport retry is introduced.

Verification includes all 76 tests in six Reddit adapter suites, 149 tests in
ten Jest SDK/purchase/notification/Firebase matchmaking suites, Portal types and
source-size checks. The full Devvit package builds and validates at 416 regular
files / 7.18 MiB; all 51 package tests pass on Node 24 and pinned Node 22.23.1.
All six isolated artifacts build, with an explicit audit of each actual private
output directory. This matters for Netflix/Yahoo because their standard audit
scripts otherwise name the canonical directory.

Facebook and Jest artifacts are byte-for-byte identical to the previous private
builds, including the Jest artifact used for 42 passing scoped browser cases.
YouTube, Netflix and Yahoo encryption IVs and resulting chunk names change on
rebuild as expected from `protectContent`; all 48 locale packs decrypt to
identical content and all three manifests are unchanged. Plaintext is compared
in memory and only digests are retained. Their isolated, self-contained artifact
audits pass. The prior 31 recorded-race Jest browser cases remain unresolved
after the Live PvP redesign; this change does not make the full suite green.

Global TSDoc still reports 41 unrelated declarations; none of the changed/new
Reddit files appears in that failure list. Global E2E registration reports three
unrelated suites. The new browser regression is reached through the existing
registered Reddit browser suite. These global checks are not reported as passing.

The owner Chrome tab still waits for Reddit MFA. Real auth/payment/refund/
post-entry/realtime/notification contract fixtures and the hosted acceptance
manifest remain missing, as verified by their current validators. Exact host
approval, signed hosted forwarding, physical-device and provider review evidence
remain required. There is no deployment, upload, publication, real account
deletion, purchase, notification send, ad reward or secret-value read.

Commands, baseline/fixed results, narrowly scoped diagnostics, artifact hashes,
content comparisons and package checks are retained in
`artifacts/reddit-browser-redirects-2026-10-02/`. Artifacts are local diagnostics
and have no upload eligibility or locked clean-release provenance.
