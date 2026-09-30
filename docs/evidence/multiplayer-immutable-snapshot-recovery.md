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

Focused public-interface verification passed 311 race tests in 19 suites. The
injected Jest browser flow corrupts a real paid hint's outgoing deck or schedule,
verifies rollback and read-only recovery, and asserts exactly one hint charge and
one resume read. The full creator/publication/reusable-recipient journey passed.
Browser evidence includes `/tmp/race-hint-confirmation-recovery-deck.png` and
`/tmp/race-hint-confirmation-recovery-schedule.png`.

Only platform-specific HTML5 artifacts are verified: Jest, Facebook, Reddit,
YouTube, Netflix, Yahoo and GameSnacks. No standalone web/PWA release, provider
SDK, locale change or deployment is introduced. Dependency evidence verifies
target isolation, including the self-contained candidate artifacts.

Stable-source verification and local dashboard recording use:

```sh
pnpm development:complete docs/development-tasks/race-immutable-snapshot-recovery.json
```

This is partial reliability evidence. Rules compatibility, lifecycle progression,
event/clock coherence and the complete multiplayer requirement audit remain open.
A stable-source recorder receipt is required before claiming dashboard completion.
