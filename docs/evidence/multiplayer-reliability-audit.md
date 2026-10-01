# Continuing multiplayer reliability audit

Goal: improve multiplayer until a comprehensive current-source review cannot find
further actionable edge-case or reliability improvements. This goal remains active.
Evidence must be revalidated against the current working source; individual task
receipts do not establish whole-goal completion.

Current user scope: platform-specific HTML5 browser builds only; standalone web
and PWA release builds are excluded.

## Current findings and verification

- Fixed: pending bridge deliveries now expire with correlated recovery; paid and
  guess rollback retain input and the original clock. Dedicated task evidence and
  Race Session regressions cover the relevant transitions.
- Fixed: successor recovery and direct confirmations distinguish content identity,
  deck position and answer length, preserve owned typing and merge hints.
- Fixed: terminal hint confirmations show competitive results once.
- Fixed in this iteration: stalled discovery expires, settles cancelled waits,
  retains same-intent retry and ignores late replies. Reveal validation now covers
  every editable authority snapshot. Injected automatic skips, inactive-state and
  stale-question rejection match production behaviour.
- Fixed: final clearing penalties no longer project a slower completed challenger
  as a tie, and terminal clocks retain the server-confirmed value above active
  time limits.
- Fixed: owned snapshots retain immutable role/category/challenge context, and
  final outcomes validate ownership, coherent totals and result capabilities.
- The latest focused race regression run passed 233 tests. Final evidence for this
  iteration is recorded by `race-session-reliability.json`, including injected
  browser flows and all seven isolated targets. A receipt is required before
  claiming this iteration's dashboard completion.
- Latest complete verification passed every declared gate, including current
  browser flows and all isolated artifacts. The recorder withheld completion
  because concurrent edits changed the source digest during verification.
- Fixed: optional standings now own per-delivery deadlines and cancellation,
  prevent duplicate requests, reject wrong-language/stale responses and recover
  through read-only retry. Public-interface and injected Reddit evidence is in
  `multiplayer-provider-view-recovery.md`; stable recording remains a separate gate.
- Fixed: scheduled countdown retains the existing GO interval without moving the
  authoritative start or restarting the scored clock. Full Jest publication
  verification exposed this regression and passed after the fix, together with
  provider deadline/reentry browser verification and 263 focused race tests.
- Fixed: injected creator outcomes now have the production rematch/publication
  capabilities. The complete creator-publication/recipient journey passes.
- Fixed: optional effect failures no longer reject accepted race authority or
  suppress later completion effects. Provider record deliveries now have separate
  guards per adapter/account lifetime, and analytics cannot interrupt sharing.
  Public-interface verification passed 272 race tests; browser fault injection and
  stable-source recording use `race-optional-effect-isolation.json`.
- Fixed: multiplayer web dialogs capture exact journey ownership, prevent
  synchronous duplicate calls and invalidate stale context standings after an
  accepted selection. HTML5 board adapters reconcile context membership with
  restored game language; concurrent consumers share reconciliation. Evidence
  and browser coverage are in `multiplayer-web-dialog-ownership.md`.
- Current documentation gate: repository-wide TSDoc passes for 17,292 declarations
  across 748 files after documenting remaining web recovery test fixtures.
  File-size limits pass for 820 source files. These gates do not close the broader
  multiplayer requirement audit.

## Still to review before whole-goal completion

- Fixed: owned deck, prompt, evaluation and known scheduling timestamps are
  validated before rollback checkpoints are consumed. Legacy answer-free views,
  prepared scheduling, new-run content and genuine other-tab progress retain
  compatibility. Exhausted legacy hint rules suppress extra paid requests.
  Evidence and stable-source recording are in
  `multiplayer-immutable-snapshot-recovery.md` and
  `race-immutable-snapshot-recovery.json`; the broader gates below remain open.
- Fixed: live/terminal question presence and nonregressing confirmed phases,
  score, penalties, positions, attempts and reveals now protect read recovery.
  Another-tab advancement still passes. Optional startup error reporting no
  longer delays entry or exceeds the existing Jest startup budget; loading and
  buffering have cancellation, bounds and expiry. Current focused verification
  passed 328 race tests and 36 observability tests, embedded Jest/Facebook flows
  and all seven isolated artifacts. Stable-source recording remains separate.

- Further semantic run validation, including immutable deck/rules, lifecycle
  progression and event/clock consistency beyond the validated context/outcomes.
- Fixed in the settlement-receipt iteration: known grant, settlement and
  acknowledgement markers follow terminal/action authority, retained awards
  require a grant receipt, and reusable outcomes exclude one-time reward fields.
  Accepted clocks prevent backdated acknowledgement. Proven old active grants
  recover their original ghost/creator timeout without reopening play or paying
  twice; modern untimed recordings remain compatible. Evidence and stable
  recording use `multiplayer-settlement-receipt-authority.md` and
  `race-settlement-receipt-authority.json`.
- Fixed in the reward-acceptance iteration: persisted race grants reject malformed
  or unsafe currency instead of normalizing away funds. Outcome decoding and
  reward identifier/amount checks precede presentation acknowledgement inside
  the transaction. Repair preserves one grant and acknowledgement under
  concurrency; creator currency failures quarantine without partial social
  writes and replay once after repair. Evidence and stable recording use
  `multiplayer-reward-acceptance.md` and `race-reward-acceptance.json`.
- Fixed in the response-acceptance iteration: readiness, resume, new starts and
  both accepted fallback alias paths validate their public projection before
  transaction commit. Rejected responses leave countdowns, attempt consumption,
  rewards and outboxes unchanged. Repaired concurrent requests accept once;
  already-ready retries persist deleted-opponent anonymization without resetting
  the start. Evidence and stable recording use
  `multiplayer-response-acceptance.md` and `race-response-acceptance.json`.
