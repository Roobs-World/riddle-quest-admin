# Facebook Live PvP first-win referrals — 2 October 2026

The real Live PvP service awarded 50 win coins and incremented
`stats.multiplayerWins`, but did not enqueue the referral work used by recorded
races. The two winning-seat regressions failed with zero delivery receipts even
though the authoritative multiplayer win existed. The referral ledger already
accepted that win counter; its eligibility predicate was not the missing step.

The live winner transaction now atomically creates Facebook-only referral work in
the existing `racePerformanceOutbox`, alongside the normal win grant. A private
immutable match binding records the receipt ID, winner ticket, authenticated UID
and server enqueue clock. A separate SHA-256 hash domain prevents a chosen
recorded-race request ID from occupying the new receipt. Public terminal views
carry none of this metadata and establish no referral authority.

The existing retry-enabled event handler and bounded recovery queue consume these
receipts. Live delivery validates the exact receipt shape, canonical Facebook
UID, ticket-to-match ownership, private human winner, committed 50-coin receipt,
multiplayer win counter, immutable binding and logical retention. It calls the
existing idempotent referral ledger and acknowledges only after the grant. It
does not fold Live PvP into recorded-race speed estimates. The existing deletion
sweep already removes this collection by owner; delivery and the ledger also
recheck account deletion.

The existing referral policy is preserved: one lifetime 100-coin invitee grant,
100 coins for the inviter only below five conversions per UTC day. A live forfeit
after the start is already an authoritative win in this game service and can
qualify; it remains ineligible for the separate ten-riddle official tournament
score. Human wins over the server fallback bot qualify, while the bot receives
no account or grant. Jest and Reddit keep their current live reward paths and
create no Facebook delivery work.

Transient grant and acknowledgement failures remain pending with the existing
bounded backoff. Corrupt metadata is quarantined. Operator replay now validates
the private live source before releasing a repaired live receipt; dry-run does
not grant, retention cannot be extended, and repeated replay cannot grant twice.
Missing/expired source, account deletion or a disabled Facebook referral feature
suppresses delivery. Rewards are asynchronous server work, rather than an
optimistic addition to the browser's displayed coin balance.

Executed verification under `artifacts/facebook-live-referral-2026-10-02/`:

- **129 real Firestore-emulator integration tests pass across five suites**:
  23 new live-referral cases plus existing live gameplay, recorded settlement,
  native tournament and referral-cap tests. The new cases include both seats,
  concurrent delivery, repeat wins, fallback bot, forfeit, the legacy request-ID
  collision, grant/acknowledgement failure, queue retry, kill switch, deletion,
  retention, missing/corrupt source, repair/replay, and six concurrent conversions.
- **94 focused Functions unit tests pass on Node 22**; **five operator CLI tests
  pass**. Functions types, production module-cycle audit and lint pass.
- The Functions emit compiles to a private output directory. Its compiled live
  authority, delivery, replay and hash-domain modules load successfully on the
  configured **Node 22.23.1** runtime without issuing a provider request.
- All six fresh isolated production client builds and explicit-directory SDK
  audits pass: Facebook, Jest, Reddit, YouTube, Netflix and Yahoo.
- Fresh production-artifact Facebook and Reddit Chromium journeys pass.
- The fresh **42-case scoped Jest browser run passes**. Its **31 skipped
  recorded-race cases remain unresolved** after the Live PvP redesign; this is
  not a passing result for the complete authentication/multiplayer suite.
- `git diff --check` passes.

The retained baseline and intermediate runs document the actual missing queue
work and subsequent boundary fixes. A concurrent live scoring update then made
skips count toward ten-riddle completion and preserved the rival's penalty
window. Revalidation reproduced the native tournament's obsolete ten-correct
requirement. The recorder now accepts exactly ten authoritative correct/skip
events, while still requiring private completion, the settled winner, frozen
deck and validated server clocks. The real penalty case proves that completion
alone cannot post a score while the rival can still win. Current-scoring logs
supersede the earlier 127-integration/84-unit snapshot; the earlier failing
penalty test remains a diagnostic. Source and artifact hashes identify local
diagnostics from a shared workspace whose HEAD changed during concurrent work;
they are not a clean immutable release candidate. This change adds no SDK,
callable, collection, trigger, scheduled job or provider permission. Deployment
of the producer and delivery/replay changes together, exact hosted source
verification, real Meta invitation/binding/first-win acceptance and physical
devices remain release evidence to collect. No deployment, provider settings
change, real purchase, reward grant or notification send was performed by this
work.
