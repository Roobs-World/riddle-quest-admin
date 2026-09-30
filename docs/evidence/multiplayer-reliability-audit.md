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

- Further semantic run validation, including immutable deck/rules, lifecycle
  progression and event/clock consistency beyond the validated context/outcomes.
- Provider side effects, invitations and cache results across navigation, account
  changes, background suspension and repeated delivery.
- Multi-tab progression and stale command recovery, including projection/authority
  disagreement and terminal status changes.
- Backend transaction races, canonical settlement, receipts, privacy, durable
  delivery recovery and storage corruption against the actual current source.
- Match retrieval/acceptance and operational failure modes, including the latest
  concurrent policy/calibration changes.
- Full integration/coverage/transaction gates after fixes, plus the requirements
  in `multiplayer-architecture-implementation.md` and final isolated artifact and
  browser verification. Do not infer completion from unchecked plan entries or
  earlier test counts.

The working checkout is shared with ongoing backend and translation work. Preserve
that work. Completion recording must use a stable source digest, and publication
must use the accepted revision. No production deployment is implied by these local
checks.
