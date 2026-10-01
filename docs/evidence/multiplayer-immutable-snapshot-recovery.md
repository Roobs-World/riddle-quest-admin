# Multiplayer immutable snapshot recovery

30 September 2026; working-source changes based on `c34be571`.

Race Session validates immutable content and schedule ownership before a response
can consume a pending action's rollback checkpoint. Shape-valid deck corruption,
incorrect answer lengths or locales, mismatched prompts, incorrect reveals,
changed downloaded content and changed known scheduling timestamps fail through
the existing translated invalid-response state. Hint, skip and correct guess
recovery retain the original draft and use a read instead of replaying the paid
or scored action.

Private ownership retains downloaded content, known evaluation, optional first
hint metadata and scheduling timestamps across compatible answer-free responses.
Public legacy responses remain answer-free. Legacy prompts pin their known clue
even when complete evaluation arrives after another tab advances. Optional hint
metadata can be added on a legacy-first journey, but omission cannot erase
previously known immutable metadata. Rematching starts a new ownership lifetime.

Positive coverage accepts genuine two-question advancement from another tab,
new schedules on prepared runs, equivalent composed/decomposed grapheme reveals,
answer-free confirmations and content revisions belonging to a new run. Existing
one-hint rules now bound immediate hint availability and suppress exhausted paid
requests even when an answer-free snapshot reports stale availability.

Verification also caught a new fallback integration mismatch: start receipts with
a server-issued fallback offer expect challenger authority. The rematch regression
now confirms an accepted run before checking the next search. Documentation-only
changes cover declarations in concurrent multiplayer backend and test work; their
behavioural rollout remains separate.

Focused public-interface verification passed 328 race tests in 20 suites. The
injected Jest browser flow corrupts a real paid hint's outgoing deck or schedule,
verifies rollback and read-only recovery, and asserts exactly one hint charge and
one resume read. The full creator/publication/reusable-recipient journey passed.
Browser evidence includes `/tmp/race-hint-confirmation-recovery-deck.png` and
`/tmp/race-hint-confirmation-recovery-schedule.png`, plus phase, missing-prompt and
score-regression variants. Lifecycle guards require a question in live phases and
none in terminal phases. Owned authority cannot move phases, score, penalty totals,
question position, attempts or confirmed reveals backwards. Validation compares
the last confirmed authority rather than provisional gameplay projections, so
genuine other-tab advancement remains valid. Injected preparation expiry now
matches production's answer-free terminal view.

Build scope includes only platform-specific HTML5 artifacts: Jest, Facebook,
Reddit, YouTube, Netflix, Yahoo and GameSnacks. No standalone web/PWA release, provider
SDK, locale change or deployment is introduced. Dependency evidence verifies
target isolation, including the self-contained candidate artifacts.

Stable-source verification and local dashboard recording use:

```sh
pnpm development:complete docs/development-tasks/race-immutable-snapshot-recovery.json
```

This is partial reliability evidence. Rules compatibility, lifecycle progression,
event/clock coherence and the complete multiplayer requirement audit remain open.
A stable-source recorder receipt is required before claiming dashboard completion.

The first recorder attempt failed a start-recovery test while the shared checkout
and dependency state were changing. Its isolated retry and subsequent complete
race-suite run passed. Concurrent upgrades exposed stale third-party notices and
additional Sentry runtime dependencies; regenerated notices and the updated
registry resolved those gates, but eager optional telemetry increased initial
Jest resources above the existing 0.55 MB budget.

Optional browser error reporting now loads its SDK only for an allowed, configured
production target. Entry rendering continues immediately. One delivery buffers up
to twenty early caught errors, uncaught errors and rejected promises, then flushes
through the existing privacy-safe adapter. Failed initialization/capture cannot
reject game startup. Concurrent callers share delivery; thirty-second expiry
permits an explicit retry, and cancelled or disallowed deliveries cannot install
a late adapter. Every terminal path removes temporary listeners and references.
Thirty-six observability tests verify these paths and the existing privacy gates.

All seven rebuilt artifacts and dependency audits passed with the unchanged
budgets: Jest has 0.47 MB initial resources, Facebook 0.43 MB and Reddit 0.55 MB.
YouTube, Netflix, Yahoo and GameSnacks remain self-contained. Injected Jest recovery
and complete recipient publication, plus Facebook startup/context flows, passed.
Repository-wide TSDoc and file-size checks passed. Dashboard completion still
requires a stable-source recorder receipt; the earlier failed attempts issued none.

The expanded recorder passed all nine declared checks, including the updated
browser helper extraction, but withheld completion because concurrent working-tree
edits changed the source digest during verification. The commit remained unchanged;
the next recording verifies the updated working source independently.
