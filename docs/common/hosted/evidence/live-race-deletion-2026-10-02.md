# Live race account deletion — 2 October 2026

The production account-deletion sweep did not cover private Live PvP data.
Real-service emulator regressions left owned searching tickets, active pointers,
shared queue references and copied match UID/name/avatar after deletion. All five
initial cases failed. Later expiry regressions showed that historical human
matches created before their first poll could also lack a root TTL timestamp.

The existing guard-and-account-lease deletion pipeline now invokes an idempotent
live-data sweep before its recorded-race cleanup. It retires owned tickets and
queue references, removes the hashed active pointer, clears cross-user invitation
copies and push metadata, and removes game-owned tournament entries. Match
transactions remove the deleting player's UID, copied name/avatar and private
progress/guesses/events. Both deleted humans and lone-human bot matches leave no
root or anonymous frozen source. Nested command receipts are cleared in bounded
pages; new command receipts also expose their owner for the existing final sweep.

An unfinished match becomes a terminal tie without a new grant. A committed
surviving win or loss remains unchanged, and the surviving winner's pending
Facebook or Reddit referral still validates and settles exactly once. Removing a
winner also removes its copied balance and referral binding. Concurrent deletion
and the opponent's final answer serialize through real Firestore transactions;
repeated polls do not reconstruct or duplicate a reward.

A surviving Facebook winner still needs an independent copy of the creator's
frozen deck for official score validation. The creator ticket therefore becomes
cancelled and anonymous, retaining only game content/rules and original clock and
expiry metadata. Its match run retains no deleted activity or answers. The neutral
server marker is not a Facebook identity. The score validator requires coupled
creator/match deletion markers and the same exact frozen deck, winner, ownership,
countdown, completion events and clocks; this exception grants no currency and
provides no actionable invitation.

New human, bot and invitation matches store an indexed participant list. Deletion
also pages historical unindexed roots so missing tickets cannot hide copied
identity. Corrupt owner/index linkage fails closed instead of looping or deleting
another player's authority; repair and retry work. Existing match deadlines are
preserved. A missing historical deadline uses the creator ticket's original
expiry, or accepted match start plus seven days if the ticket is gone, never the
deletion time. New human matches now receive an expiry at creation. Committed
Firestore field policies add live-ticket/match/queue/pointer TTL and the
collection-group indexes needed for invitation and tournament-entry removal.

Executed local evidence is under `artifacts/live-race-deletion-2026-10-02/`:

- Five original cleanup regressions failed before the fix; three historical-expiry
  regressions failed before deadline repair. Diagnostic failures are retained.
- **173 integration tests pass across six real Firestore-emulator suites**:
  live deletion, Facebook native scores, Facebook and Reddit live referrals,
  live gameplay, and recorded settlement. The deletion cases exercise both seats,
  all three multiplayer providers, pending referral delivery, anonymous official
  score preservation, missing tickets, legacy records, invitations/push metadata,
  board removal, bot/final-human removal, corrupt-index repair, concurrent finish,
  and more than 100 old roots and nested receipts.
- **29 focused integration tests also pass across deletion and native-score suites**,
  including three added tampering cases. A missing creator deletion marker, missing
  coupled match marker, or changed frozen answer rejects official scoring before
  creating an entry and leaves currency unchanged.
- **13 account-deletion unit tests pass**, including the full existing deletion
  pipeline and its guard/drain ordering.
- **348 Jest adapter tests pass across 32 suites**. This does not establish the
  full Jest authentication browser suite or migration of its 31 previously
  retired recorded-race cases.
- All **six fresh isolated builds and explicit-output SDK audits pass**:
  Facebook, Reddit, Jest, YouTube, Netflix and Yahoo. Outputs are retained under
  `~/.cache/riddle-quest-review/live-deletion-20261002/`.
- Both fresh injected Facebook and Reddit production-artifact browser journeys
  pass. Browser fixtures prove adapter behavior; the real emulator proves server
  authority and cleanup.
- Functions types, production module-cycle audit, changed-file lint and a private
  Functions emit pass. Compiled deletion/gameplay/native-score modules load on
  Node 22.23.1, without a provider request.
- The official Meta MCP app inventory confirms authenticated **read** access to
  Riddle Quest (app `1748953042991569`). It establishes no manage permission or
  deployment, upload or commerce approval.

The early boundary run retained one test-loader failure from a dynamic import;
it was corrected to a static Firestore import before the passing final run.
The first pagination invocation loaded the previous 17-case file; the final run
includes the added pagination/expiry case. Additional native source-tampering
results and exact hashes are recorded in the manifest.

Ship the producer participant/receipt metadata, live cleanup, native score
validator and Firestore policies/indexes together. Verify deployed index/TTL
readiness, actual physical expiry and provider account-deletion retry in the
reviewed backend release. The emulator does not prove production index readiness
or asynchronous TTL removal. Large historical unindexed collections require a
paged scan; interrupted cleanup must be retried and cannot be reported successful.

These are diagnostic results from a shared changing working tree, not immutable
review/upload bytes or evidence of deployed source. Hosted Meta/Reddit and
physical-device acceptance, remaining browser coverage and external commerce,
ads and notification delivery contracts remain separate review gates. This work
performed no deployment, provider setting write, real purchase, reward grant or
notification send. It cannot retract already delivered provider messages or
native scores, or establish erasure of provider-owned records.
