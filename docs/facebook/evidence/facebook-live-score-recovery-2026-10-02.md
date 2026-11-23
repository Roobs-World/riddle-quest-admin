# Facebook live score recovery — 2 October 2026

An authoritative Facebook live victory previously relied on its browser calling
the official tournament recorder. Closing that browser could lose the official
score, and an idempotent recorder response with `improved: false` did not restore
native score presentation. Three real-engine emulator regressions reproduced
missing official entries, including both winning seats and disabled referrals.
A separate native adapter regression reproduced the skipped idempotent score.

The existing live winner outbox now records eligible Facebook tournament scores
before referral settlement and acknowledgement. It reads the private ticket,
settled human winner, immutable receipt binding, live account and original
retention; then validates the independent creator frozen deck, authoritative
completion, penalties and finish day through the existing official recorder.
Public completed results and partial forfeits cannot supply a tournament score.
Official scoring awards no currency. Tournament and referral switches are
independent: disabling referrals no longer suppresses a valid official score,
while disabling tournaments still permits the existing referral ledger.

Score recording holds the existing server account-operation lease. Deletion
writes its permanent guard and waits for older operations before sweeping the
entry and outbox. A worker whose score commits before that sweep can then fail
closed with `account-deleted` at referral settlement; cleanup removes its entry,
and delivery cannot recreate it afterward. Corrupted eligible score authority is
quarantined before recording or referral grants. Administrator dry-run and
actual replay use the same full frozen-deck validator and original expiry.
Grant and acknowledgement fault injection targets the actual transaction write,
rather than an incidental transaction count.

The Facebook-only adapter also projects a validated official board into an
exactly matching live Meta tournament through `postScoreAsync`. Reopening or
reloading the board recovers presentation without a client recording request.
An idempotent record can recover the same way. Posts are serialized and
successful posts deduplicated by native context and official tournament, so a
slower queued score cannot overwrite a better one. Account, locale, UTC window
and native payload checks reject stale results before posting. SDK failures are
optional presentation failures and later board/record operations may retry.
A provider promise that never settles holds the projection queue; no arbitrary
retry timer or provider cancellation is claimed. Explicit native create/share
dialogs retain their existing gates.

No new callable, collection, scheduler, client journal, SDK, secret or currency
grant was introduced. Recovery uses existing pending winner receipts and future
ones; already acknowledged historical receipts are not reconstructed or
backfilled. Existing retention is unchanged. The server lease helper's Jest name
does not route Facebook through a Jest browser SDK.

Executed validation:

- **185 real Firestore emulator cases / 7 suites pass**, covering live score
  delivery, Facebook/Reddit referrals, live deletion, official tournaments,
  shared live gameplay and recorded settlement. The new delivery suite has nine
  cases: both seats/concurrent deliveries, independent switches, partial forfeit,
  midnight delivery, lost acknowledgement, corruption/dry-run/repair and deletion
  racing a score commit. Existing referral ledger totals and retry guarantees
  remain asserted.
- **2,227 portal unit tests / 262 suites pass**, including 14 native presentation
  cases. This unit invocation skips **116 browser tests / 15 suites** and is not
  evidence of a complete authentication or retired recorded-race browser run.
- Injected production-artifact Facebook and Reddit browser journeys pass.
  Facebook additionally reloads a native board with confirmed scores of 9,000
  then 2,500 milliseconds, verifies SDK projection, and observes zero client
  record requests or native creation dialogs. Reddit passes again against the
  newly retained artifact from this run.
- All six isolated target builds and explicit-output artifact audits pass:
  Facebook, Reddit, Jest, YouTube, Netflix and Yahoo. The audits enforce their
  provider SDK/network boundaries. No ads enter another target.
- Portal and Functions types, changed Functions lint, the 184-module runtime
  cycle audit, repository TSDoc audit and private compiled Functions loading on
  Node 22 pass. Runtime loading also verifies distinct Facebook/Reddit live
  receipt hash domains without performing a network operation.
- Both progress trackers validate. All three Facebook tracker tests pass after
  replacing a stale exact timestamp expectation with ISO timestamp validation;
  task counts, rejection of incomplete final review and rejection of falsely
  completed evidence remain asserted. The original timestamp-only failure is
  retained separately.

Commands, terminal logs, retained initial failures and hashes are under
`artifacts/facebook-live-score-recovery-2026-10-02/`. The initial two boundary
failures came from transaction-count injection and the expected deletion error;
the broader follow-up's single failure incorrectly expected referral delivery
to resolve after deletion. Their fixtures now assert the production write
boundary and permanent guard, with no authority/economy assertion removed.

The six outputs are retained under
`/home/craig-beswetherick/.cache/riddle-quest-review/live-score-recovery-20261002/`.
These are diagnostic builds of a concurrently edited dirty workspace, not a
clean immutable or upload-eligible release. Build-time provenance is limited;
the manifest records final source and output hashes separately. Existing retired
Jest recorded-browser migration gaps remain outside this score verification.

A fresh authenticated Meta MCP read confirms Riddle Quest app
`1748953042991569`, administrator viewer and caller permission `read`. It does
not authorize configuration writes or prove hosted score acceptance. Real Meta
create/share/join/score/display/expiry, supported audience/API and device checks
remain. Commerce, rewarded rollout, scheduled notification delivery, signed
provider fixtures, translation corpus and review/deployed-source reconciliation
retain their existing gates. This work performs no deployment, upload, provider
configuration write, purchase, notification send or production grant.
