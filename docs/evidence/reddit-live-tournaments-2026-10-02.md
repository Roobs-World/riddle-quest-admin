# Reddit live tournaments — 2 October 2026

The Live PvP migration left Reddit's enabled tournament capability without a
visible board. Its official recorder still read only recorded `raceRuns`, and
durable live winner delivery acknowledged receipts without recovering eligible
official scores. Injected production-browser and real-engine Firestore baselines
reproduce the missing tab and missing scores for both winning seats.

Authenticated Reddit multiplayer now exposes Play and Tournaments through a
lazy target-owned entry. The board reuses existing translations, identity-free
UTC standings, retry, modal focus and keyboard navigation. Reddit has no native
sharing control. Requests remain same-origin under `/api/*`; no Firebase browser
SDK, Meta SDK or Jest SDK is introduced into its artifact.

The shared tournament presentation was extracted from Facebook. Each target
keeps its own capability, diagnostics and identifiers; Facebook retains native
SDK create/share/score presentation in its adapter. The shared private live
source validator is selected by the server's provider recorder. It verifies the
owned winning ticket, actual completed private run, five-second start binding,
penalties and the independent creator's frozen deck. Public terminal projections,
partial forfeits and caller-provided scores cannot establish official authority.
Recorded-run compatibility remains intact.

Reddit's existing pending winner outbox now records eligible official scores
before its existing referral settlement and acknowledgement. Tournament and
referral switches work independently; scoring itself grants no currency. Both
winning seats, concurrent retries, original finish-day scoring, lost
acknowledgements and independently disabled features are covered. Corrupt frozen
authority quarantines delivery before recording or referral grants. Administrator
dry-run and repair/replay use the same validator and original expiry. There is no
new collection, scheduler, public operation, client journal or retention window.
Already acknowledged historical receipts are not reconstructed.

The real signed HTTP recorder test also reproduced a separate response bug:
spreading its private entry included `userId`, so strict public-schema validation
returned HTTP 401 after a successful write. The endpoint now explicitly projects
the eight public fields. Recording holds the existing account-operation lease.
Deletion writes its permanent guard, waits for the leased write to drain, then
sweeps its board entry; later signed requests cannot recreate that row. The Jest
name on the shared server lease helper does not route Reddit through Jest's SDK.

Executed validation:

- **119 real Firestore emulator cases / 8 suites pass**: Reddit/Facebook official
  recording, durable delivery, referrals, live account deletion and signed
  gateway replay/quota checks. This includes nine new Reddit delivery cases and
  the signed HTTP response/deletion race. Existing referral ledger amounts and
  retry guarantees remain asserted.
- **27 Functions unit tests / 5 suites pass** and **2,235 portal unit tests /
  264 suites pass**. The portal unit invocation skips 116 browser cases across
  15 suites; it does not prove all retired recorded-race browser paths.
- **Facebook and Reddit injected provider browser journeys pass**. Reddit uses
  the retained production artifact: Arabic RTL board, read failure/retry,
  390/1280-pixel layouts, keyboard navigation and same-origin requests. Loss,
  tie and nine-riddle forfeit outcomes submit no tournament record; a completed
  ten-riddle win submits exactly one opaque ticket/locale request. Facebook's
  harness builds its own temporary production artifact and preserves native
  create/share/entry/score/reload checks after shared UI extraction.
- **All six isolated target builds and explicit-output audits pass**: Facebook,
  Reddit, Jest, YouTube, Netflix and Yahoo. Reddit's audit checks same-origin
  requests and provider SDK isolation; Facebook's audit excludes Jest leakage
  and the other targets retain their existing SDK/ads restrictions.
- Portal and Functions types, changed Functions lint, TSDoc, the 189-module/
  1,064-reference runtime cycle audit and private compiled Functions loading on
  Node 22 pass. Runtime loading verifies distinct provider receipt hash domains
  without network requests.

Initial failures, terminal logs, commands and hashes are retained under
`artifacts/reddit-live-tournaments-2026-10-02/`. The initial signed HTTP failure is
retained as `http-response-baseline.log`; its authority and deletion assertions
were preserved when correcting the response projection. TSDoc failures and their
scoped comment fixes are also retained.

The six outputs and private compiled Functions are under
`/home/craig-beswetherick/.cache/riddle-quest-review/reddit-live-tournaments-20261002/`.
These are diagnostic outputs from a concurrently edited dirty workspace. Their
manifest records final source and artifact hashes separately; they are not a
clean immutable or upload-eligible release and do not prove deployed source
identity.

A fresh authenticated Meta MCP read confirms Riddle Quest app `1748953042991569`,
administrator viewer, granted caller permission `read`, and development mode.
Configuration writes were not performed. Hosted Reddit signed forwarding,
provider/device score acceptance, Meta native acceptance, purchases, rewarded
activation, notification delivery, content translations and complete release
reconciliation retain their existing gates. This verification performs no
deployment, upload, purchase, notification send or production grant.
