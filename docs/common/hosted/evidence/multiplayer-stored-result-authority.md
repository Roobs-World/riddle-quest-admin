# Stored multiplayer result authority

Local development work, 30 September 2026. Scope remains platform-specific HTML5
targets; standalone web/PWA builds are excluded. No production records or deployment
were changed, and this change adds no UI copy or translations.

## Authority fix

Canonical storage validation now checks the winner against the immutable opponent
finish and the terminal adjusted clock. Ten cleared questions use the exact less
than/equal/greater comparison; an unfinished ghost loss must retain the engine's
clamped finish and respect maximum-time precedence. Timeouts cannot carry a full
score. Nonexhausted challenger timeouts use the maximum deadline, while exhausted
legacy decks can time out early. Unsafe terminal duration sums are rejected.

The same validation runs at the settlement interface, including internal callers
that supply a typed record directly. Before rewards, the complete proposed receipt
is validated, preventing a future finish from being settled prematurely. Already
settled sources cannot evade winner validation with a matching false outcome.

Supported legacy runs without rules snapshots, solo recordings without an opponent,
exact ties, final-skip finishes above the active time limit, penalty overshoots of
ghost/maximum deadlines, and short legacy decks remain readable. No stored winner
is silently rewritten. Existing delivery recovery quarantines inconsistent sources
and requires repair before replay.

## Verification

The final focused backend gate passed 672 tests across 47 suites on Node 22.23.1:
94.64% statements, 88.83% branches, 97.56% functions and 96.86% lines. All seven
platform builds and their isolation audits passed, together with backend lint/types,
security, scalability, documented declarations and source-size checks. Stable
completion recording reruns the declared gates against one source digest.
Its dedicated loopback emulator config avoids the default ports used by concurrent
release verification. The first recording attempts failed on an omitted Java PATH
and then an occupied default emulator port; neither produced a completion receipt.

Pure regressions reject contradictory completed/deadline results both before and
after a matching settlement projection. They also accept actual engine-generated
terminal runs covering legacy recordings, ties, penalties and early deck exhaustion.

Firestore emulator regressions compare full player account snapshots after rejected
public reads, resume and internal settlement. They verify absent reward/delivery
writes, quarantine and denied replay of both outbox types, and exactly one delivery
after canonical repair. A future finish earns no rewards until a later valid read.
Calibration fixtures now use the authoritative ten-second finish for partial ghost
losses, preserving their original completion-only evidence assertions.

Final verification is recorded by `docs/common/development/development-tasks/race-stored-result-authority.json`.
Its local dashboard receipt requires the pinned Node 22 backend race coverage gate,
backend types/lint, all seven isolated target builds and dependency audits, security,
scalability, documented declarations and source-size checks against a stable source.
The comprehensive multiplayer reliability goal remains active; event history,
transaction, multi-tab and provider lifecycle audits remain separate.