- Fixed in the timeline iteration: retained hint/skip charges constrain their
  aggregate types, preventing an erased paid-hint charge from manufacturing a
  clean win and rewards. Canonical readers validate known sequence, question,
  score, wall/cumulative clocks, accepted markers, bounded hints and fixed archive/
  opponent finishes. Supported historical gaps/skips and deadline clamps remain
  valid. Emulator tests cover reward/write rollback and deadline quarantine,
  validated repair and idempotent loss settlement. Evidence and stable recording
  use `multiplayer-timeline-authority.md` and `race-timeline-authority.json`.
- Fixed in the outcome-confirmation iteration: internally coherent outcome
  replacements cannot change confirmed scores/clocks/penalty splits or the winner
  against the owned ghost. Repeated reads preserve settled facts; unseen other-tab
  progress and reward presentation remain compatible. Opponent timing/timeline and
  run clock arithmetic are validated independently of privacy anonymization.
  Deadline precedence rejects full-score timeouts and incomplete ghost losses
  that should have timed out. The browser creator/publication/recipient story
  injects an outcome clock replacement and recovers through one result read.
  Focused session verification passed 354 tests. Final-source verification and
  stable recording use `race-outcome-confirmation.json`.
- Fixed in the stored-result iteration: canonical terminal winners now follow
  the immutable opponent clock and score, with maximum/deck-exhaustion semantics
  and safe terminal duration sums. Matching settled outcomes cannot authorize a
  false result. The settlement interface validates its input and proposed receipt
  before rewards, including a finish after the settlement clock. Emulator
  regressions protect balances, stats, outboxes and repair/replay; actual engine
  outputs preserve legacy decks, exact ties and final penalties. Evidence and
  stable-source recording use `multiplayer-stored-result-authority.md` and
  `race-stored-result-authority.json`. Broader event/lifecycle audits remain open.
- Provider side effects, invitations and cache results across navigation, account
  changes, background suspension and repeated delivery.
- Multi-tab progression and stale command recovery, including projection/authority
  disagreement and terminal status changes.
- Backend transaction races, canonical settlement, receipts, privacy, durable
  delivery recovery and storage corruption against the actual current source.
- Fixed in the command-clock iteration: reordered commands can no longer backdate
  an accepted clock and manufacture a tenth-skip win. A private accepted-action
  marker covers wrong guesses; historical scoring events establish the supported
  fallback. Scoring, read recovery, settlement and receipts share the floor, while
  duplicate delivery retains its original response and charges once. Full-score
  historical backdating is rejected before rewards. Evidence and stable recording
  use `multiplayer-command-clock-ordering.md` and `race-command-clock-ordering.json`.
- Match retrieval/acceptance and operational failure modes, including the latest
  concurrent policy/calibration changes.
- Fixed in the request-binding iteration: versioned owner/operation/input bindings
  prevent changed intent from receiving another command's success. Supported
  historical scoring/start/reservation/publication receipts prove recoverable
  original context; damaged metadata never downgrades. Accepted fallback and
  publication aliases now retain their own receipts without repeating rewards.
  Accepted and cached mutation responses are validated inside the transaction,
  with emulator evidence of complete penalty/reward/outbox rollback on invalid
  public projections. Evidence and stable-source recording use
  `multiplayer-request-receipt-binding.md` and `race-request-receipt-binding.json`.
- Full integration/coverage/transaction gates after fixes, plus the requirements
  in `multiplayer-architecture-implementation.md` and final isolated artifact and
  browser verification. Do not infer completion from unchecked plan entries or
  earlier test counts.

- Owned-position authority now rejects scores ahead of immutable question progress
  even when retained events are absent. Modern clears require exact progress;
  historical non-clearing skips remain readable. Resume, outcome and publication
  rollback and repaired concurrent retries are covered in
  `multiplayer-position-authority.md` and `race-position-authority.json`.

- Mutation receipt projections now bind copied gameplay to owned immutable
  question content, rules, recording identity, ghost timing/history and authored
  hint selection. Historical progress and privacy presentation remain replayable.
  Evidence and recording use `multiplayer-receipt-projection-authority.md` and
  `race-receipt-projection-authority.json`.

- Cached mutation progress now agrees with accepted canonical upper bounds,
  retained event sequences, terminal measurements and operation phases. Real
  deadline clamping and older checkpoints remain supported. Evidence and recording
  use `multiplayer-receipt-progress-authority.md` and
  `race-receipt-progress-authority.json`.

- Guess feedback now uses the owned locale across server and immediate local
  projection. Cached colours, grapheme boundaries, correctness and active attempt
  counts are checked against the original authored question. Turkish casing,
  concurrent repair and desktop/mobile injected UI evidence are recorded in
  `multiplayer-guess-feedback-authority.md` and `race-guess-feedback-authority.json`.

- Expired prepared readiness now abandons without depending on mutable source
  archive availability. Ownership, interaction, strict response acceptance and
  unexpired source admission remain checked. Evidence and recording use
  `multiplayer-readiness-expiry-recovery.md` and
  `race-readiness-expiry-recovery.json`.

- Readiness now retains its accepted server clock separately from scored start.
  Older lifecycle requests cannot precede known readiness/terminal phases, and
  untouched countdown cancellation is accepted without allowing pre-start scoring.
  Evidence and recording use `multiplayer-readiness-clock-ordering.md` and
  `race-readiness-clock-ordering.json`.

The working checkout is shared with ongoing backend and translation work. Preserve
that work. Completion recording must use a stable source digest, and publication
must use the accepted revision. No production deployment is implied by these local
checks.
